import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Three files pin Node (#95): .nvmrc (CI's setup-node and railpack read it), the @types/node
// range in package.json and the dev shell's nodejs_<major> in flake.nix. Renovate opens no
// PR for .nvmrc, so a new Node major arrives as an @types/node major PR alone: this check
// fails that PR until .nvmrc and flake.nix name the same major. It has no skip switch.

type PinFiles = { nvmrc: string; packageJson: string; flakeNix: string };
type PinCheck = { major: number } | { problems: string[] };
type Pin = { where: string; read: string; major: number };
type PackageJson = Record<string, Record<string, unknown> | undefined>;

// One major, as an npm range: 26, v26, 26.x, 26.13.0, ^26.6.6, ~26.1.0. A range that spans
// majors (>=24, ^24 || ^26) or names none (*, latest) does not match. sutom's
// check-node-pins.sh uses the same pattern.
const ONE_MAJOR = /^[~^]?v?(\d+)(\.(\d+|[xX*])){0,2}(-[0-9A-Za-z.-]+)?$/;

// One version line and nothing else: 26, v26 or 26.13.0, with an optional trailing newline.
const NVMRC_VERSION = /^v?(\d+)(\.\d+){0,2}(\r?\n)?$/;

// Every nodejs_<major> in the file counts, comments included: a second major anywhere fails.
const FLAKE_NODE = /\bnodejs_(\d+)\b/g;

function readNvmrc(text: string, pins: Pin[], problems: string[]): void {
  const match = NVMRC_VERSION.exec(text);
  if (match) pins.push({ where: '.nvmrc', read: text.trim(), major: Number(match[1]) });
  else problems.push(`.nvmrc ${JSON.stringify(text)} is not one Node version line such as 26, v26 or 26.13.0`);
}

function readRange(where: string, value: unknown, pins: Pin[], problems: string[]): void {
  const match = typeof value === 'string' ? ONE_MAJOR.exec(value) : null;
  if (match) pins.push({ where, read: value as string, major: Number(match[1]) });
  else problems.push(`${where} ${JSON.stringify(value)} does not name one Node major`);
}

function parseObject(text: string): PackageJson | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as PackageJson) : undefined;
  } catch {
    return undefined;
  }
}

function readPackageJson(text: string, pins: Pin[], problems: string[]): void {
  const pkg = parseObject(text);
  if (!pkg) {
    problems.push('package.json is not a JSON object');
    return;
  }
  // railpack reads engines.node before .nvmrc, so a present one must agree.
  if (pkg.engines?.node !== undefined) {
    readRange('package.json engines.node', pkg.engines.node, pins, problems);
  }
  const keys = ['devDependencies', 'dependencies'].filter((key) => pkg[key]?.['@types/node'] !== undefined);
  if (keys.length === 0) problems.push('package.json has no @types/node in devDependencies or dependencies');
  for (const key of keys) readRange(`package.json ${key} @types/node`, pkg[key]?.['@types/node'], pins, problems);
}

function readFlakeNix(text: string, pins: Pin[], problems: string[]): void {
  const names = [...new Set([...text.matchAll(FLAKE_NODE)].map((match) => match[0]))];
  const majors = new Set(names.map((name) => Number(name.slice('nodejs_'.length))));
  if (names.length === 0) problems.push('flake.nix names no nodejs_<major> package');
  else if (majors.size > 1) problems.push(`flake.nix names more than one Node major: ${names.join(', ')}`);
  else pins.push({ where: 'flake.nix', read: names[0], major: [...majors][0] });
}

function checkNodePins(files: PinFiles): PinCheck {
  const pins: Pin[] = [];
  const problems: string[] = [];
  readNvmrc(files.nvmrc, pins, problems);
  readPackageJson(files.packageJson, pins, problems);
  readFlakeNix(files.flakeNix, pins, problems);
  if (new Set(pins.map((pin) => pin.major)).size > 1) {
    const list = pins.map((pin) => `${pin.where} ${JSON.stringify(pin.read)} is ${pin.major}`);
    problems.push(`the Node majors differ: ${list.join('; ')}`);
  }
  return problems.length > 0 ? { problems } : { major: pins[0].major };
}

const NVMRC = '26\n';
const FLAKE = 'devShells.x86_64-linux.default = pkgs.mkShell {\n  packages = with pkgs; [ nodejs_26 bun ];\n};\n';

function packageJson(fields: Record<string, unknown> = {}): string {
  return JSON.stringify({ devDependencies: { '@types/node': '^26.6.6' }, ...fields });
}

function check(overrides: Partial<PinFiles>): PinCheck {
  return checkNodePins({ nvmrc: NVMRC, packageJson: packageJson(), flakeNix: FLAKE, ...overrides });
}

function problemsOf(result: PinCheck): string[] {
  return 'problems' in result ? result.problems : [];
}

describe('Node pins name one major', () => {
  it("passes on the repo's own .nvmrc, package.json and flake.nix", () => {
    const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const result = checkNodePins({
      nvmrc: read('.nvmrc'),
      packageJson: read('package.json'),
      flakeNix: read('flake.nix')
    });
    expect(result).toEqual({ major: expect.any(Number) });
  });

  describe('accepted forms', () => {
    it.each(['26', '26\n', 'v26\n', '26.13.0\n', '26.13\r\n'])('.nvmrc %j', (nvmrc) => {
      expect(check({ nvmrc })).toEqual({ major: 26 });
    });

    it.each(['^26.6.6', '~26.1.0', '26.x', '26', '26.*', '26.0.0-rc.1'])('@types/node %j', (range) => {
      const pkg = packageJson({ devDependencies: { '@types/node': range } });
      expect(check({ packageJson: pkg })).toEqual({ major: 26 });
    });

    it('@types/node in dependencies', () => {
      const pkg = JSON.stringify({ dependencies: { '@types/node': '^26.1.0' } });
      expect(check({ packageJson: pkg })).toEqual({ major: 26 });
    });

    it('engines.node absent, or present on the same major', () => {
      expect(check({ packageJson: packageJson({ engines: { bun: '>=1.1.0' } }) })).toEqual({ major: 26 });
      expect(check({ packageJson: packageJson({ engines: { node: '26.x' } }) })).toEqual({ major: 26 });
    });

    it('flake.nix naming the same nodejs_<major> twice', () => {
      expect(check({ flakeNix: `${FLAKE}# nodejs_26 also builds the site\n` })).toEqual({ major: 26 });
    });
  });

  describe('different majors', () => {
    it('.nvmrc names another major', () => {
      expect(problemsOf(check({ nvmrc: '24\n' }))).toEqual([
        'the Node majors differ: .nvmrc "24" is 24; package.json devDependencies @types/node "^26.6.6" is 26; flake.nix "nodejs_26" is 26'
      ]);
    });

    it('@types/node names another major', () => {
      const pkg = packageJson({ devDependencies: { '@types/node': '^27.0.1' } });
      expect(problemsOf(check({ packageJson: pkg }))).toEqual([
        'the Node majors differ: .nvmrc "26" is 26; package.json devDependencies @types/node "^27.0.1" is 27; flake.nix "nodejs_26" is 26'
      ]);
    });

    it('flake.nix names another major', () => {
      expect(problemsOf(check({ flakeNix: FLAKE.replace('nodejs_26', 'nodejs_24') }))).toEqual([
        'the Node majors differ: .nvmrc "26" is 26; package.json devDependencies @types/node "^26.6.6" is 26; flake.nix "nodejs_24" is 24'
      ]);
    });

    it('engines.node names another major', () => {
      const pkg = packageJson({ engines: { node: '^24.12.0' } });
      expect(problemsOf(check({ packageJson: pkg }))).toEqual([
        'the Node majors differ: .nvmrc "26" is 26; package.json engines.node "^24.12.0" is 24; package.json devDependencies @types/node "^26.6.6" is 26; flake.nix "nodejs_26" is 26'
      ]);
    });
  });

  describe('unreadable pins', () => {
    it.each([
      ['an alias', 'lts/*\n'],
      ['the node alias', 'node\n'],
      ['a second line', '26\n24\n'],
      ['a comment', '26 # Node 26\n'],
      ['an empty file', '']
    ])('.nvmrc with %s', (_name, nvmrc) => {
      expect(problemsOf(check({ nvmrc }))).toEqual([
        `.nvmrc ${JSON.stringify(nvmrc)} is not one Node version line such as 26, v26 or 26.13.0`
      ]);
    });

    it('@types/node missing', () => {
      const pkg = JSON.stringify({ devDependencies: { vite: '^8.3.5' } });
      expect(problemsOf(check({ packageJson: pkg }))).toEqual([
        'package.json has no @types/node in devDependencies or dependencies'
      ]);
    });

    it.each(['>=24', '*', 'latest', '^24 || ^26', '24 - 26', ''])('@types/node %j', (range) => {
      const pkg = packageJson({ devDependencies: { '@types/node': range } });
      expect(problemsOf(check({ packageJson: pkg }))).toEqual([
        `package.json devDependencies @types/node ${JSON.stringify(range)} does not name one Node major`
      ]);
    });

    it('@types/node or engines.node that is not a string', () => {
      const pkg = packageJson({ engines: { node: 26 }, dependencies: { '@types/node': null } });
      expect(problemsOf(check({ packageJson: pkg }))).toEqual([
        'package.json engines.node 26 does not name one Node major',
        'package.json dependencies @types/node null does not name one Node major'
      ]);
    });

    it.each(['{ "devDependencies": ', 'null', '[]'])('package.json %j', (text) => {
      expect(problemsOf(check({ packageJson: text }))).toEqual(['package.json is not a JSON object']);
    });

    it('flake.nix with no nodejs_<major>', () => {
      expect(problemsOf(check({ flakeNix: FLAKE.replace('nodejs_26', 'nodejs') }))).toEqual([
        'flake.nix names no nodejs_<major> package'
      ]);
    });

    it('flake.nix with two different majors', () => {
      expect(problemsOf(check({ flakeNix: FLAKE.replace('nodejs_26', 'nodejs_24 nodejs_26') }))).toEqual([
        'flake.nix names more than one Node major: nodejs_24, nodejs_26'
      ]);
    });
  });
});
