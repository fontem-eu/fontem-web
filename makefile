
all: coverage build release deploy

coverage:
	@echo "Generating coverage matrix..."
	python3 scripts/coverage_matrix.py > public/coverage-matrix.json

build:
	docker build -t contribute.void42.internal/golden/gmr-web:$(shell git rev-parse --short HEAD) .

release:
	docker push contribute.void42.internal/golden/gmr-web:$(shell git rev-parse --short HEAD)

deploy:
	helm upgrade --install gmr-web ./deployment --set-string version=$(shell git rev-parse --short HEAD)
	kubectl -n gmr rollout restart deployment gmr-web
