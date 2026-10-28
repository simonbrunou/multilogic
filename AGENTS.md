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

## Merge authority

Agents may merge their own PR without asking once all three hold:

- a code review ran on the diff (the `code-review` skill or the `pr-review-toolkit:code-reviewer` agent) and you fixed its real findings, nits aside (the global agent rules define a nit);
- CI is green on the pushed SHA (the `ci` and `fallow` workflows);
- the pushed SHA has no conflict with `origin/main`. Run `git fetch origin` right before merging, then check that `git merge-tree --write-tree origin/main <pushed SHA>` exits 0.

When the branch is behind `main` but has no conflict, merge it as it is. The accepted risk is that two PRs that pass on their own can break `main` together. The CI run on the newest `main` commit shows such a break, so check it after the merge and fix a red one in a new PR.

On a conflict, merge `origin/main` into the branch, resolve it, run `bun install --frozen-lockfile && bun run check && bun run lint && bun run test:coverage && bun run pregen && bun run build`, push, wait for CI on the new head, and check all three conditions again.

The user accepts the production deploy that the merge triggers. The site is a static SPA that stores no data on the server.

After the merge, check the deploy: `~/Projects/homelab-stacks/scripts/coolify-deploy-status.sh --no-health znyph742mtdlvo073b3j33qy <merge sha>` exits 0 (`--no-health`: the container has no health check) (exit 3 means still deploying: run it again a few minutes later), then `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://multilogic.sbrn.eu/` prints `200 text/html`.
