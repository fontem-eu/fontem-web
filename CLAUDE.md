# fontem-web conventions

See also: [/config/repos/CLAUDE.md](/config/repos/CLAUDE.md) for workspace-wide rules.

## Full gate (this repo)
```
npm run test                                           # unit tests (vitest)
BASE_URL=https://fontem.eu npm run test:e2e            # Playwright e2e tests
npm run lint                                           # ESLint — must be clean
```
All three must pass. Fix failures before committing.

## Clean repo
`git status` must show `nothing to commit, working tree clean` when done.

## Deploy
Do NOT build/push images or `kubectl set image` by hand — deploys are GitOps.
Merging to `main` builds an image tagged `v<short-sha>` and CI bumps
`staging/fontem-web.yaml` in the `gitops` repo; ArgoCD auto-syncs staging.

Promote to prod by bumping `version:` in `gitops` `prod/fontem-web.yaml`
(PR → merge); ArgoCD syncs `fontem-web-prod`. Prod promotion is always the
user's explicit call.

- Production: https://fontem.eu  (namespace `fontem-prod`)
- Staging: namespace `fontem-staging`

Runtime-tunable article-quality heuristics live in `deployment/values.yaml`
under `qualityHeuristics` — edit + redeploy, no image rebuild.
