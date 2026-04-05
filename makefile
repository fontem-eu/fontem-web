SONAR_URL   ?= http://sonarqube.sonarqube.svc.cluster.local:9000
SONAR_TOKEN ?= $(shell cat /config/.sonarqube-token 2>/dev/null)
SCANNER     ?= /config/.local/sonar-scanner/bin/sonar-scanner
JAVA_HOME   ?= $(shell dirname $$(dirname $$(readlink -f $$(which java))))
export JAVA_HOME

TAG     := $(shell git rev-parse --short HEAD)
IMAGE   := contribute.void42.internal/golden/gmr-web
PROJECT := gmr-web

all: build release deploy

# ── Quality ──────────────────────────────────────────────────
test:
	npx vitest run \
		--coverage --coverage.provider=istanbul \
		--coverage.reporter=lcov \
		--coverage.reportsDirectory=coverage
	npm run lint

analyze: test
	$(SCANNER) \
		-Dsonar.projectKey=$(PROJECT) \
		-Dsonar.sources=src \
		-Dsonar.tests=tests \
		-Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
		-Dsonar.host.url=$(SONAR_URL) \
		-Dsonar.token=$(SONAR_TOKEN) \
		-Dsonar.scm.provider=git
	@echo "Dashboard: $(SONAR_URL)/dashboard?id=$(PROJECT)"

# ── Deploy ───────────────────────────────────────────────────
coverage-matrix:
	@echo "Generating coverage matrix..."
	python3 scripts/coverage_matrix.py > public/coverage-matrix.json

build:
	npm run build
	docker build -t $(IMAGE):$(TAG) .

release:
	docker push $(IMAGE):$(TAG)

deploy:
	helm upgrade --install gmr-web ./deployment --set-string version=$(TAG)
	kubectl -n gmr rollout restart deployment gmr-web

.PHONY: all test analyze coverage-matrix build release deploy
