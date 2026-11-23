import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readBunPins, readDockerfilePins } from '../../scripts/docker-pins';

const repoFile = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

// The Dockerfile's shape with its tags on 1.4.4 and Node 26. The test "reads the repo's own
// Dockerfile" reads today's file. Each failure-class test edits one line.
const DOCKERFILE = [
  'FROM oven/bun:1.4.4 AS bun', // 1
  '',
  'FROM node:26-slim AS build', // 3
  'COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun', // 4
  'WORKDIR /app',
  'COPY package.json bun.lock .npmrc ./', // 6
  'RUN bun install --frozen-lockfile',
  'COPY . .',
  'RUN bun run pregen && bun run build', // 9
  '',
  'FROM oven/bun:1.4.4-slim', // 11
  'WORKDIR /app',
  'ENV NODE_ENV=production', // 13
  'ARG APT_REFRESH=2026-11-23',
  'RUN echo Debian packages refreshed ${APT_REFRESH} && apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*', // 15
  'COPY --from=build /app/build ./build', // 16
  'COPY --from=build /app/serve.js ./',
  'EXPOSE 3000', // 18
  'CMD ["bun", "serve.js"]', // 19
  ''
].join('\n');
const PACKAGE = JSON.stringify({ name: 'multilogic', packageManager: 'bun@1.4.4' });
const FORMS = '"FROM oven/bun:<x.y.z> AS <name>", "FROM node:<major>-slim AS <name>" or "FROM oven/bun:<x.y.z>-slim"';

/** DOCKERFILE with its 1-based line `line` replaced by `text` (several lines when it holds \n). */
function withLine(line: number, text: string): string {
  const lines = DOCKERFILE.split('\n');
  lines[line - 1] = text;
  return lines.join('\n');
}

/** DOCKERFILE with `text` inserted before its 1-based line `line`. */
function insertBefore(line: number, text: string): string {
  const lines = DOCKERFILE.split('\n');
  lines.splice(line - 1, 0, text);
  return lines.join('\n');
}

function problems(dockerfile: string, packageJson = PACKAGE): string[] {
  const result = readBunPins(dockerfile, packageJson);
  if (!('problems' in result)) throw new Error(`expected problems, read ${result.version}`);
  return result.problems;
}

function pm(packageManager: unknown): string {
  return JSON.stringify({ name: 'multilogic', packageManager });
}

function notAForm(line: number, text: string, where: string): string {
  return `Dockerfile line ${line}: ${JSON.stringify(text)} is not an instruction form read ${where}; scripts/docker-pins.ts reads only the forms the Dockerfile uses today`;
}

describe('readBunPins', () => {
  it("reads the repo's own Dockerfile and package.json as one version", () => {
    const packageJson = repoFile('package.json');
    const pinned = (JSON.parse(packageJson) as { packageManager: string }).packageManager;
    expect(readBunPins(repoFile('Dockerfile'), packageJson)).toEqual({ version: pinned.replace(/^bun@/, '') });
  });

  it('reads the fixture as one version', () => {
    expect(readBunPins(DOCKERFILE, PACKAGE)).toEqual({ version: '1.4.4' });
  });

  it('reads each stage with its line, tag and name', () => {
    expect(readDockerfilePins(DOCKERFILE)).toEqual({
      bun: { line: 1, tag: '1.4.4', name: 'bun' },
      build: { line: 3, tag: '26', name: 'build' },
      runtime: { line: 11, tag: '1.4.4', name: undefined },
      problems: []
    });
  });

  it('skips comment lines, a plain comment with a later = included', () => {
    const dockerfile = insertBefore(1, '# FROM oven/bun:9.9.9 AS bun, see a=b');
    expect(readBunPins(dockerfile, PACKAGE)).toEqual({ version: '1.4.4' });
  });

  describe('rule 8: both oven/bun tags name the packageManager version', () => {
    it('fails when the bun stage tag differs', () => {
      expect(problems(withLine(1, 'FROM oven/bun:1.4.3 AS bun'))).toEqual([
        "Dockerfile line 1: the bun stage's oven/bun tag names Bun 1.4.3, but package.json's packageManager is bun@1.4.4"
      ]);
    });

    it('fails when the runtime tag differs', () => {
      expect(problems(withLine(11, 'FROM oven/bun:1.4.5-slim'))).toEqual([
        "Dockerfile line 11: the runtime stage's oven/bun tag names Bun 1.4.5, but package.json's packageManager is bun@1.4.4"
      ]);
    });

    it('fails on both lines when packageManager differs from both tags', () => {
      expect(problems(DOCKERFILE, pm('bun@1.5.0'))).toEqual([
        "Dockerfile line 1: the bun stage's oven/bun tag names Bun 1.4.4, but package.json's packageManager is bun@1.5.0",
        "Dockerfile line 11: the runtime stage's oven/bun tag names Bun 1.4.4, but package.json's packageManager is bun@1.5.0"
      ]);
    });
  });

  describe('rule 7: packageManager is a plain bun@x.y.z', () => {
    it.each([
      ['missing', JSON.stringify({ name: 'multilogic' }), 'missing'],
      ['a range', pm('bun@^1.4.4'), '"bun@^1.4.4"'],
      ['with a +sha512 suffix', pm('bun@1.4.4+sha512.abc'), '"bun@1.4.4+sha512.abc"'],
      ['another manager', pm('npm@1.4.4'), '"npm@1.4.4"'],
      ['two parts', pm('bun@1.4'), '"bun@1.4"'],
      ['prefixed', pm('xbun@1.4.4'), '"xbun@1.4.4"'],
      ['not a string', pm(144), '144']
    ])('fails when packageManager is %s', (_, packageJson, shown) => {
      expect(problems(DOCKERFILE, packageJson)).toEqual([`package.json: packageManager is ${shown}, not "bun@<x.y.z>"`]);
    });

    it('fails when package.json is not JSON', () => {
      const found = problems(DOCKERFILE, '{"packageManager": "bun@1.4.4",}');
      expect(found).toHaveLength(1);
      expect(found[0].startsWith('package.json: not JSON (')).toBe(true);
    });

    it.each(['null', '[]', '"bun@1.4.4"'])('fails when package.json is %s', (packageJson) => {
      expect(problems(DOCKERFILE, packageJson)).toEqual([`package.json: ${packageJson} is not a JSON object`]);
    });
  });

  describe('rule 1: printable ASCII, spaces and LF line ends only', () => {
    it.each([
      ['a CR line end', withLine(1, 'FROM oven/bun:1.4.4 AS bun\r'), 1, '000D', 27],
      ['a tab', withLine(5, 'WORKDIR\t/app'), 5, '0009', 8],
      ['a byte order mark', '﻿' + DOCKERFILE, 1, 'FEFF', 1],
      ['a non-breaking space before FROM', withLine(11, ' FROM oven/bun:1.4.4-slim'), 11, '00A0', 1],
      ['a DEL', withLine(13, 'ENV NODE_ENV=production\x7f'), 13, '007F', 24],
      ['a control character', withLine(18, 'EXPOSE\x0b3000'), 18, '000B', 7],
      ['a line separator', withLine(18, 'EXPOSE 3000'), 18, '2028', 7]
    ])('fails on %s', (_, dockerfile, line, code, column) => {
      expect(problems(dockerfile)).toContainEqual(
        expect.stringMatching(new RegExp(`^Dockerfile line ${line}: character U\\+${code} at column ${column} of `))
      );
    });
  });

  describe('rule 2: no line continuation', () => {
    it.each([
      ['a backslash splitting FROM', withLine(11, 'FR\\\nOM oven/bun:1.4.4-slim'), 11],
      ['a backtick', withLine(7, 'RUN bun install `\n  --frozen-lockfile'), 7],
      ['a backslash before trailing spaces', withLine(9, 'RUN bun run build \\  '), 9],
      ['a backtick before trailing spaces', withLine(9, 'RUN bun run build `  '), 9]
    ])('fails on %s', (_, dockerfile, line) => {
      expect(problems(dockerfile)).toContainEqual(
        expect.stringMatching(new RegExp(`^Dockerfile line ${line}: .* ends in a line continuation`))
      );
    });
  });

  it('rule 3: fails on a heredoc', () => {
    const dockerfile = withLine(9, 'RUN <<EOF\nbun run build\nEOF');
    expect(problems(dockerfile)).toContainEqual('Dockerfile line 9: "RUN <<EOF" holds a heredoc (<<)');
  });

  describe('rule 4: no parser directive', () => {
    it.each(['# escape=`', '#syntax=docker/dockerfile:1', '# escape = \\', ' # check=skip=all', '# SYNTAX=docker/dockerfile:1'])(
      'fails on %s',
      (directive) => {
        expect(problems(insertBefore(1, directive))).toContainEqual(
          `Dockerfile line 1: ${JSON.stringify(directive)} has the form of a parser directive (# name=value)`
        );
      }
    );

    it.each(['//syntax=example/frontend:1', '// syntax = example/frontend:1', ' //x'])('fails on %s', (directive) => {
      expect(problems(insertBefore(1, directive))).toContainEqual(
        `Dockerfile line 1: ${JSON.stringify(directive)} starts with //, which BuildKit reads as a parser directive`
      );
    });

    it('fails on //syntax= after a shebang line', () => {
      const dockerfile = '#!/usr/bin/env buildctl\n//syntax=example/frontend:1\n' + DOCKERFILE;
      expect(problems(dockerfile)).toContainEqual(
        'Dockerfile line 2: "//syntax=example/frontend:1" starts with //, which BuildKit reads as a parser directive'
      );
    });
  });

  describe('rule 5: three FROM lines of the forms read today', () => {
    it.each([
      [1, 'lowercase from', 'from oven/bun:1.4.4 AS bun'],
      [1, 'a leading space', ' FROM oven/bun:1.4.4 AS bun'],
      [1, '--platform=', 'FROM --platform=linux/amd64 oven/bun:1.4.4 AS bun'],
      [1, 'a docker.io/ prefix', 'FROM docker.io/oven/bun:1.4.4 AS bun'],
      [1, 'a digest', 'FROM oven/bun:1.4.4@sha256:0123abcd AS bun'],
      [1, 'an untagged image', 'FROM oven/bun AS bun'],
      [1, 'a ${...} image', 'FROM ${BUN_IMAGE} AS bun'],
      [1, 'another image', 'FROM debian:13 AS bun'],
      [1, 'a trailing space', 'FROM oven/bun:1.4.4 AS bun '],
      [1, 'a double space', 'FROM  oven/bun:1.4.4 AS bun'],
      [1, 'lowercase as', 'FROM oven/bun:1.4.4 as bun'],
      [1, 'a two-part version', 'FROM oven/bun:1.4 AS bun'],
      [1, 'a four-part version', 'FROM oven/bun:1.4.4.1 AS bun'],
      [1, 'an -alpine tag', 'FROM oven/bun:1.4.4-alpine AS bun'],
      [1, 'an uppercase stage name', 'FROM oven/bun:1.4.4 AS Bun'],
      [1, 'an inline comment', 'FROM oven/bun:1.4.4 AS bun # pinned'],
      [3, 'a full Node version', 'FROM node:26.13.0-slim AS build'],
      [3, 'a Node tag without -slim', 'FROM node:26 AS build'],
      [3, 'a Node -alpine tag', 'FROM node:26-alpine AS build'],
      [3, 'a Node codename', 'FROM node:lts-slim AS build'],
      [3, 'a Node digest', 'FROM node:26-slim@sha256:0123abcd AS build'],
      [3, 'a Node stage without a name', 'FROM node:26-slim'],
      [3, 'a build stage from the bun stage', 'FROM bun AS build'],
      [11, 'a runtime line with a leading space', ' FROM oven/bun:1.4.4-slim'],
      [11, 'a -slim tag with a stage name', 'FROM oven/bun:1.4.4-slim AS runtime'],
      [11, 'a runtime -alpine tag', 'FROM oven/bun:1.4.4-alpine']
    ])('fails on line %i with %s', (line, _, from) => {
      expect(problems(withLine(line, from))).toContainEqual(
        `Dockerfile line ${line}: ${JSON.stringify(from)} is not ${FORMS}`
      );
    });

    it('fails on a second bun stage', () => {
      expect(problems(insertBefore(2, 'FROM oven/bun:1.4.4 AS test'))).toEqual([
        'Dockerfile line 2: a second bun stage "FROM oven/bun:1.4.4 AS test"; line 1 has the first'
      ]);
    });

    it('fails on a second Node stage', () => {
      expect(problems(insertBefore(5, 'FROM node:24-slim AS other'))).toEqual([
        'Dockerfile line 5: a second build stage "FROM node:24-slim AS other"; line 3 has the first'
      ]);
    });

    it('fails on a second runtime stage', () => {
      expect(problems(withLine(20, 'FROM oven/bun:1.4.4-slim'))).toEqual([
        'Dockerfile line 20: a second runtime stage "FROM oven/bun:1.4.4-slim"; line 11 has the first'
      ]);
    });

    it('fails on the Node stage before the bun stage', () => {
      expect(problems('FROM node:26-slim AS build\nFROM oven/bun:1.4.4 AS bun\nFROM oven/bun:1.4.4-slim\n')).toContainEqual(
        'Dockerfile line 2: the bun stage "FROM oven/bun:1.4.4 AS bun" follows the build stage on line 1'
      );
    });

    it('fails on the runtime stage before the Node stage', () => {
      expect(problems('FROM oven/bun:1.4.4 AS bun\nFROM oven/bun:1.4.4-slim\nFROM node:26-slim AS build\n')).toContainEqual(
        'Dockerfile line 3: the build stage "FROM node:26-slim AS build" follows the runtime stage on line 2'
      );
    });

    it('fails on the runtime stage before the bun stage', () => {
      expect(problems('FROM oven/bun:1.4.4-slim\nFROM oven/bun:1.4.4 AS bun\nFROM node:26-slim AS build\n')).toContainEqual(
        'Dockerfile line 2: the bun stage "FROM oven/bun:1.4.4 AS bun" follows the runtime stage on line 1'
      );
    });

    it('fails when the bun and Node stages share a name', () => {
      const dockerfile = withLine(3, 'FROM node:26-slim AS bun');
      expect(problems(dockerfile)).toContainEqual(
        'Dockerfile line 3: "FROM node:26-slim AS bun" reuses the stage name on line 1'
      );
    });

    it.each([
      [1, 'bun', 'FROM oven/bun:<x.y.z> AS <name>'],
      [3, 'build', 'FROM node:<major>-slim AS <name>'],
      [11, 'runtime', 'FROM oven/bun:<x.y.z>-slim']
    ])('fails when line %i, the %s stage, is missing', (line, key, form) => {
      expect(problems(withLine(line, ''))).toContainEqual(`Dockerfile: no ${key} stage "${form}"`);
    });
  });

  describe('rule 6: each stage holds only the instructions it holds today', () => {
    const IN_BUILD = 'in the build stage';
    const IN_RUNTIME = 'in the runtime stage';

    it.each([
      ['an ENTRYPOINT without quotes', 19, 'ENTRYPOINT [bun]'],
      ['a shell-form CMD', 19, 'CMD bun serve.js'],
      ['an exec-form ENTRYPOINT', 19, 'ENTRYPOINT ["bun"]'],
      ['a shell-form CMD with quotes', 19, 'CMD "bun" serve.js'],
      ['a CMD with another program', 19, 'CMD ["node", "serve.js"]'],
      ['a CMD with another file', 19, 'CMD ["bun", "other.js"]'],
      ['a CMD with text after it', 19, 'CMD ["bun", "serve.js"] x'],
      ['a CMD without the space', 19, 'CMD ["bun","serve.js"]'],
      ['a backslash on a CMD [ line', 19, 'CMD ["bun", ".\\/serve.js"]'],
      ['a lowercase cmd', 19, 'cmd ["bun", "serve.js"]'],
      ['another port', 18, 'EXPOSE 3001'],
      ['another NODE_ENV', 13, 'ENV NODE_ENV=development'],
      ['another ENV', 13, 'ENV A=b'],
      ['another WORKDIR', 12, 'WORKDIR /other'],
      ['a USER', 18, 'USER bun'],
      ['a LABEL', 18, 'LABEL a=b'],
      ['a VOLUME', 18, 'VOLUME /data'],
      ['a HEALTHCHECK', 18, 'HEALTHCHECK NONE'],
      ['a SHELL', 18, 'SHELL ["/bin/sh"]'],
      ['a STOPSIGNAL', 18, 'STOPSIGNAL SIGTERM'],
      ['an ONBUILD', 18, 'ONBUILD RUN true'],
      ['ONBUILD FROM', 18, 'ONBUILD FROM oven/bun:1.4.3'],
      ['an ADD', 18, 'ADD . .'],
      ['another RUN', 15, 'RUN true'],
      ['the apt RUN without its cleanup', 15, 'RUN echo Debian packages refreshed ${APT_REFRESH} && apt-get update && apt-get upgrade -y'],
      ['a quoted ARG value', 14, 'ARG A="x"'],
      ['APT_REFRESH without a value', 14, 'ARG APT_REFRESH'],
      ['APT_REFRESH with a word', 14, 'ARG APT_REFRESH=today'],
      ['APT_REFRESH with a short date', 14, 'ARG APT_REFRESH=2026-11-2'],
      ['APT_REFRESH with a short month', 14, 'ARG APT_REFRESH=2026-1-23'],
      ['APT_REFRESH with a short year', 14, 'ARG APT_REFRESH=26-11-23'],
      ['text before the APT_REFRESH ARG', 14, 'x ARG APT_REFRESH=2026-11-23'],
      ['APT_REFRESH with a five-digit year', 14, 'ARG APT_REFRESH=20260-11-23'],
      ['APT_REFRESH with a three-digit month', 14, 'ARG APT_REFRESH=2026-111-23'],
      ['APT_REFRESH with a three-digit day', 14, 'ARG APT_REFRESH=2026-11-233'],
      ['APT_REFRESH with a slash after the year', 14, 'ARG APT_REFRESH=2026/11-23'],
      ['APT_REFRESH with a slash after the month', 14, 'ARG APT_REFRESH=2026-11/23'],
      ['APT_REFRESH with a letter in the year', 14, 'ARG APT_REFRESH=20a6-11-23'],
      ['APT_REFRESH with a letter in the month', 14, 'ARG APT_REFRESH=2026-1a-23'],
      ['APT_REFRESH with a letter in the day', 14, 'ARG APT_REFRESH=2026-11-2a'],
      ['APT_REFRESH with text after the date', 14, 'ARG APT_REFRESH=2026-11-23 x'],
      ['APT_REFRESH with text before the date', 14, 'ARG APT_REFRESH=x2026-11-23'],
      ['another ARG with a date', 14, 'ARG OTHER=2026-11-23'],
      ['an unknown stage in COPY --from', 16, 'COPY --from=other /app/build ./build'],
      ['an image in COPY --from', 16, 'COPY --from=oven/bun:1.4.3 /app/build ./build'],
      ['a second --from', 16, 'COPY --from=build --from=other /app/build ./build'],
      ['a lowercase copy --from=build', 16, 'copy --from=build /app/build ./build'],
      ['a double-quoted --from', 16, 'COPY --fr"o"m=oven/b"u"n:1.4.3 /usr/local/bin/bun /usr/local/bin/'],
      ['a single-quoted --from', 16, "COPY --fr'o'm=node:24 /a /b"],
      ['a backslash-escaped --from', 16, 'COPY --fr\\om=node:24 /a /b'],
      ['COPY of another path from build', 16, 'COPY --from=build /app /app'],
      ['COPY of build/ to another path', 16, 'COPY --from=build /app/build ./other'],
      ['COPY of serve.js to another path', 17, 'COPY --from=build /app/serve.js ./other'],
      ['COPY of build/ from the bun stage', 16, 'COPY --from=bun /app/build ./build'],
      ['COPY of serve.js from the bun stage', 17, 'COPY --from=bun /app/serve.js ./'],
      ['a trailing space', 18, 'EXPOSE 3000 '],
      ['a leading space', 18, ' EXPOSE 3000'],
      ['a line of spaces', 18, '   '],
      ['a build-stage COPY', 18, 'COPY . .'],
      ['a build-stage RUN', 18, 'RUN bun install --frozen-lockfile'],
      ['the bun COPY', 18, 'COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun']
    ])('fails in the runtime stage on %s', (_, line, text) => {
      expect(problems(withLine(line, text))).toContainEqual(notAForm(line, text, IN_RUNTIME));
    });

    it.each([
      ['an image in COPY --from', 4, 'COPY --from=oven/bun:1.4.3 /usr/local/bin/bun /usr/local/bin/bun'],
      ['a Node image in COPY --from', 4, 'COPY --from=node:24 /usr/local/bin/node /usr/local/bin/node'],
      ['an unknown stage in COPY --from', 4, 'COPY --from=other /usr/local/bin/bun /usr/local/bin/bun'],
      ['the bun binary to another path', 4, 'COPY --from=bun /usr/local/bin/bun /tmp/bun'],
      ['the bun binary from its own stage', 4, 'COPY --from=build /usr/local/bin/bun /usr/local/bin/bun'],
      ['build/ from the bun stage', 4, 'COPY --from=bun /app/build ./build'],
      ['a RUN that pulls an image', 9, 'RUN docker pull oven/bun:1.4.3'],
      ['a RUN that names Node', 9, 'RUN docker pull node:24'],
      ['a mount from another image', 9, 'RUN --mount=type=bind,from=node:24,target=/n true'],
      ['a quoted from= inside a RUN --mount', 9, 'RUN --mount=type=bind,fr"o"m=node:24,target=/n true'],
      ['the install without its flag', 7, 'RUN bun install'],
      ['the install with text after it', 7, 'RUN bun install --frozen-lockfile --production'],
      ['a build line with a trailing space', 7, 'RUN bun install --frozen-lockfile '],
      ['a build line with a leading space', 7, ' RUN bun install --frozen-lockfile'],
      ['a lowercase build line', 8, 'copy . .'],
      ['the build without pregen', 9, 'RUN bun run build'],
      ['a narrower manifest COPY', 6, 'COPY package.json ./'],
      ['COPY . to another path', 8, 'COPY . /app'],
      ['a runtime ENV', 8, 'ENV NODE_ENV=production'],
      ['the runtime CMD', 8, 'CMD ["bun", "serve.js"]'],
      ['the runtime EXPOSE', 8, 'EXPOSE 3000'],
      ['the APT_REFRESH ARG', 8, 'ARG APT_REFRESH=2026-11-23'],
      ['the runtime apt RUN', 8, 'RUN echo Debian packages refreshed ${APT_REFRESH} && apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*'],
      ['a COPY from its own stage', 8, 'COPY --from=build /app/build ./build']
    ])('fails in the build stage on %s', (_, line, text) => {
      expect(problems(withLine(line, text))).toContainEqual(notAForm(line, text, IN_BUILD));
    });

    it.each(['WORKDIR /app', 'COPY . .', 'CMD ["bun", "serve.js"]'])('fails on %s in the bun stage', (text) => {
      expect(problems(withLine(2, text))).toContainEqual(notAForm(2, text, 'in the bun stage'));
    });

    it.each(['ARG BUN=1.4.4', 'WORKDIR /app'])('fails on %s before the first FROM', (text) => {
      expect(problems(insertBefore(1, text))).toContainEqual(notAForm(1, text, 'before the first FROM'));
    });

    it('accepts a new APT_REFRESH date', () => {
      expect(readBunPins(withLine(14, 'ARG APT_REFRESH=2027-01-02'), PACKAGE)).toEqual({ version: '1.4.4' });
    });

    it('reads the COPY --from lines by the names the stages carry', () => {
      const dockerfile = DOCKERFILE.replace('AS bun', 'AS tool')
        .replace('--from=bun', '--from=tool')
        .replace('AS build', 'AS compile')
        .replaceAll('--from=build', '--from=compile');
      expect(readBunPins(dockerfile, PACKAGE)).toEqual({ version: '1.4.4' });
    });

    it('fails on a COPY --from=<bun> once the bun stage is missing', () => {
      const text = 'COPY --from=undefined /usr/local/bin/bun /usr/local/bin/bun';
      expect(problems(withLine(4, text).replace('FROM oven/bun:1.4.4 AS bun', ''))).toContainEqual(notAForm(4, text, IN_BUILD));
    });

    it('fails on a COPY --from=<build> once the build stage is missing', () => {
      const text = 'COPY --from=undefined /app/build ./build';
      const dockerfile = withLine(16, text).replace('FROM node:26-slim AS build', '');
      expect(problems(dockerfile)).toContainEqual(notAForm(16, text, IN_RUNTIME));
    });
  });
});
