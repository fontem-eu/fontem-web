# gmr-web conventions

See also: [/config/repos/CLAUDE.md](/config/repos/CLAUDE.md) for workspace-wide rules.

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
```
npm run build
docker build -t gmr-web:latest .
docker tag gmr-web:latest contribute.void42.internal/fontem/gmr-web:latest
docker push contribute.void42.internal/fontem/gmr-web:latest
kubectl set image deployment/gmr-web -n gmr nginx=contribute.void42.internal/fontem/gmr-web:latest
kubectl rollout status deployment/gmr-web -n gmr --timeout=60s
```
Production: https://gmr.void42.net
