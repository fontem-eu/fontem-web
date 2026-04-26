# gmr-web conventions

See also:
- [/config/repos/CLAUDE.md](/config/repos/CLAUDE.md) — workspace-wide rules
- BookStack Developer Guide — https://docs.void42.internal/books/developer-guide
  Platform architecture, SSO, CI/CD, deploy runbook, debug playbook, secrets, PR workflow.

## Full gate (this repo)
```
npm run test                                           # 242 unit tests (vitest)
BASE_URL=https://gmr.void42.net npm run test:e2e      # 79 Playwright e2e tests
npm run lint                                           # ESLint — must be clean
```
All three must pass. Fix failures before committing.

## Clean repo
`git status` must show `nothing to commit, working tree clean` when done.

## Deploy

Default flow: push to main → CI builds + signs + deploys via gitops-bump.
ArgoCD applies within ~30s. **Don't `kubectl set image` against the
ArgoCD-managed deployment** — it will get reset.

Manual hotfix-only flow (when CI is broken or you need <5 min ship):
see https://docs.void42.internal/books/developer-guide/page/deployment-runbook

Production: https://gmr.void42.net
