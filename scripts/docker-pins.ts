// Reads the Bun and Node tags of the production Dockerfile and lists each place where they break
// the pins. tests/scripts/docker-pins.test.ts compares the Bun tags with package.json's
// packageManager, and tests/node-pins.test.ts compares the Node tag with .nvmrc, so CI's unit
// test step fails while they differ. Ported from garde-manger's scripts/bun-pins.ts.
//
// No region of a Dockerfile can be read exactly without copying BuildKit's parser. The reader
// does not copy it. It accepts only the forms the Dockerfile uses today and reports every other
// form as a problem, naming its line:
//   1. Only printable ASCII, spaces and LF line ends (no CR, tab, byte order mark, Unicode space).
//   2. No line ends in `\` or a backtick before trailing spaces, so no line continues another.
//   3. No line contains `<<`, so no heredoc body reads as an instruction.
//   4. No comment line has the form of a parser directive (`# name=value`), and no line starts
//      with `//`, which BuildKit also reads as one (`//syntax=<image>`).
//   5. Each non-comment line whose first word is FROM, in any case, is exactly
//      `FROM oven/bun:<x.y.z> AS <name>`, `FROM node:<major>-slim AS <name>` or
//      `FROM oven/bun:<x.y.z>-slim`. The file holds exactly one of each, in that order, and the
//      two names differ.
//   6. Any other non-comment line holding `oven/bun`, `node:`, or `from` in any case, fails,
//      except `COPY --from=<name> <rest>` after the stage called <name>, where <rest> holds
//      none of them.
//   7. package.json's `packageManager` is a string `bun@<x.y.z>` and nothing else.
//   8. Both oven/bun tags name the `packageManager` version.
//   9. No non-comment line holds a backslash, and only a `CMD [` line holds a quote. BuildKit
//      strips quotes and backslashes from an instruction's flags, so `COPY --fr"o"m=` is a
//      `--from` that rule 6 would not see.
// Add a test to tests/scripts/docker-pins.test.ts for each form this reader learns to accept or
// reject.

type BunPins = { version: string } | { problems: string[] };
type Stage = { line: number; tag: string; name?: string };
type StageKey = 'bun' | 'build' | 'runtime';
type DockerfilePins = Partial<Record<StageKey, Stage>> & { problems: string[] };

const VERSION = '[0-9]+\\.[0-9]+\\.[0-9]+';
const NAME = '[a-z][a-z0-9_.-]*';
const FORMS = '"FROM oven/bun:<x.y.z> AS <name>", "FROM node:<major>-slim AS <name>" or "FROM oven/bun:<x.y.z>-slim"';
// In file order: the tag of each stage is the pattern's first group, its name the second.
const STAGES: { key: StageKey; form: string; pattern: RegExp }[] = [
  { key: 'bun', form: 'FROM oven/bun:<x.y.z> AS <name>', pattern: new RegExp(`^FROM oven/bun:(${VERSION}) AS (${NAME})$`) },
  { key: 'build', form: 'FROM node:<major>-slim AS <name>', pattern: new RegExp(`^FROM node:([0-9]+)-slim AS (${NAME})$`) },
  { key: 'runtime', form: 'FROM oven/bun:<x.y.z>-slim', pattern: new RegExp(`^FROM oven/bun:(${VERSION})-slim$`) }
];
const PACKAGE_MANAGER = new RegExp(`^bun@(${VERSION})$`);

function readLineForm(text: string, at: string, shown: string, problems: string[]): void {
  // Rule 1.
  const odd = text.match(/[^\x20-\x7e]/);
  if (odd) {
    const code = odd[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
    problems.push(
      `${at}: character U+${code} at column ${odd.index! + 1} of ${shown}; the Dockerfile may hold only printable ASCII, spaces and LF line ends`
    );
  }
  // Rule 2.
  if (/[\\`] *$/.test(text)) problems.push(`${at}: ${shown} ends in a line continuation (\\ or \`)`);
  // Rule 3.
  if (text.includes('<<')) problems.push(`${at}: ${shown} holds a heredoc (<<)`);
  // Rule 4, for a `//` line: BuildKit reads `//syntax=<image>` as the frontend to build with.
  if (/^ *\/\//.test(text)) {
    problems.push(`${at}: ${shown} starts with //, which BuildKit reads as a parser directive`);
  }
}

// Rule 5.
function readFrom(text: string, index: number, found: DockerfilePins): void {
  const at = `Dockerfile line ${index + 1}`;
  const shown = JSON.stringify(text);
  const order = STAGES.findIndex((stage) => stage.pattern.test(text));
  if (order < 0) {
    found.problems.push(`${at}: ${shown} is not ${FORMS}`);
    return;
  }
  const { key, pattern } = STAGES[order];
  const first = found[key];
  if (first) {
    found.problems.push(`${at}: a second ${key} stage ${shown}; line ${first.line} has the first`);
    return;
  }
  const later = STAGES.slice(order + 1).find((stage) => found[stage.key]);
  if (later) {
    found.problems.push(`${at}: the ${key} stage ${shown} follows the ${later.key} stage on line ${found[later.key]!.line}`);
    return;
  }
  const [, tag, name] = text.match(pattern)!;
  if (name && found.bun?.name === name) {
    found.problems.push(`${at}: ${shown} reuses the stage name on line ${found.bun.line}`);
  }
  found[key] = { line: index + 1, tag, name };
}

// Rule 6.
function readOtherLine(text: string, at: string, shown: string, found: DockerfilePins): void {
  let rest = text;
  const copy = text.match(/^COPY --from=(\S+) /);
  if (copy && (copy[1] === found.bun?.name || copy[1] === found.build?.name)) rest = text.slice(copy[0].length);
  if (/from|oven\/bun|node:/i.test(rest)) {
    found.problems.push(`${at}: ${shown} names oven/bun, node: or "from" outside the three FROM lines and a COPY --from=<stage>`);
  }
}

export function readDockerfilePins(dockerfile: string): DockerfilePins {
  const found: DockerfilePins = { problems: [] };
  dockerfile.split('\n').forEach((text, index) => {
    const at = `Dockerfile line ${index + 1}`;
    const shown = JSON.stringify(text);
    readLineForm(text, at, shown, found.problems);

    if (/^ *#/.test(text)) {
      // Rule 4.
      if (/^ *# *[A-Za-z][A-Za-z0-9]* *=/.test(text)) {
        found.problems.push(`${at}: ${shown} has the form of a parser directive (# name=value)`);
      }
      return;
    }

    // Rule 9.
    if (text.includes('\\') || (/["']/.test(text) && !text.startsWith('CMD ['))) {
      found.problems.push(`${at}: ${shown} holds a backslash, or a quote outside a CMD [...] line, which BuildKit strips from flags`);
    }

    if (text.replace(/^ +/, '').split(' ')[0].toUpperCase() === 'FROM') readFrom(text, index, found);
    else readOtherLine(text, at, shown, found);
  });
  for (const { key, form } of STAGES) {
    if (!found[key]) found.problems.push(`Dockerfile: no ${key} stage "${form}"`);
  }
  return found;
}

// Rule 7.
function readPackageManager(packageJson: string, problems: string[]): string | undefined {
  let pkg: unknown;
  try {
    pkg = JSON.parse(packageJson);
  } catch (error) {
    problems.push(`package.json: not JSON (${(error as Error).message})`);
    return undefined;
  }
  if (typeof pkg !== 'object' || pkg === null || Array.isArray(pkg)) {
    problems.push(`package.json: ${JSON.stringify(pkg)} is not a JSON object`);
    return undefined;
  }
  const field = (pkg as Record<string, unknown>).packageManager;
  const match = typeof field === 'string' ? field.match(PACKAGE_MANAGER) : null;
  if (!match) problems.push(`package.json: packageManager is ${JSON.stringify(field) ?? 'missing'}, not "bun@<x.y.z>"`);
  return match?.[1];
}

export function readBunPins(dockerfile: string, packageJson: string): BunPins {
  const found = readDockerfilePins(dockerfile);
  const problems = [...found.problems];
  const pin = readPackageManager(packageJson, problems);

  // Rule 8.
  if (pin !== undefined) {
    for (const key of ['bun', 'runtime'] as const) {
      const stage = found[key];
      if (stage && stage.tag !== pin) {
        problems.push(
          `Dockerfile line ${stage.line}: the ${key} stage's oven/bun tag names Bun ${stage.tag}, but package.json's packageManager is bun@${pin}`
        );
      }
    }
  }
  return problems.length === 0 && pin !== undefined ? { version: pin } : { problems };
}
