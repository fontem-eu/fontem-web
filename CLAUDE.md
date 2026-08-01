# fontem-web conventions

See also: [/config/repos/CLAUDE.md](/config/repos/CLAUDE.md) for workspace-wide rules.

## Full gate (this repo)
```
npm run test    # unit tests (vitest)
npm run lint    # ESLint — must be clean
```
Both must pass. Fix failures before committing.

## e2e — never against production
The e2e suite is a **promotion gate**, not a health check. It writes data
and registers accounts. CI runs it against **testing** before anything
reaches staging, and against **staging** before anything is proposed for
prod. Pointing it at fontem.eu is not something we do.

```
BASE_URL=https://fontem.testing.void42.internal npm run test:e2e
BASE_URL=https://fontem.staging.void42.internal npm run test:e2e
```

## Clean repo
`git status` must show `nothing to commit, working tree clean` when done.

## Deploy
Do NOT build/push images or `kubectl set image` by hand — deploys are
GitOps, and `set image` fights Helm's field manager so the next ArgoCD
sync silently reverts it.

Merging to `main` builds an image tagged `v<short-sha>` and CI bumps
`testing/fontem-web.yaml` in `gitops`; ArgoCD syncs testing. `promote.yml`
then gates staging on the e2e suite passing against testing.

Promotion to prod is `promote-prod.yml`: it runs e2e against staging, then
opens a PR in **`fontem-prod-release`** (`prod/fontem-web.yaml`). That repo
is branch protected — merge only via PR, and every PR is gated on the
latest DAST scan verdict. `gitops/prod/` no longer exists; editing it is
not a thing.

Prod promotion is always the user's explicit call.

- Production: https://fontem.eu  (namespace `fontem-prod`)
- Staging: namespace `fontem-staging`
- Testing: namespace `fontem-testing`

Runtime-tunable article-quality heuristics live in `deployment/values.yaml`
under `qualityHeuristics` — edit + redeploy, no image rebuild.
