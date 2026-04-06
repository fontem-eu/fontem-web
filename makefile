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
		-Dsonar.scm.provider=git \
		'-Dsonar.coverage.exclusions=src/views/**/*,src/data/**/*,src/main.js'
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

# ── Security & SBOM ─────────────────────────────────────────
audit:
	npm audit --omit=dev 2>&1 || true
	@echo ""
	@echo "=== Renovate Dependency Report ==="
	LOG_LEVEL=warn npx renovate --platform=local --dry-run 2>&1 | grep -E "dependency|update|→|->|current|new" | head -30 || true

DTRACK_URL  ?= http://dependency-track.dependency-track.svc.cluster.local:8080
DTRACK_KEY  ?= $(shell cat /config/.dtrack-api-key 2>/dev/null)

sbom:
	npx @cyclonedx/cyclonedx-npm --output-format json --output-file sbom.json
	curl -s -X POST "$(DTRACK_URL)/api/v1/bom" \
		-H "X-Api-Key: $(DTRACK_KEY)" \
		-H "Content-Type: multipart/form-data" \
		-F "autoCreate=true" \
		-F "projectName=$(PROJECT)" \
		-F "projectVersion=main" \
		-F "bom=@sbom.json" > /dev/null
	@echo "SBOM uploaded to Dependency-Track"

.PHONY: audit sbom
