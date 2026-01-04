.PHONY: help install test lint format type-check security-scan clean docker-build docker-up docker-down run-worker

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "APEX Orchestrator - Make Commands"
	@echo "=================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pip install --upgrade pip setuptools wheel
	pip install -e ".[dev]"
	@echo "✅ Dependencies installed"

test: ## Run all tests with coverage
	pytest --cov=. --cov-report=term-missing --cov-report=html --cov-fail-under=80
	@echo "✅ Tests passed"

test-fast: ## Run tests without coverage
	pytest -v
	@echo "✅ Fast tests passed"

test-unit: ## Run unit tests only
	pytest tests/test_models.py tests/test_cache.py -v
	@echo "✅ Unit tests passed"

lint: ## Run ruff linter
	ruff check .
	@echo "✅ Linting passed"

format: ## Format code with black and ruff
	black .
	ruff check --fix .
	@echo "✅ Code formatted"

type-check: ## Run mypy type checker
	mypy --strict models/ infrastructure/ workflows/ activities/ config.py main.py
	@echo "✅ Type checking passed"

security-scan: ## Run security vulnerability scan
	pip install safety bandit
	safety check
	bandit -r . -ll
	@echo "✅ Security scan passed"

quality: lint type-check test ## Run all quality checks
	@echo "✅ All quality checks passed"

clean: ## Clean build artifacts and cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .mypy_cache .ruff_cache htmlcov .coverage
	@echo "✅ Cleaned build artifacts"

docker-build: ## Build Docker image
	docker build -t apex-orchestrator:latest .
	@echo "✅ Docker image built"

docker-up: ## Start infrastructure (Temporal + Redis)
	docker-compose up -d
	@echo "✅ Infrastructure started"
	@echo "Temporal UI: http://localhost:8233"
	@echo "Redis Insight: http://localhost:8001"

docker-down: ## Stop infrastructure
	docker-compose down
	@echo "✅ Infrastructure stopped"

docker-logs: ## View infrastructure logs
	docker-compose logs -f

run-worker: ## Start orchestrator worker
	python main.py worker

run-test-workflow: ## Submit test workflow
	python main.py submit "Book flight to Paris tomorrow and email confirmation to test@example.com"

run-tests-integration: ## Run integration tests with Docker
	docker-compose up -d
	sleep 5
	pytest tests/ -v
	docker-compose down

ci: clean install quality ## Run full CI pipeline
	@echo "✅ CI pipeline passed"

prod-check: ## Pre-production checklist
	@echo "Running production readiness checks..."
	@echo "1. Type checking..."
	@make type-check
	@echo "2. Security scan..."
	@make security-scan
	@echo "3. Test suite..."
	@make test
	@echo "4. Lint check..."
	@make lint
	@echo "✅ Production ready!"

dev-setup: install docker-up ## Complete dev environment setup
	@echo "✅ Development environment ready"
	@echo "Next steps:"
	@echo "  1. Copy .env.example to .env and configure"
	@echo "  2. Run 'make run-worker' to start worker"
	@echo "  3. Run 'make run-test-workflow' to test"
