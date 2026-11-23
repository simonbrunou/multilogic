# multilogic

## Agent skills

### Issue tracker

Forgejo issues on `git.sbrn.eu` via the `fj` CLI, with the REST API for JSON reads and blocking links. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## Conventions

Read `docs/agents/conventions.md` before editing a grid component (`SudokuGrid`, `KakuroGrid`, `TectonicGrid`, `YakusoGrid`, `GrecoBoard`) or fixing a Safari bug: cell ARIA and button roles, Safari-safe grid CSS, and how to report a fix that no check here can run in WebKit.

## Production build

Coolify's `build_pack` setting picks what builds production: `railpack` reads `railpack.json`, `dockerfile` reads `Dockerfile`. Keep both working, since rolling back is a change of that setting. Each runs `bun install --frozen-lockfile`, `bun run pregen` and `bun run build`, then serves `build/` with `bun serve.js` on port 3000, so a change to one of those steps goes in both files. `.dockerignore` applies to both.

The Dockerfile's runtime stage runs `apt-get upgrade`, and BuildKit reuses that layer from its cache. When a scan flags a Debian package that a fresh upgrade fixes, set `ARG APT_REFRESH` in the `Dockerfile` to today's date to rebuild it.

## Bun version

`packageManager` in `package.json` is the Bun pin (#96): CI's `oven-sh/setup-bun` steps and a Railpack build install it. The `Dockerfile` repeats it in its two `oven/bun` tags and repeats the `.nvmrc` major in its `node:<major>-slim` tag. `tests/scripts/docker-pins.test.ts` and `tests/node-pins.test.ts` fail CI while they differ. Renovate moves `packageManager` and both `oven/bun` tags in one PR, 14 days after a Bun release; it opens no PR for `.nvmrc` or the `node` tag, so a new Node major arrives as the `@types/node` major PR, which sets all of them. The dev shell takes `bun` from the nixpkgs that `flake.lock` locks, so it can trail the pin by a few patch releases. A different major or minor needs a fix, and `flake.nix` prints an `evaluation warning` naming both versions and the fix on each dev shell evaluation (#111). It also warns when `packageManager` is not `bun@<version>`. The shell still runs, and CI never sees the warning, since no workflow runs nix. The fixes:

- nixpkgs behind the pin, as after a Bun minor PR: run `nix flake update` once nixpkgs carries that minor.
- nixpkgs ahead of the pin, as after a `nix flake update`: move the pin to the shell's minor, or keep `flake.lock` on a nixpkgs that carries the pin's minor.

direnv caches the shell and prints the warning only on the load that re-evaluates it; `.envrc` watches `package.json` so that a pin change re-evaluates. Under direnv, run `nix develop -c bun --version` to see the warning again. A `bun.lock` written on another Bun can resolve differently and still pass `bun install --frozen-lockfile` (#103), so while the dev shell's Bun differs from the pin, write a lock change with `bunx bun@<pin> install`.

## Merge authority

Agents may merge their own PR without asking once all three hold:

- a code review ran on the diff (the `code-review` skill or the `pr-review-toolkit:code-reviewer` agent) and you fixed its real findings, nits aside (the global agent rules define a nit);
- CI is green on the pushed SHA (the `ci` and `fallow` workflows);
- the pushed SHA has no conflict with `origin/main`. Run `git fetch origin` right before merging, then check that `git merge-tree --write-tree origin/main <pushed SHA>` exits 0.

When the branch is behind `main` but has no conflict, merge it as it is. The accepted risk is that two PRs that pass on their own can break `main` together. The CI run on the newest `main` commit shows such a break.

After every merge, check whether to wait for `main`'s CI run:

1. Run `git fetch origin`.
2. Read the merge SHA from `merge_commit_sha` in `python3 -I ~/.agents/skills/forgejo-issues/scripts/forgejo.py get multilogic#<n>`, since `fj pr merge` prints none.
3. Run `git rev-parse <merge SHA>^{tree} <pushed SHA>^{tree}`.
   - Two different hashes mean the merge commit holds files CI has not tested together. Wait for `main`'s run with `python3 -I ~/.agents/skills/forgejo-issues/scripts/forgejo.py ci multilogic --follow main` (on exit 3 the run is still going, so run it again in a new shell call) and fix a red one in a new PR.
   - The same hash twice means the merge commit holds the files the PR's CI passed, since the PR run checks out the pushed SHA itself. Skip the wait only when step 4 exits 0.
4. On the same hash, run `bun scripts/check-push-repeats-pr.ts <pushed SHA>` in a checkout with its dependencies installed (`bun install --frozen-lockfile`). The skip holds only while the `push` run on `main` repeats the PR run's jobs and steps, and the script reads the workflows, actions and other tracked files at that SHA for a difference between the two runs. Exit 0 means skip the wait. Any other exit means wait for `main`'s run as step 3 says, even though the hashes match: exit 1 follows the lines that name each difference, exit 2 a git failure, an unknown SHA or a `yaml` package that Bun cannot load. The script's header lists what it reads, the differences this repo keeps on purpose, and what it cannot see.

On a conflict, merge `origin/main` into the branch, resolve it, run `bun install --frozen-lockfile && bun run check && bun run lint && bun run test:coverage && bun run pregen && bun run build`, push, wait for CI on the new head, and check all three conditions again.

The user accepts the production deploy that the merge triggers. The site is a static SPA that stores no data on the server.

After the merge, check the deploy: `~/Projects/homelab-stacks/scripts/coolify-deploy-status.sh --no-health znyph742mtdlvo073b3j33qy <merge sha>` exits 0 (`--no-health`: the container has no health check) (exit 3 means still deploying: run it again a few minutes later), then `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://multilogic.sbrn.eu/` prints `200 text/html`.
