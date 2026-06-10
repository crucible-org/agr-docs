# CI Integration

Agentgrader is completely designed to run flawlessly in standard CI environments like GitHub Actions, GitLab CI, or TeamCity.

Because it supports checking agent assertions right out of the box (like `assert: steps <= 10` or `assert: cost_usd <= 0.05`), you can easily configure it to fail your CI build if the evaluation conditions are not met.

## GitHub Actions Example

Here is an example of a typical GitHub Actions workflow that executes your benchmark suite on every pull request.

```yaml
name: Agentgrader Benchmarks

on: [push, pull_request]

jobs:
  bench:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # First, we set up Node.js
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      # Next, we set up your models
      - name: Export API keys
        run: echo "OPENROUTER_API_KEY=${{ secrets.OPENROUTER_API_KEY }}" >> $GITHUB_ENV

      # Finally, we run the benchmark
      - name: Run Agentgrader
        run: |
          npm install -g agentgrader
          agr bench --suite ./tests/suites --configs ./baseline.yaml
```

## Things to Keep in Mind

*   Ensure that Docker is available in your CI runner. If you are using the latest Ubuntu runner on GitHub Actions, Docker is already pre-installed for you.
*   Make absolutely sure your API keys are supplied via encrypted environment secrets and never hardcoded.
*   If you have a massive suite of tests, you can use the `--concurrency` flag or the programmatic API to distribute executions and speed things up.
