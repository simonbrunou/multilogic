// Tells the merging agent whether the CI run that a merge starts on `main` repeats the PR run's
// jobs and steps (AGENTS.md, "Merge authority", step 4). It ports garde-manger's
// scripts/check-push-repeats-pr.ts (garde-manger#116), itself a port of simonbrunou.bzh's
// scripts/check-push-repeats-pr.js (simonbrunou.bzh#162), to this repo (#118). Run it from a
// checkout with its dependencies installed (`bun install --frozen-lockfile`), after
// `git fetch origin`, with the SHA the PR's CI passed:
//
//   bun scripts/check-push-repeats-pr.ts <pushed SHA>
//
// It reads the files at that SHA through git, not the working tree, and prints each difference
// it finds:
//
// - a workflow anywhere under .forgejo/workflows/, subfolders included, that lacks a `push` or a
//   `pull_request` trigger, filters either one beyond `branches: [main]`, or has a trigger other
//   than those two, `schedule` and `workflow_dispatch`;
// - a job that calls a reusable workflow (`jobs.<id>.uses`), whose steps this script cannot read;
// - in a workflow, in any other YAML file under .forgejo/, or in an action.yml or action.yaml
//   anywhere: a file the `yaml` package reads with an error or a warning (a duplicate key, an
//   unknown tag), a tag (`!!binary`, whose value YAML decodes), an alias (`*name`,
//   `<<: *name`), an `if` key however it is spelled (`"if":`, `if :`), a `${{ }}` expression in
//   a key or a value as YAML reads it (escapes such as \x24 included, and expressions that name
//   no `github.` value, such as `steps.<id>.outputs.<x>`, `forgejo.` or `forge.`), and a step
//   that uses actions/github-script, whose code gets the event;
// - in any tracked file outside Markdown and the workflows on `pull_request` alone (see below), a
//   name made of GITHUB, FORGEJO or FORGE and an underscore, which a script or a local action
//   (`uses: ./path`) could read the event through, and the names of the actions toolkit's github
//   module and its event property. Neither this script nor its test holds one, so both are read.
//   It drops the caller's GIT_*_PATHSPECS variables, which would change the files git reads;
// - a file name that is not UTF-8, which this script cannot read.
//
// It allows the differences this repo's CI keeps on purpose, and nothing wider:
//
// - A workflow whose `on` names `pull_request` alone, unfiltered or filtered to
//   `branches: [main]` only, as fallow.yml does: `main` gets no run from it, so its expressions,
//   `if` keys and jobs pass, and the repo-wide scan above skips the file (fallow.yml's
//   `${{ github.base_ref }}` and its `concurrency` group pass so). Its YAML errors, warnings,
//   tags and aliases are still reported, since they can hide a trigger. The files its steps
//   run, such as a script or an action.yml, are still read. An action.yml or action.yaml never
//   counts as such a workflow, since a step on `push` can run it with `uses:`.
// - In a workflow that runs on `push`, `${{ github.ref }}` as the one expression in the string
//   value of the workflow's top-level `concurrency.group`, as ci.yml has it: the group only
//   picks which run a newer push cancels. The string form `concurrency: <string>`, a job-level
//   `concurrency`, an expression in `cancel-in-progress` and every other expression are
//   reported.
// - `branches: [main]` under `push` and `pull_request`: the PR runs it keeps are those of PRs
//   into main, the ones whose merge starts a push run on main.
//
// It cannot see code that branches on commit metadata (the push run checks out `main` at the
// merge commit, whose subject, SHA and parents differ from the pushed SHA's), what a third-party
// action (`uses: owner/repo@ref`) does with the event, code that the runner or its image runs in
// every step, a step on `push` that runs a workflow on `pull_request` alone as a script, or code
// that reads the event by a route the list above leaves out. Such code passes.
//
// Exit 0: no difference, so the push run repeats the PR run. Exit 1: it printed a difference, so
// wait on main's run. Exit 2: git failed, the SHA is unknown or Bun cannot load the `yaml`
// devDependency, as from a node_modules installed before it was added (where Bun finds no
// node_modules at all, it fetches the package itself); wait too.
// tests/scripts/check-push-repeats-pr.test.ts holds one case per difference.
import { spawnSync } from 'node:child_process';
import type { Document, LineCounter, Node, Scalar } from 'yaml';

const RUNNER_NAMES = ['GITHUB', 'FORGEJO', 'FORGE'].map((name) => `${name}_`);
// Built from parts, like RUNNER_NAMES, so this file does not match itself.
const EVENT_READS = [['@actions', 'github'].join('/'), ['event', 'Name'].join('')];
const ALLOWED_TRIGGERS = new Set(['push', 'pull_request', 'schedule', 'workflow_dispatch']);
const EXPRESSION = /\$\{\{([\s\S]*?)\}\}/g;
const GROUP_EXPRESSION = 'github.ref';

function fail(message: string): never {
  console.error(`check-push-repeats-pr: ${message}`);
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length !== 1) fail('usage: bun scripts/check-push-repeats-pr.ts <pushed SHA>');

const YAML = await import('yaml').catch(() =>
  fail('cannot load the yaml package; run bun install first')
);

// The caller's pathspec settings: GIT_ICASE_PATHSPECS=1 would make `:!*.md` skip a.MD as well.
const GIT_ENV = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !/^GIT_(LITERAL|GLOB|NOGLOB|ICASE)_PATHSPECS$/.test(name)
  )
);
let cwd = process.cwd();
function gitBytes(gitArgs: string[], okCodes = [0]): Buffer {
  const proc = spawnSync('git', gitArgs, { cwd, env: GIT_ENV, maxBuffer: 1 << 28 });
  if (proc.error || !okCodes.includes(proc.status ?? -1)) {
    fail(`git ${gitArgs.join(' ')} failed: ${(proc.error?.message ?? String(proc.stderr)).trim()}`);
  }
  return proc.stdout;
}
const git = (gitArgs: string[], okCodes = [0]) => gitBytes(gitArgs, okCodes).toString('utf8');

cwd = git(['rev-parse', '--show-toplevel']).trim();
const commit = git(['rev-parse', '--verify', '--quiet', `${args[0]}^{commit}`], [0, 1]).trim();
if (!commit) fail(`unknown commit: ${args[0]}`);
const differences: string[] = [];
const tree = gitBytes(['ls-tree', '-r', '--name-only', '-z', commit]);
let names: string;
try {
  names = new TextDecoder('utf-8', { fatal: true }).decode(tree);
} catch {
  // Decoded with U+FFFD, two names can read as one, and `git show` then reads the wrong file.
  differences.push(`${commit}: a file name that is not UTF-8, which this script cannot read`);
  names = tree.toString('utf8');
}
const files = names.split('\0').filter(Boolean);
const isYaml = (f: string) => /\.ya?ml$/.test(f);
const isAction = (f: string) => /(^|\/)action\.ya?ml$/.test(f);
const workflows = files.filter((f) => f.startsWith('.forgejo/workflows/') && isYaml(f));
const scanned = files.filter((f) => (f.startsWith('.forgejo/') && isYaml(f)) || isAction(f));
// Workflows on `pull_request` alone, which the repo-wide scan below skips too.
const prOnly: string[] = [];
if (!workflows.length) differences.push('.forgejo/workflows/: no workflow file');

const isEmpty = (value: unknown) =>
  value == null || (typeof value === 'object' && Object.keys(value).length === 0);

function isMainOnly(value: unknown): boolean {
  if (isEmpty(value)) return true;
  if (typeof value !== 'object' || value === null) return false;
  const filter = value as Record<string, unknown>;
  const branches = [filter.branches].flat();
  return (
    Object.keys(filter).join() === 'branches' && branches.length === 1 && branches[0] === 'main'
  );
}

// The workflow's triggers as a map from name to filter, or null when it has no `on`.
function triggersOf(doc: unknown): Record<string, unknown> | null {
  const on = (doc as { on?: unknown } | null)?.on;
  if (typeof on === 'string') return { [on]: null };
  if (Array.isArray(on)) return Object.fromEntries(on.map((t) => [String(t), null]));
  if (on && typeof on === 'object') return on as Record<string, unknown>;
  return null;
}

// A workflow whose `on` names `pull_request` alone, unfiltered or filtered to `branches: [main]`.
function isPrOnly(triggers: Record<string, unknown> | null): boolean {
  return (
    triggers !== null &&
    Object.keys(triggers).join() === 'pull_request' &&
    isMainOnly(triggers.pull_request)
  );
}

function checkTriggers(file: string, triggers: Record<string, unknown> | null) {
  if (triggers === null) return differences.push(`${file}: no on: triggers`);
  for (const name of ['push', 'pull_request']) {
    if (!(name in triggers)) differences.push(`${file}: no ${name} trigger`);
    else if (!isMainOnly(triggers[name])) {
      differences.push(`${file}: ${name} has a filter beyond branches: [main]`);
    }
  }
  for (const name of Object.keys(triggers)) {
    if (!ALLOWED_TRIGGERS.has(name)) differences.push(`${file}: trigger ${name}`);
  }
}

function checkJobs(file: string, doc: unknown) {
  const jobs = (doc as { jobs?: unknown } | null)?.jobs;
  if (!jobs || typeof jobs !== 'object') return;
  for (const [id, job] of Object.entries(jobs)) {
    if (job && typeof job === 'object' && 'uses' in job) {
      differences.push(`${file}: job ${id} calls a reusable workflow: ${job.uses}`);
    }
  }
}

// The scalar node of the workflow's top-level `concurrency.group`, where `${{ github.ref }}` may
// stand (see the header). Matched by node, not by path, so a key spelled "concurrency.group" or
// a job's `concurrency` never counts.
function concurrencyGroup(doc: Document): Scalar | undefined {
  const concurrency = YAML.isMap(doc.contents) ? doc.contents.get('concurrency', true) : undefined;
  const group = YAML.isMap(concurrency) ? concurrency.get('group', true) : undefined;
  return YAML.isScalar(group) && typeof group.value === 'string' ? group : undefined;
}

type Scan = {
  file: string;
  lines: LineCounter;
  // False in a workflow on `pull_request` alone, where only tags and aliases are reported.
  full: boolean;
  group: Scalar | undefined;
};

function expressions(scan: Scan, node: Scalar): string[] {
  if (typeof node.value !== 'string') return [];
  const found = [...node.value.matchAll(EXPRESSION)];
  const allowed =
    node === scan.group && found.length === 1 && found[0][1].trim() === GROUP_EXPRESSION;
  return allowed ? [] : found.map((match) => match[0]);
}

// Every node of the file, keys included, so a key spelled "if" or `if :` and an expression in a
// key are found too.
function walk(scan: Scan, node: unknown, where: string) {
  const at = (n: unknown) => {
    const start = (n as Node | null)?.range?.[0];
    return start === undefined ? scan.file : `${scan.file}:${scan.lines.linePos(start).line}`;
  };
  const tag = (node as { tag?: string } | null)?.tag;
  if (tag) {
    differences.push(`${at(node)}: ${where}: a tag (${tag}), which this script does not read`);
  }
  if (YAML.isAlias(node)) {
    differences.push(
      `${at(node)}: ${where}: an alias (*${node.source}), which this script does not follow`
    );
  } else if (YAML.isScalar(node)) {
    if (!scan.full) return;
    for (const expression of expressions(scan, node)) {
      differences.push(`${at(node)}: ${where}: an expression: ${expression}`);
    }
  } else if (YAML.isSeq(node)) {
    node.items.forEach((item, i) => walk(scan, item, `${where}[${i}]`));
  } else if (YAML.isMap(node)) {
    for (const pair of node.items) {
      const key = YAML.isScalar(pair.key) ? String(pair.key.value) : '?';
      const path = `${where}.${key}`;
      const value = YAML.isScalar(pair.value) ? String(pair.value.value) : '(not a plain value)';
      walk(scan, pair.key, `${path} (key)`);
      if (scan.full && key === 'if') differences.push(`${at(pair.key)}: ${path}: an if: ${value}`);
      if (scan.full && key === 'uses' && value.includes('github-script')) {
        differences.push(`${at(pair.key)}: ${path}: runs code that gets the event: ${value}`);
      }
      walk(scan, pair.value, path);
    }
  }
}

for (const file of scanned) {
  const lines = new YAML.LineCounter();
  const doc = YAML.parseDocument(git(['show', `${commit}:${file}`]), { lineCounter: lines });
  const problem = doc.errors[0] ?? doc.warnings[0];
  if (problem) {
    differences.push(`${file}: not readable as YAML (${problem.message.split('\n')[0]})`);
    continue;
  }
  let value: unknown;
  try {
    value = doc.toJS();
  } catch (error) {
    differences.push(`${file}: not readable as YAML (${(error as Error).message})`);
    continue;
  }
  const isWorkflow = workflows.includes(file);
  const triggers = isWorkflow ? triggersOf(value) : null;
  const full = !(isWorkflow && !isAction(file) && isPrOnly(triggers));
  if (!full) prOnly.push(file);
  const group = isWorkflow && full ? concurrencyGroup(doc) : undefined;
  walk({ file, lines, full, group }, doc.contents, '');
  if (isWorkflow && full) {
    checkTriggers(file, triggers);
    checkJobs(file, value);
  }
}

const pattern = [...RUNNER_NAMES, ...EVENT_READS].join('|');
// The matching files by exact name, so skipping a workflow on `pull_request` alone skips no folder
// of the same name, as a pathspec would.
const matched = git(['grep', '-lzE', pattern, commit, '--', '.', ':!*.md'], [0, 1])
  .split('\0')
  .filter(Boolean)
  .map((hit) => hit.slice(commit.length + 1))
  .filter((file) => !prOnly.includes(file));
for (const file of matched) {
  const hits = git(['grep', '-nE', pattern, commit, '--', `:(literal)${file}`], [0, 1]);
  const lines = hits.split('\n').filter(Boolean);
  // A name that is not UTF-8 reads back as another name, which matches no file.
  if (!lines.length) lines.push(file);
  for (const hit of lines) {
    const where = hit.replace(`${commit}:`, '');
    differences.push(`${where}: reads the event or names a runner variable`);
  }
}

const short = commit.slice(0, 8);
if (differences.length) {
  for (const d of differences) console.log(d);
  console.log(
    `check-push-repeats-pr: ${short}: ${differences.length} difference(s); wait on main's run`
  );
  process.exit(1);
}
console.log(
  `check-push-repeats-pr: ${short}: the push run repeats the PR run (${workflows.length} ` +
    `workflow file(s), ${prOnly.length} of them on pull_request alone, ${scanned.length} file(s) ` +
    'scanned)'
);
