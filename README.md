# fontem-web

React + Vite SPA. The public-facing UI at fontem.void42.net / fontem.staging.void42.internal / etc. Talks to fontem-api (REST) and fontem-community-api (community features) over /api and /capi proxy paths through its own nginx.

## Deploy

CI auto-deploys to the testing env on every merge to main. Promotion to staging / prod is **manual** — bump the version in `gitops/<env>/<service>.yaml` to land it in a given environment.

## Convention

See [/config/repos/CLAUDE.md](https://contribute.void42.internal/fontem/gitops) for workspace-wide rules (feature branches + CI gate, no direct push to main, full gate before declaring done, conventional commits).
