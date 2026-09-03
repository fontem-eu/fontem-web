> ### 🪞 This GitHub repository is a mirror
>
> Development happens on Dargle's own infrastructure; this mirror is
> updated automatically. **Issues and pull requests opened here are not
> monitored.**
>
> If you would like to contribute — code, data sources, review, or
> anything else — please get in touch at **team@fontem.eu** and we will
> set you up.

# fontem-web

React + Vite SPA. The public-facing UI at fontem.void42.net / fontem.staging.void42.internal / etc. Talks to fontem-api (REST) and fontem-community-api (community features) over /api and /capi proxy paths through its own nginx.

## Deploy

CI auto-deploys to the testing env on every merge to main. Promotion to staging / prod is **manual** — bump the version in `gitops/<env>/<service>.yaml` to land it in a given environment.

## Convention

See [/config/repos/CLAUDE.md](https://contribute.void42.internal/fontem/gitops) for workspace-wide rules (feature branches + CI gate, no direct push to main, full gate before declaring done, conventional commits).

## License

Apache License 2.0 — see [LICENSE](LICENSE).
