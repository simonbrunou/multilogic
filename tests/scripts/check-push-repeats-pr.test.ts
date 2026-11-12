// scripts/check-push-repeats-pr.ts (#118) against a small git repo written per test. The base
// repo holds the shapes the script must pass, as this repo's CI has them: ci.yml on `push` and
// `pull_request` to `main` with `${{ github.ref }}` in its top-level `concurrency.group`,
// fallow.yml on `pull_request` alone with `${{ github.base_ref }}` in a step, and a runner
// variable name in Markdown. Each other case edits one file into one difference and asserts exit
// 1 and the line that names it, so removing any rule from the script turns a case red.
//
// These tests run on Node in the vitest `unit` project and spawn `bun` from the PATH, as the ci
// job's setup-bun step puts it there. The runner variable names and the toolkit module name are
// built from parts here, as in the script, so neither file holds one and the script reads both.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../scripts/check-push-repeats-pr.ts', import.meta.url));
const CI = '.forgejo/workflows/ci.yml';
const FALLOW = '.forgejo/workflows/fallow.yml';
const [GH, FJ, FG] = ['GITHUB', 'FORGEJO', 'FORGE'].map((name) => `${name}_`);
const LIB = ['@actions', 'github'].join('/');
const EV = ['event', 'Name'].join('');

// The repos below must not see the caller's git config or a GIT_DIR a hook set.
const ENV: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      (e): e is [string, string] => !e[0].startsWith('GIT_') && e[1] !== undefined
    )
  ),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  LC_ALL: 'C'
};

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'multilogic-push-repeats-pr-'));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

// Lines 1 to 17; ciWith() adds steps from line 18 on, as steps[3] and after.
const baseCi = [
  'name: ci',
  'on:',
  '  pull_request:',
  '    branches: [main]',
  '  push:',
  '    branches: [main]',
  'concurrency:',
  '  group: ci-${{ github.ref }}',
  '  cancel-in-progress: true',
  'jobs:',
  '  verify:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: actions/checkout@v7',
  '      - run: bun install --frozen-lockfile',
  '      - name: Unit tests',
  '        run: bun run test:coverage'
].join('\n');
const baseFallow = [
  'name: fallow',
  'on:',
  '  pull_request:',
  '    branches: [main]',
  'concurrency:',
  '  group: fallow-${{ github.ref }}',
  '  cancel-in-progress: true',
  'jobs:',
  '  audit:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: actions/checkout@v7',
  '        with:',
  '          fetch-depth: 0',
  '      - name: Fallow audit',
  '        env:',
  '          BASE_REF: ${{ github.base_ref }}',
  '        run: bunx fallow audit --changed-since "origin/${BASE_REF}"'
].join('\n');
const base: Record<string, string> = {
  [CI]: baseCi,
  [FALLOW]: baseFallow,
  'README.md': `CI reads ${GH}TOKEN; Markdown is not run.\n`,
  'scripts/build.sh': 'echo build\n'
};

function run(command: string, args: string[], cwd: string, env = ENV, input?: string) {
  const proc = spawnSync(command, args, { cwd, env, encoding: 'utf8', input });
  if (proc.error) throw proc.error;
  return { exitCode: proc.status, out: proc.stdout + proc.stderr };
}

type Git = (args: string[], input?: string) => string;
type Options = {
  script?: string;
  subdir?: string;
  bunArgs?: string[];
  // Set for the script only, not for the git calls that build the repo.
  env?: Record<string, string>;
  // Writes a commit that the working tree cannot hold and returns its SHA.
  rewrite?: (git: Git, dir: string) => string;
};

const AUTHOR = ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid'];
let count = 0;
// Commits `files` over the base repo (a null value deletes a base file) and runs `script` on
// that commit from `subdir` of the repo.
function check(
  files: Record<string, string | null> = {},
  { script = SCRIPT, subdir = '', bunArgs = [], env = {}, rewrite }: Options = {}
) {
  const dir = join(root, String(count++));
  for (const [file, content] of Object.entries({ ...base, ...files })) {
    if (content === null) continue;
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  const git: Git = (args, input) => {
    const { exitCode, out } = run('git', args, dir, ENV, input);
    if (exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${out}`);
    return out;
  };
  git(['init', '-q', '-b', 'main']);
  git(['add', '-A']);
  git([...AUTHOR, 'commit', '-qm', 'c']);
  const sha = rewrite ? rewrite(git, dir) : git(['rev-parse', 'HEAD']).trim();
  return run('bun', [...bunArgs, script, sha], join(dir, subdir), { ...ENV, ...env });
}

// Replaces `from` in `text`, failing the test when `from` is not there, so a case never runs on
// the unedited base by mistake.
function edit(text: string, from: string | RegExp, to: string) {
  const out = text.replace(from, to);
  expect(out).not.toBe(text);
  return out;
}

function ciWith(...extraSteps: string[]) {
  return `${baseCi}\n${extraSteps.join('\n')}\n`;
}

function expectPass(files: Record<string, string | null>, options?: Options) {
  const { exitCode, out } = check(files, options);
  expect(out).toMatch(/the push run repeats the PR run/);
  expect(exitCode).toBe(0);
}

function expectDifference(
  files: Record<string, string | null>,
  pattern: RegExp,
  options?: Options
) {
  const { exitCode, out } = check(files, options);
  expect(out).toMatch(pattern);
  expect(out).toMatch(/wait on main's run/);
  expect(exitCode).toBe(1);
}

describe('check-push-repeats-pr passes', () => {
  it("the base repo: this repo's ci.yml and fallow.yml shapes", () => {
    const { exitCode, out } = check();
    expect(out).toMatch(
      /the push run repeats the PR run \(2 workflow file\(s\), 1 of them on pull_request alone, 2 file\(s\) scanned\)/
    );
    expect(exitCode).toBe(0);
  });
  it('triggers written as a list', () => {
    const ci = edit(
      baseCi,
      /on:\n {2}pull_request:\n {4}branches: \[main\]\n {2}push:\n {4}branches: \[main\]/,
      'on: [push, pull_request]'
    );
    expectPass({ [CI]: ci });
  });
  it('push and pull_request with no filter, and workflow_dispatch and schedule beside them', () => {
    const ci = edit(
      baseCi,
      '  pull_request:\n    branches: [main]\n  push:\n    branches: [main]\n',
      "  push:\n  pull_request:\n  workflow_dispatch:\n  schedule:\n    - cron: '0 3 * * *'\n"
    );
    expectPass({ [CI]: ci });
  });
  it('branches written as a string under both triggers', () => {
    expectPass({ [CI]: baseCi.replaceAll('branches: [main]', 'branches: main') });
  });
  it('an action from data.forgejo.org', () => {
    expectPass({ [CI]: ciWith('      - uses: https://data.forgejo.org/actions/setup-node@v7') });
  });
  it('run from a subfolder of the repo', () => {
    expectPass({}, { subdir: 'scripts' });
  });
  it('a pull_request-only workflow holding an if: and github.base_ref in its steps', () => {
    const fallow = `${baseFallow}\n      - run: echo base\n        if: github.base_ref == 'main'\n`;
    expectPass({ [FALLOW]: fallow });
  });
  it('a pull_request-only workflow that reads a runner variable', () => {
    expectPass({ [FALLOW]: `${baseFallow}\n      - run: echo "$${GH}BASE_REF"\n` });
  });
  it("Markdown anywhere, whatever pathspec variables the caller's environment sets", () => {
    const docs = { 'docs/notes.md': `Steps read ${GH}REF.\n` };
    for (const name of ['LITERAL', 'GLOB', 'NOGLOB', 'ICASE']) {
      expectPass(docs, { env: { [`GIT_${name}_PATHSPECS`]: '1' } });
    }
  });
  it('a pull_request-only workflow in each form of on:', () => {
    for (const on of ['on: pull_request', 'on: [pull_request]', 'on:\n  pull_request:']) {
      const fallow = edit(baseFallow, 'on:\n  pull_request:\n    branches: [main]', on);
      expectPass({ [FALLOW]: fallow });
    }
  });
});

describe('check-push-repeats-pr finds a difference in the triggers', () => {
  it('a workflow that runs only on push', () => {
    expectDifference(
      { '.forgejo/workflows/deploy.yml': 'on: push\njobs: {}\n' },
      /deploy\.yml: no pull_request trigger/
    );
  });
  it('a push-only workflow in a subfolder of .forgejo/workflows', () => {
    expectDifference(
      { '.forgejo/workflows/extra/push-only.yaml': 'on: push\njobs: {}\n' },
      /extra\/push-only\.yaml: no pull_request trigger/
    );
  });
  it('a push-only workflow, run from a subfolder of the repo', () => {
    expectDifference(
      { '.forgejo/workflows/deploy.yml': 'on: push\njobs: {}\n' },
      /deploy\.yml: no pull_request trigger/,
      { subdir: 'scripts' }
    );
  });
  it('a workflow on pull_request and workflow_dispatch but not push', () => {
    const fallow = edit(baseFallow, 'concurrency:', '  workflow_dispatch:\nconcurrency:');
    expectDifference(
      { [FALLOW]: fallow },
      /fallow\.yml:18: \.jobs\.audit\.steps\[1\]\.env\.BASE_REF: an expression: \$\{\{ github\.base_ref \}\}[\s\S]*fallow\.yml: no push trigger/
    );
  });
  it('a workflow on pull_request_target alone', () => {
    const fallow = edit(baseFallow, '  pull_request:', '  pull_request_target:');
    expectDifference(
      { [FALLOW]: fallow },
      /fallow\.yml: no push trigger[\s\S]*fallow\.yml: no pull_request trigger[\s\S]*fallow\.yml: trigger pull_request_target/
    );
  });
  it('a pull_request-only workflow filtered beyond branches: [main]', () => {
    for (const filter of ["    paths: ['src/**']", '    types: [opened]']) {
      const fallow = edit(baseFallow, 'concurrency:', `${filter}\nconcurrency:`);
      expectDifference(
        { [FALLOW]: fallow },
        /fallow\.yml: no push trigger[\s\S]*fallow\.yml: pull_request has a filter beyond branches: \[main\]/
      );
    }
  });
  it('a pull_request-only workflow into main and another branch', () => {
    const fallow = edit(baseFallow, '    branches: [main]', '    branches: [main, dev]');
    expectDifference(
      { [FALLOW]: fallow },
      /fallow\.yml: pull_request has a filter beyond branches: \[main\]/
    );
  });
  it('a trigger other than push, pull_request, schedule and workflow_dispatch', () => {
    const ci = edit(baseCi, 'concurrency:', '  workflow_run:\n    workflows: [Build]\nconcurrency:');
    expectDifference({ [CI]: ci }, /ci\.yml: trigger workflow_run/);
  });
  it('a pull_request filter beyond branches: [main]', () => {
    const ci = edit(baseCi, '    branches: [main]\n  push:', "    paths: ['src/**']\n  push:");
    expectDifference({ [CI]: ci }, /ci\.yml: pull_request has a filter beyond branches: \[main\]/);
  });
  it('a pull_request types filter beside branches: [main]', () => {
    const ci = edit(
      baseCi,
      '    branches: [main]\n  push:',
      '    branches: [main]\n    types: [opened]\n  push:'
    );
    expectDifference({ [CI]: ci }, /ci\.yml: pull_request has a filter beyond branches: \[main\]/);
  });
  it('pull_request into main and another branch', () => {
    const ci = edit(baseCi, '    branches: [main]\n  push:', '    branches: [main, dev]\n  push:');
    expectDifference({ [CI]: ci }, /ci\.yml: pull_request has a filter beyond branches: \[main\]/);
  });
  it('a push filter beyond branches: [main]', () => {
    const ci = edit(
      baseCi,
      '    branches: [main]\nconcurrency:',
      "    branches: [main]\n    paths-ignore: ['**.md']\nconcurrency:"
    );
    expectDifference({ [CI]: ci }, /ci\.yml: push has a filter beyond branches: \[main\]/);
  });
  it('push on main and another branch', () => {
    const ci = edit(
      baseCi,
      '    branches: [main]\nconcurrency:',
      '    branches: [main, dev]\nconcurrency:'
    );
    expectDifference({ [CI]: ci }, /ci\.yml: push has a filter beyond branches: \[main\]/);
  });
  it('push on another branch only', () => {
    const ci = edit(baseCi, '    branches: [main]\nconcurrency:', '    branches: dev\nconcurrency:');
    expectDifference({ [CI]: ci }, /ci\.yml: push has a filter beyond branches: \[main\]/);
  });
  it('a workflow with no on:', () => {
    expectDifference({ '.forgejo/workflows/empty.yml': 'jobs: {}\n' }, /empty\.yml: no on: triggers/);
  });
  it('no workflow at all', () => {
    expectDifference({ [CI]: null, [FALLOW]: null }, /\.forgejo\/workflows\/: no workflow file/);
  });
  it('a job that calls a reusable workflow', () => {
    const ci = `${baseCi}\n  deploy:\n    uses: owner/repo/.forgejo/workflows/deploy.yml@main\n`;
    expectDifference(
      { [CI]: ci },
      /ci\.yml: job deploy calls a reusable workflow: owner\/repo\/\.forgejo\/workflows\/deploy\.yml@main/
    );
  });
});

describe('check-push-repeats-pr finds a difference in how YAML reads a file', () => {
  it('a workflow that is not YAML', () => {
    expectDifference(
      { '.forgejo/workflows/broken.yml': 'on: [push\n' },
      /broken\.yml: not readable as YAML/
    );
  });
  it('a duplicate key, which would hide the first if:', () => {
    const ci = ciWith('      - run: echo push', '        if: github.ref', '        if: github.ref');
    expectDifference({ [CI]: ci }, /ci\.yml: not readable as YAML \(Map keys must be unique/);
  });
  it('a duplicate key in a pull_request-only workflow', () => {
    const fallow = `${baseFallow}\non: push\n`;
    expectDifference({ [FALLOW]: fallow }, /fallow\.yml: not readable as YAML \(Map keys must be unique/);
  });
  it('an unknown tag, which YAML reads with a warning', () => {
    const ci = ciWith('      - run: !event echo hi');
    expectDifference({ [CI]: ci }, /ci\.yml: not readable as YAML \(Unresolved tag: !event/);
  });
  it('more aliases than the yaml package expands', () => {
    const lines = ['a: &a [x, x, x, x, x, x, x, x, x, x]'];
    for (const [name, prev] of [['b', 'a'], ['c', 'b'], ['d', 'c']]) {
      lines.push(`${name}: &${name} [${Array(10).fill(`*${prev}`).join(', ')}]`);
    }
    expectDifference(
      { '.forgejo/shared/bomb.yml': `${lines.join('\n')}\n` },
      /\.forgejo\/shared\/bomb\.yml: not readable as YAML \(Excessive alias count/
    );
  });
  it('a !!binary value, which YAML decodes into an expression', () => {
    const encoded = Buffer.from('echo ${{ github.event_name }}').toString('base64');
    const ci = ciWith(`      - run: !!binary ${encoded}`);
    expectDifference(
      { [CI]: ci },
      /ci\.yml:18: \.jobs\.verify\.steps\[3\]\.run: a tag \(tag:yaml\.org,2002:binary\)/
    );
  });
  it('a tag in a pull_request-only workflow', () => {
    const fallow = edit(baseFallow, 'on:\n  pull_request:', 'on:\n  !!str pull_request:');
    expectDifference({ [FALLOW]: fallow }, /fallow\.yml:3: \.on\.pull_request \(key\): a tag \(tag:yaml\.org,2002:str\)/);
  });
  it('an alias in a pull_request-only workflow', () => {
    const fallow = edit(
      baseFallow,
      'name: fallow\non:\n  pull_request:',
      'name: &trigger pull_request\non:\n  *trigger :'
    );
    expectDifference({ [FALLOW]: fallow }, /fallow\.yml:3: \.on\.\? \(key\): an alias \(\*trigger\)/);
  });
  it('an if: that is an alias', () => {
    const ci = ciWith(
      '      - run: echo a',
      '        env: { C: &cond "github.event_name == \'push\'" }',
      '      - run: echo b',
      '        if: *cond'
    );
    expectDifference({ [CI]: ci }, /ci\.yml:21: \.jobs\.verify\.steps\[4\]\.if: an alias \(\*cond\)/);
  });
  it('a merge key that pulls in an alias', () => {
    const ci = ciWith('      - &step { run: echo a }', '      - <<: *step', '        name: b');
    expectDifference({ [CI]: ci }, /steps\[4\]\.<<: an alias \(\*step\)/);
  });
});

describe('check-push-repeats-pr finds an if: in a workflow that runs on push', () => {
  it('an if: on github.event_name', () => {
    const ci = ciWith('      - run: echo push', "        if: github.event_name == 'push'");
    expectDifference(
      { [CI]: ci },
      /ci\.yml:19: \.jobs\.verify\.steps\[3\]\.if: an if: github\.event_name == 'push'/
    );
  });
  it('an if: that reads no event', () => {
    const ci = ciWith('      - run: bun install', "        if: steps.cache.outputs.cache-hit != 'true'");
    expectDifference({ [CI]: ci }, /steps\[3\]\.if: an if: steps\.cache/);
  });
  it('an if: always()', () => {
    expectDifference(
      { [CI]: ciWith('      - run: echo done', '        if: always()') },
      /steps\[3\]\.if: an if: always\(\)/
    );
  });
  it('an if key written in quotes', () => {
    const ci = ciWith('      - run: echo push', '        "if": steps.co.outputs.ref == \'refs/heads/main\'');
    expectDifference({ [CI]: ci }, /ci\.yml:19: \.jobs\.verify\.steps\[3\]\.if: an if:/);
  });
  it('an if key with a space before its colon', () => {
    const ci = ciWith('      - run: echo push', "        if : steps.co.outputs.ref == 'refs/heads/main'");
    expectDifference({ [CI]: ci }, /ci\.yml:19: \.jobs\.verify\.steps\[3\]\.if: an if:/);
  });
  it('an if: on a job', () => {
    const ci = edit(baseCi, '    runs-on:', "    if: github.event_name == 'push'\n    runs-on:");
    expectDifference({ [CI]: ci }, /ci\.yml:12: \.jobs\.verify\.if: an if:/);
  });
});

describe('check-push-repeats-pr finds an expression in a workflow that runs on push', () => {
  it('github.ref in a step env', () => {
    const ci = ciWith('      - run: echo ref', '        env:', '          REF: ${{ github.ref }}');
    expectDifference(
      { [CI]: ci },
      /ci\.yml:20: \.jobs\.verify\.steps\[3\]\.env\.REF: an expression: \$\{\{ github\.ref \}\}/
    );
  });
  it("the index form github['event_name']", () => {
    expectDifference(
      { [CI]: ciWith("      - run: echo ${{ github['event_name'] }}") },
      /ci\.yml:18: .*an expression/
    );
  });
  it('an expression on a step output that follows the event', () => {
    const ci = ciWith(
      '      - run: bun run e2e',
      "        continue-on-error: ${{ steps.co.outputs.ref != 'refs/heads/main' }}"
    );
    expectDifference(
      { [CI]: ci },
      /ci\.yml:19: .*continue-on-error: an expression: \$\{\{ steps\.co\.outputs\.ref/
    );
  });
  it('the forgejo and forge aliases', () => {
    const ci = ciWith('      - run: echo ${{ forgejo.event_name }}', '      - run: echo ${{ forge.ref }}');
    expectDifference(
      { [CI]: ci },
      /ci\.yml:18: .*an expression: \$\{\{ forgejo\.event_name \}\}[\s\S]*ci\.yml:19: .*an expression: \$\{\{ forge\.ref \}\}/
    );
  });
  it('an expression split over lines', () => {
    const ci = ciWith('      - run: >-', '          echo ${{', '          github.event_name }}');
    expectDifference({ [CI]: ci }, /ci\.yml:18: .*an expression: \$\{\{ github\.event_name \}\}/);
  });
  it('an expression spelled with a YAML escape', () => {
    const ci = ciWith('      - run: "echo \\x24{{ github.event_name }}"');
    expectDifference({ [CI]: ci }, /ci\.yml:18: .*an expression: \$\{\{ github\.event_name \}\}/);
  });
  it('an expression in a key', () => {
    const ci = ciWith('      - run: echo key', '        env:', '          ${{ github.ref }}: x');
    expectDifference({ [CI]: ci }, /\(key\): an expression: \$\{\{ github\.ref \}\}/);
  });
  it('an expression in a file under .forgejo that is not a workflow, even on pull_request', () => {
    expectDifference(
      { '.forgejo/shared/env.yml': 'on: pull_request\nREF: ${{ github.ref }}\n' },
      /\.forgejo\/shared\/env\.yml:2: \.REF: an expression/
    );
  });
});

describe('check-push-repeats-pr allows github.ref only in the top-level concurrency.group', () => {
  it('github.ref in a job-level concurrency group', () => {
    const ci = edit(
      baseCi,
      '    runs-on:',
      '    concurrency:\n      group: job-${{ github.ref }}\n    runs-on:'
    );
    expectDifference(
      { [CI]: ci },
      /ci\.yml:13: \.jobs\.verify\.concurrency\.group: an expression: \$\{\{ github\.ref \}\}/
    );
  });
  it('github.ref in cancel-in-progress', () => {
    const ci = edit(baseCi, 'cancel-in-progress: true', 'cancel-in-progress: ${{ github.ref }}');
    expectDifference(
      { [CI]: ci },
      /ci\.yml:9: \.concurrency\.cancel-in-progress: an expression: \$\{\{ github\.ref \}\}/
    );
  });
  it('github.ref in the concurrency.group of a file under .forgejo that is not a workflow', () => {
    expectDifference(
      { '.forgejo/shared/x.yml': 'concurrency:\n  group: x-${{ github.ref }}\n' },
      /\.forgejo\/shared\/x\.yml:2: \.concurrency\.group: an expression: \$\{\{ github\.ref \}\}/
    );
  });
  it('the string form of concurrency', () => {
    const ci = edit(
      baseCi,
      'concurrency:\n  group: ci-${{ github.ref }}\n  cancel-in-progress: true',
      'concurrency: ci-${{ github.ref }}'
    );
    expectDifference({ [CI]: ci }, /ci\.yml:7: \.concurrency: an expression: \$\{\{ github\.ref \}\}/);
  });
  it('a key spelled concurrency.group', () => {
    const ci = edit(baseCi, 'jobs:', '"concurrency.group": x-${{ github.ref }}\njobs:');
    expectDifference({ [CI]: ci }, /ci\.yml:10: \.concurrency\.group: an expression/);
  });
  it('github.ref in the group beside another expression', () => {
    const ci = edit(baseCi, 'group: ci-${{ github.ref }}', 'group: ci-${{ github.ref }}-${{ github.ref }}');
    expectDifference(
      { [CI]: ci },
      /ci\.yml:8: \.concurrency\.group: an expression: \$\{\{ github\.ref \}\}\n.*ci\.yml:8: \.concurrency\.group: an expression: \$\{\{ github\.ref \}\}/
    );
  });
  it('another expression in the group', () => {
    const ci = edit(baseCi, 'group: ci-${{ github.ref }}', 'group: ci-${{ github.event_name }}');
    expectDifference(
      { [CI]: ci },
      /ci\.yml:8: \.concurrency\.group: an expression: \$\{\{ github\.event_name \}\}/
    );
  });
});

describe('check-push-repeats-pr finds code outside the workflow files', () => {
  it('an if: in a local action under .forgejo', () => {
    const action = "runs:\n  using: composite\n  steps:\n    - run: echo x\n      if: env.X == '1'\n";
    expectDifference(
      { '.forgejo/actions/setup/action.yml': action },
      /\.forgejo\/actions\/setup\/action\.yml:5: \.runs\.steps\[0\]\.if: an if:/
    );
  });
  it('a local action whose code reads a runner variable', () => {
    const ci = ciWith('      - uses: ./.forgejo/actions/gate');
    expectDifference(
      {
        [CI]: ci,
        '.forgejo/actions/gate/action.yml': "runs:\n  using: node20\n  main: index.js\n",
        '.forgejo/actions/gate/index.js': `if (process.env.${GH}EVENT_NAME === 'push') run();\n`
      },
      /\.forgejo\/actions\/gate\/index\.js:1:.*names a runner variable/
    );
  });
  it('an expression in an action.yaml outside .forgejo', () => {
    const action = 'runs:\n  using: composite\n  steps:\n    - run: echo ${{ github.event_name }}\n';
    expectDifference(
      { 'actions/setup/action.yaml': action },
      /actions\/setup\/action\.yaml:4: .*an expression/
    );
  });
  it('an if: in an action.yml outside .forgejo', () => {
    const action = "runs:\n  using: composite\n  steps:\n    - run: echo x\n      if: env.X == '1'\n";
    expectDifference(
      { 'actions/build/action.yml': action },
      /actions\/build\/action\.yml:5: \.runs\.steps\[0\]\.if: an if:/
    );
  });
  it('a workflow on push whose step reads a runner variable', () => {
    expectDifference(
      { [CI]: ciWith(`      - run: echo "$${GH}REF"`) },
      /\.forgejo\/workflows\/ci\.yml:18:.*names a runner variable/
    );
  });
  it('a workflow on push beside a pull_request-only one whose name is a glob that matches it', () => {
    expectDifference(
      { [CI]: ciWith(`      - run: echo "$${GH}REF"`), '.forgejo/workflows/[c]i.yml': baseFallow },
      /\.forgejo\/workflows\/ci\.yml:18:.*names a runner variable/
    );
  });
  it('a folder named like a pull_request-only workflow, holding a script that reads the ref', () => {
    // Git refuses such a tree from the working tree (fsck: duplicateEntries), but a runner checks
    // out the folder, so build it by hand.
    const rewrite = (git: Git) => {
      const pr = git(['hash-object', '-w', '--stdin'], baseFallow).trim();
      const sh = git(['hash-object', '-w', '--stdin'], `echo "$${GH}REF"\n`).trim();
      const folder = git(['mktree'], `100644 blob ${sh}\trun.sh\n`).trim();
      const entries = `100644 blob ${pr}\tx.yml\n040000 tree ${folder}\tx.yml\n`;
      const workflows = git(['mktree'], git(['ls-tree', 'HEAD:.forgejo/workflows']) + entries);
      const forgejo = git(['mktree'], `040000 tree ${workflows.trim()}\tworkflows\n`).trim();
      const top = git(['ls-tree', 'HEAD']).replace(/^.*\t\.forgejo\n/m, '');
      const tree = git(['mktree'], `${top}040000 tree ${forgejo}\t.forgejo\n`).trim();
      expect(git(['ls-tree', '-r', '--name-only', tree])).toMatch(/workflows\/x\.yml\n.*workflows\/x\.yml\/run\.sh/);
      return git([...AUTHOR, 'commit-tree', tree, '-p', 'HEAD', '-m', 'dup']).trim();
    };
    expectDifference(
      {},
      /\.forgejo\/workflows\/x\.yml\/run\.sh:1:.*names a runner variable/,
      { rewrite }
    );
  });
  it('two files of one name: a pull_request-only workflow, then a script that reads the ref', () => {
    const rewrite = (git: Git) => {
      const pr = git(['hash-object', '-w', '--stdin'], baseFallow).trim();
      const sh = git(['hash-object', '-w', '--stdin'], `echo "$${GH}REF"\n`).trim();
      const entries = `100644 blob ${pr}\tx.yml\n100644 blob ${sh}\tx.yml\n`;
      const workflows = git(['mktree'], git(['ls-tree', 'HEAD:.forgejo/workflows']) + entries);
      const forgejo = git(['mktree'], `040000 tree ${workflows.trim()}\tworkflows\n`).trim();
      const top = git(['ls-tree', 'HEAD']).replace(/^.*\t\.forgejo\n/m, '');
      const tree = git(['mktree'], `${top}040000 tree ${forgejo}\t.forgejo\n`).trim();
      expect(git(['ls-tree', '-r', '--name-only', tree])).toMatch(/workflows\/x\.yml\n.*workflows\/x\.yml\n/);
      return git([...AUTHOR, 'commit-tree', tree, '-p', 'HEAD', '-m', 'dup']).trim();
    };
    expectDifference({}, /: a file name the tree holds twice, which this script cannot read/, { rewrite });
  });
  it('a file name that is not UTF-8', () => {
    const rewrite = (git: Git, dir: string) => {
      const name = Buffer.concat([Buffer.from(join(dir, 'a')), Buffer.from([0xff]), Buffer.from('.sh')]);
      writeFileSync(name, `echo "$${GH}REF"\n`);
      git(['add', '-A']);
      git([...AUTHOR, 'commit', '-qm', 'latin-1 name']);
      return git(['rev-parse', 'HEAD']).trim();
    };
    expectDifference(
      {},
      /: a file name that is not UTF-8, which this script cannot read\n[\s\S]*a�\.sh: reads the event or names a runner variable/,
      { rewrite }
    );
  });
  it("a .MD file that reads the ref, when the caller sets GIT_ICASE_PATHSPECS", () => {
    expectDifference(
      { 'scripts/hook.MD': `echo "$${GH}REF"\n` },
      /scripts\/hook\.MD:1:.*names a runner variable/,
      { env: { GIT_ICASE_PATHSPECS: '1' } }
    );
  });
  it('an action.yml under .forgejo/workflows that names pull_request alone', () => {
    const action = [
      'on: pull_request',
      'runs:',
      '  using: composite',
      '  steps:',
      `    - run: echo "$${GH}REF"`,
      "      if: github.event_name == 'push'"
    ].join('\n');
    expectDifference(
      { [CI]: ciWith('      - uses: ./.forgejo/workflows/act'), '.forgejo/workflows/act/action.yml': action },
      /act\/action\.yml:6: \.runs\.steps\[0\]\.if: an if:[\s\S]*act\/action\.yml:5:.*names a runner variable/
    );
  });
  it('a script that reads the ref from the runner', () => {
    expectDifference(
      { 'scripts/build.sh': `echo build\necho "$${GH}REF"\n` },
      /scripts\/build\.sh:2:.*names a runner variable/
    );
  });
  it('a module that reads the forgejo and forge variable names', () => {
    const env = `export const ref = process.env.${FJ}REF;\nexport const e = process.env.${FG}EVENT_NAME;\n`;
    expectDifference(
      { 'src/env.ts': env },
      /src\/env\.ts:1:.*names a runner variable[\s\S]*src\/env\.ts:2:.*names a runner variable/
    );
  });
  it('a binary file that holds a runner variable name', () => {
    expectDifference(
      { 'bin/tool': `\0\x01${GH}REF\0` },
      /bin\/tool matches: reads the event or names a runner variable/
    );
  });
  it("a script that loads the actions toolkit's github module", () => {
    expectDifference(
      { '.forgejo/scripts/gate.js': `const { context } = require('${LIB}');\n` },
      /\.forgejo\/scripts\/gate\.js:1:.*reads the event/
    );
  });
  it("a module that reads the toolkit context's event property", () => {
    expectDifference(
      { 'src/gate.ts': `export const onPush = (c: { ${EV}: string }) => c.${EV} === 'push';\n` },
      /src\/gate\.ts:1:.*reads the event/
    );
  });
  it('a step that uses actions/github-script', () => {
    const ci = ciWith('      - uses: actions/github-script@v7', '        with:', "          script: core.info('hi')");
    expectDifference(
      { [CI]: ci },
      /ci\.yml:18: \.jobs\.verify\.steps\[3\]\.uses: runs code that gets the event: actions\/github-script@v7/
    );
  });
});

it('the script and this test hold none of the names they search for, so the script reads both', () => {
  const names = new RegExp([GH, FJ, FG, LIB, EV].join('|'));
  for (const file of [SCRIPT, fileURLToPath(import.meta.url)]) {
    expect(readFileSync(file, 'utf8')).not.toMatch(names);
  }
});

describe('check-push-repeats-pr exits 2', () => {
  it('on a SHA the repo lacks', () => {
    const dir = join(root, 'nosha');
    mkdirSync(dir);
    run('git', ['init', '-q', '-b', 'main'], dir);
    const { exitCode, out } = run('bun', [SCRIPT, '0123456789abcdef0123456789abcdef01234567'], dir);
    expect(out).toMatch(/unknown commit/);
    expect(exitCode).toBe(2);
  });
  it('outside a git repo', () => {
    const dir = join(root, 'nogit');
    mkdirSync(dir);
    const { exitCode, out } = run('bun', [SCRIPT, 'HEAD'], dir);
    expect(out).toMatch(/git rev-parse --show-toplevel failed/);
    expect(exitCode).toBe(2);
  });
  it('without a SHA', () => {
    const { exitCode, out } = run('bun', [SCRIPT], root);
    expect(out).toMatch(/usage: bun scripts\/check-push-repeats-pr\.ts <pushed SHA>/);
    expect(exitCode).toBe(2);
  });
  it('when the yaml package is missing', () => {
    const copyDir = join(root, 'noyaml');
    mkdirSync(copyDir);
    const copy = join(copyDir, 'check.ts');
    copyFileSync(SCRIPT, copy);
    // --no-install stops Bun from fetching the package itself where no node_modules is found.
    const { exitCode, out } = check({}, { script: copy, bunArgs: ['--no-install'] });
    expect(out).toMatch(/cannot load the yaml package; run bun install first/);
    expect(exitCode).toBe(2);
  });
});
