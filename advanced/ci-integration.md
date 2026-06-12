# CI Integration

Agentgrader runs in standard CI environments (GitHub Actions, GitLab CI, TeamCity, and others) as long as Docker and an LLM API key are available.

Use `assert:` criteria in test cases (`assert: steps <= 10`, `assert: cost_usd <= 0.05`) to fail builds when evaluation limits are exceeded. Use `agr validate --strict` to reject incomplete test case definitions before running expensive agent evaluations.

## Validate test cases in CI

Before running agents, verify test case definitions are complete:

```bash
npm install -g agentgrader
agr validate test-cases/my-case/agr.yaml --strict
```

`--strict` exits with code 1 if `test_command`, `fail_to_pass`, or `pass_to_pass` are missing. Without it, `agr validate` may pass with only static YAML checks (execution checks skipped when `test_command` is absent).

See [Best Practices: Validate before you benchmark](/guide/best-practices#validate-before-you-benchmark).

## GitHub Actions example

Benchmark on every pull request:

```yaml
name: Agentgrader Benchmarks

on: [push, pull_request]

jobs:
  bench:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Agentgrader
        run: npm install -g agentgrader

      - name: Validate test cases
        run: |
          for f in test-cases/*/agr.yaml; do
            agr validate "$f" --strict
          done

      - name: Run benchmark
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: |
          agr bench --suite test-cases/ --config agent.yaml --concurrency 2
```

## Things to keep in mind

- **Docker** must be available on the runner. `ubuntu-latest` on GitHub Actions includes Docker.
- **API keys** must come from encrypted secrets: never hardcode them. The CLI also reads a `.env` file if present, but CI should use `env:` / secrets instead.
- **Concurrency**: use `--concurrency` to parallelize sandbox runs. Balance against runner CPU and Docker limits.
- **Cost**: agent benchmarks consume LLM tokens. Consider running on a schedule or only on labeled PRs for large suites.

For embedding evaluations in custom CI logic, see the [Programmatic API](/advanced/programmatic-api).
