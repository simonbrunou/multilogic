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
  'RUN echo Debian packages refreshed ${APT_REFRESH} && apt-get update && apt-get upgrade -y', // 15
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

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    expect(problems(dockerfile)).toEqual(['Dockerfile line 9: "RUN <<EOF" holds a heredoc (<<)']);
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

  describe('rule 6: pins appear only on the FROM lines and COPY --from=<stage>', () => {
    it.each([
      ['an image in COPY --from', 4, 'COPY --from=oven/bun:1.4.3 /usr/local/bin/bun /usr/local/bin/bun'],
      ['a Node image in COPY --from', 4, 'COPY --from=node:24 /usr/local/bin/node /usr/local/bin/node'],
      ['an unknown stage in COPY --from', 16, 'COPY --from=other /app/build ./build'],
      ['a second --from on a COPY --from=build line', 16, 'COPY --from=build --from=other /app/build ./build'],
      ['a stage used before its FROM', 2, 'COPY --from=build /app/build ./build'],
      ['a lowercase copy --from=build', 16, 'copy --from=build /app/build ./build'],
      ['ONBUILD FROM', 18, 'ONBUILD FROM oven/bun:1.4.3'],
      ['ONBUILD FROM with another image', 18, 'ONBUILD FROM debian:13'],
      ['oven/bun on a RUN line', 9, 'RUN docker pull oven/bun:1.4.3'],
      ['a node: image on a RUN line', 9, 'RUN docker pull node:24'],
      ['a mount from another image', 9, 'RUN --mount=type=bind,from=node:24,target=/n true']
    ])('fails on %s', (_, line, text) => {
      expect(problems(withLine(line, text))).toContainEqual(
        expect.stringMatching(
          new RegExp(`^Dockerfile line ${line}: ${escaped(JSON.stringify(text))} names oven/bun, node: or "from" outside`)
        )
      );
    });

    it.each([
      ['the bun stage', 'COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun'],
      ['the build stage', 'COPY --from=build /app/serve.js ./']
    ])('accepts COPY --from= %s', (_, text) => {
      expect(readBunPins(withLine(17, text), PACKAGE)).toEqual({ version: '1.4.4' });
    });
  });

  describe('rule 9: no backslash, and quotes only on a CMD [ line', () => {
    it.each([
      ['a double-quoted --from', 'COPY --fr"o"m=oven/b"u"n:1.4.3 /usr/local/bin/bun /usr/local/bin/'],
      ['a single-quoted --from', "COPY --fr'o'm=node:24 /a /b"],
      ['a backslash-escaped --from', 'COPY --fr\\om=node:24 /a /b'],
      ['a quoted from= inside a RUN --mount', 'RUN --mount=type=bind,fr"o"m=node:24,target=/n true'],
      ['a quoted ARG value', 'ARG A="x"'],
      ['a shell-form CMD with quotes', 'CMD "bun" serve.js'],
      ['an exec-form ENTRYPOINT', 'ENTRYPOINT ["bun"]'],
      ['a backslash on a CMD [ line', 'CMD ["bun", ".\\/serve.js"]']
    ])('fails on %s', (_, text) => {
      expect(problems(withLine(19, text))).toContainEqual(
        `Dockerfile line 19: ${JSON.stringify(text)} holds a backslash, or a quote outside a CMD [...] line, which BuildKit strips from flags`
      );
    });
  });
});
