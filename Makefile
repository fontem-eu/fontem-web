IMAGE := contribute.void42.internal/golden/gmr-web:latest

.PHONY: test lint e2e gate mutation build deploy

test:
	npm run test

lint:
	npm run lint

e2e:
	BASE_URL=https://gmr.void42.net npm run test:e2e

gate: test e2e lint

mutation:
	npx stryker run

build:
	npm run build
	docker build -t gmr-web:latest .

deploy: build
	docker tag gmr-web:latest $(IMAGE)
	docker push $(IMAGE)
	kubectl set image deployment/gmr-web -n gmr nginx=$(IMAGE)
	kubectl rollout status deployment/gmr-web -n gmr --timeout=60s
