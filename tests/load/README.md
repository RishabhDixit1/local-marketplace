# Load Tests

## Prerequisites

Install [k6](https://k6.io/docs/get-started/installation/):

```bash
brew install k6
```

## Running Tests

```bash
# Basic load test (default: 10 VUs, 1m duration)
k6 run tests/load/basic-load-test.js

# Override VUs and duration
k6 run tests/load/basic-load-test.js --vus 50 --duration 2m

# Target a different environment
BASE_URL=https://staging.example.com k6 run tests/load/basic-load-test.js

# Smoke test (shell-based, no k6 needed)
bash tests/load/smoke-test.sh
BASE_URL=https://staging.example.com bash tests/load/smoke-test.sh
```

| Script | Type | What it does |
|--------|------|-------------|
| `basic-load-test.js` | k6 | Landing page, market categories, provider search — configurable VUs |
| `smoke-test.sh` | Shell (curl) | Quick health check on 5 endpoints with pass/fail |
