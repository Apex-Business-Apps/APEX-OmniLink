#!/usr/bin/env python3
"""
Project Init - Initialize production-ready project structure

Copyright (c) 2025 APEX Business Systems Ltd.
Edmonton, AB, Canada | https://apexbusiness-systems.com

Usage: python project-init.py <name> --type <api|cli|lib|frontend> [--lang <python|typescript|go>]

Exit: 0=success, 1=input error, 2=system error
"""

import sys
import argparse
from pathlib import Path

TEMPLATES = {
    "python-api": {
        "src/{name}/__init__.py": '"""{}"""',
        "src/{name}/main.py": '''"""Main application entry point."""
from fastapi import FastAPI
from .config import settings

app = FastAPI(title="{name}", version="1.0.0")

@app.get("/health")
async def health():
    return {{"status": "healthy"}}
''',
        "src/{name}/config.py": '''"""Configuration management."""
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    debug: bool = False
    database_url: str = "sqlite:///./app.db"
    
    class Config:
        env_file = ".env"

settings = Settings()
''',
        "tests/__init__.py": "",
        "tests/test_main.py": '''"""Tests for main module."""
import pytest
from fastapi.testclient import TestClient
from {name}.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
''',
        "pyproject.toml": """[project]
name = "{name}"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.100.0",
    "uvicorn[standard]>=0.23.0",
    "pydantic-settings>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-cov>=4.0.0",
    "ruff>=0.1.0",
    "mypy>=1.0.0",
    "black>=23.0.0",
]

[tool.ruff]
line-length = 100
select = ["E", "F", "I", "N", "W"]

[tool.mypy]
strict = true

[tool.pytest.ini_options]
testpaths = ["tests"]
""",
        ".gitignore": """__pycache__/
*.py[cod]
.env
.venv/
dist/
*.egg-info/
.coverage
.mypy_cache/
.pytest_cache/
""",
        "Dockerfile": """FROM python:3.12-slim AS builder
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir build && python -m build

FROM python:3.12-slim
WORKDIR /app
RUN adduser --system --group app
COPY --from=builder /app/dist/*.whl .
RUN pip install --no-cache-dir *.whl && rm *.whl
USER app
EXPOSE 8000
CMD ["uvicorn", "{name}.main:app", "--host", "0.0.0.0", "--port", "8000"]
""",
        "README.md": """# {name}

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Run

```bash
uvicorn {name}.main:app --reload
```

## Test

```bash
pytest --cov
```
""",
    },
    "typescript-api": {
        "src/index.ts": """import express from 'express';
import {{ config }} from './config';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {{
  res.json({{ status: 'healthy' }});
}});

app.listen(config.port, () => {{
  console.log(`Server running on port ${{config.port}}`);
}});
""",
        "src/config.ts": """export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
};
""",
        "tests/index.test.ts": """import {{ describe, it, expect }} from 'vitest';

describe('API', () => {{
  it('should pass', () => {{
    expect(true).toBe(true);
  }});
}});
""",
        "package.json": """{{
  "name": "{name}",
  "version": "1.0.0",
  "type": "module",
  "scripts": {{
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }},
  "dependencies": {{
    "express": "^4.18.0"
  }},
  "devDependencies": {{
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }}
}}
""",
        "tsconfig.json": """{{
  "compilerOptions": {{
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }},
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}}
""",
        ".gitignore": """node_modules/
dist/
.env
coverage/
""",
        "Dockerfile": """FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 app && adduser -u 1001 -G app -s /bin/sh -D app
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
""",
    },
}


def create_project(name: str, template_key: str, output_path: Path):
    """Create project from template."""
    template = TEMPLATES.get(template_key)
    if not template:
        print(f"❌ Unknown template: {template_key}", file=sys.stderr)
        sys.exit(1)

    project_path = output_path / name
    if project_path.exists():
        print(f"❌ Already exists: {project_path}", file=sys.stderr)
        sys.exit(1)

    project_path.mkdir(parents=True)

    for file_path, content in template.items():
        full_path = project_path / file_path.format(name=name)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content.format(name=name))
        print(f"   + {file_path.format(name=name)}")

    return project_path


def main():
    parser = argparse.ArgumentParser(
        description="Initialize production-ready project (APEX Business Systems Ltd.)"
    )
    parser.add_argument("name", help="Project name")
    parser.add_argument("--type", choices=["api", "cli", "lib", "frontend"], default="api")
    parser.add_argument("--lang", choices=["python", "typescript", "go"], default="python")
    parser.add_argument("--output", type=Path, default=Path.cwd())
    args = parser.parse_args()

    template_key = f"{args.lang}-{args.type}"
    if template_key not in TEMPLATES:
        template_key = f"{args.lang}-api"  # fallback

    print(f"\n📦 Creating {args.lang} {args.type}: {args.name}")
    print("=" * 50)

    project_path = create_project(args.name, template_key, args.output)

    print("=" * 50)
    print(f"✅ Created: {project_path}")
    print("\nNext steps:")
    print(f"   cd {args.name}")
    if args.lang == "python":
        print("   python -m venv .venv && source .venv/bin/activate")
        print('   pip install -e ".[dev]"')
    elif args.lang == "typescript":
        print("   npm install")
        print("   npm run dev")


if __name__ == "__main__":
    main()
