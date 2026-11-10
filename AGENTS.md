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

## Bun version

`packageManager` in `package.json` is the one Bun pin (#96): CI's `oven-sh/setup-bun` steps and railpack, which builds and serves production on Coolify, both install it. The dev shell takes `bun` from the nixpkgs that `flake.lock` locks, so it can trail the pin by a few patch releases. `nix develop -c bun --version` must still print the pin's major and minor: in the PR that moves the pin to a new minor, run `nix flake update` once nixpkgs carries that minor. A `bun.lock` written on another Bun can resolve differently and still pass `bun install --frozen-lockfile` (#103), so while the dev shell's Bun differs from the pin, write a lock change with `bunx bun@<pin> install`.

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
   - The same hash twice means the merge commit holds the files the PR's CI passed, since the PR run checks out the pushed SHA itself. Skip the wait when step 4 finds no difference.
4. On the same hash, read each file in `.forgejo/workflows/` at the pushed SHA (`git show <pushed SHA>:.forgejo/workflows/` lists them). The skip holds only while the `push` run on `main` repeats the PR run's jobs and steps. A workflow that runs only on `pull_request`, as `fallow.yml` does, gives `main` no run to wait for, and a workflow-level `concurrency` group only picks which run a newer push cancels. On any other difference between `push` and `pull_request`, wait for `main`'s run as above even though the hashes match. Look for:
   - an `if:` or a `${{ }}` expression outside a `concurrency` group, `env:` included, that reads any `github.*` value, such as `github.event_name`, `github.ref` or `github.base_ref`;
   - a step that reads `$GITHUB_EVENT_NAME`, `$GITHUB_REF` or another `$GITHUB_*` variable, in its `run:` or in a repo script it calls (`git grep -n GITHUB_ <pushed SHA> -- ':!.forgejo/workflows' ':!*.md'` lists the files to trace, and a hit in a file a step runs means a wait);
   - a `paths`, `paths-ignore`, `branches` or `branches-ignore` filter on one event only;
   - a workflow that runs on `push` alone.

On a conflict, merge `origin/main` into the branch, resolve it, run `bun install --frozen-lockfile && bun run check && bun run lint && bun run test:coverage && bun run pregen && bun run build`, push, wait for CI on the new head, and check all three conditions again.

The user accepts the production deploy that the merge triggers. The site is a static SPA that stores no data on the server.

After the merge, check the deploy: `~/Projects/homelab-stacks/scripts/coolify-deploy-status.sh --no-health znyph742mtdlvo073b3j33qy <merge sha>` exits 0 (`--no-health`: the container has no health check) (exit 3 means still deploying: run it again a few minutes later), then `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://multilogic.sbrn.eu/` prints `200 text/html`.
