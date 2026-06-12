# Best Practices

Practical guidance for authoring test cases, running evaluations in CI, and debugging agent behavior.

## Validate before you benchmark

Use `agr validate` to check a test case definition before spending tokens on a full agent run:

```bash
agr validate test-cases/my-case/agr.yaml
```

Validation performs static field checks and, when `test_command` is configured, runs pre-patch and post-patch execution checks inside Docker (verifying `fail_to_pass` tests currently fail and `pass_to_pass` tests pass, then that the gold `solution` patch fixes them).

### When `test_command` is missing

If `test_command` is not set, execution checks are **skipped** and reported with ⚠️: validation still passes for YAML structure alone. Do not treat a green `agr validate` as proof that Docker execution was verified unless execution checks actually ran.

### Use `--strict` in CI

For pipelines that should reject incomplete test cases, use:

```bash
agr validate test-cases/my-case/agr.yaml --strict
```

`--strict` exits with code 1 if `test_command`, `fail_to_pass`, or `pass_to_pass` are missing. This prevents "YAML lint only" from passing as a quality gate.

Example GitHub Actions step:

```yaml
- name: Validate test cases
  run: |
    npm install -g agentgrader
    for f in test-cases/*/agr.yaml; do
      agr validate "$f" --strict
    done
```

See [CI Integration](/advanced/ci-integration) for a full workflow example.

## Filling in `fail_to_pass` and `pass_to_pass`

These fields list **individual test names** as they appear in TAP output. Agentgrader parses TAP lines like:

```
ok 1 - greet returns a friendly message
not ok 2 - handles empty input
```

### Workflow

1. Set `test_command` to a command that produces TAP output. For Node.js:

   ```yaml
   test_command: "node --test --test-reporter=tap src/**/*.test.js"
   ```

   For Python (requires [pytest-tap](https://pypi.org/project/pytest-tap/)):

   ```yaml
   test_command: "pytest --tap-stream"
   ```

2. Run the test suite manually inside the fixture (or use `agr import-pr --clone-fixture` and inspect output) to collect exact test names.

3. Add names to the lists:

   ```yaml
   fail_to_pass:
     - "handles empty input"
   pass_to_pass:
     - "greet returns a friendly message"
   ```

4. Run `agr validate` to confirm pre-patch and post-patch behavior.

`agr validate` does **not** auto-populate these fields: it only verifies the definition once you fill them in. `agr import-pr` scaffolds empty lists with TODO comments as a starting point.

## Debug agent runs with `--verbose`

Long agent runs can appear silent for 30 to 60 seconds. Stream steps live:

```bash
agr run test-cases/my-case/agr.yaml --config agent.yaml --verbose
```

Each step prints a compact line:

```
[step 3] tool_call: executeCommand({"command":"npm test"})
[step 4] tool_result: executeCommand -> exit_code 1, ...
[step 5] message: I'll fix the off-by-one error...
```

Long `content` strings are truncated to keep output readable. Without `--verbose`, behavior is unchanged: you only see the final summary.

After the run, inspect the full trace:

```bash
agr trace <runId>
```

## When to use `tools` allowlist

By default every agent gets all local sandbox tools plus every tool from configured MCP servers. Set `tools` in `agent.yaml` when you want to **restrict** what the model can call:

- **Read-only reviewers:** allow `readFile` and `executeCommand` but omit `writeFile` so the agent cannot modify the fixture directly.
- **MCP hygiene:** when several MCP servers are connected, allowlist only the namespaced tools you intend (e.g. `github_create_issue`) and exclude the rest.
- **Minimal agents:** force shell-only workflows with `executeCommand` + `submit` and no file tools.

`submit` is always added implicitly. Unknown tool names in the list are ignored with a warning.

See [Agent Config YAML](/reference/agent-config-yaml#tools).

## `agent_config` in `agr.yaml` vs. bench config flags

| Goal | Approach |
|---|---|
| One test case, one default agent; `agr run` with no flags | `agent_config: ../agent.yaml` in `agr.yaml` |
| Same agent across an entire suite; `agr bench` with no config flags | Every test case references the **same** `agent_config` path |
| Compare N agents × M test cases | `agr bench --configs-dir …` or `--configs a.yaml,b.yaml` |
| Sweep hyperparameters (model × temperature × prompt) | `agr bench --matrix matrix.yaml` |
| Reproducible suite + agent list in one file | `agr bench --manifest bench.yaml` |

Per-test-case `agent_config` values are **not** expanded into a Cartesian product on `agr bench`. If test cases point at different agent configs, bench fails unless you pass explicit `--configs` / `--matrix` / `--manifest`.

## Compare agents with matrix benchmarks

When evaluating multiple models or hyperparameters, use a matrix YAML instead of maintaining many separate agent config files:

```yaml
name: model-sweep
base:
  max_steps: 20
  temperature: 0.2
dimensions:
  model:
    - openai/gpt-4o-mini
    - anthropic/claude-sonnet-4
```

```bash
agr bench --suite test-cases/ --matrix matrix.yaml
```

Every run shares a `matrixId`. After the benchmark, a **MATRIX SUMMARY** table shows solve rate, average cost, and quality metrics per config, with Pareto-optimal entries marked.

For programmatic access to matrix results, see [Programmatic API: Optimizer Matrix Sweeps](/advanced/programmatic-api#optimizer-matrix-sweeps).

## Troubleshooting

### Docker is not reachable

Agentgrader requires a running Docker daemon. Symptoms include errors about connecting to the Docker socket or failing to create containers.

- Ensure Docker Desktop (or the Docker engine on Linux) is running.
- On Linux CI runners, the `ubuntu-latest` GitHub Actions image includes Docker.
- Verify with `docker ps` before running `agr`.

### Missing API keys

The CLI loads `.env` from the current working directory. If no key is found, the adapter throws a clear error naming the missing variable (`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` depending on `provider`).

Create a `.env` file next to where you run `agr`:

```bash
OPENROUTER_API_KEY=sk-or-...
```

Or export the variable in your shell or CI secrets.

### Validation passes but execution was skipped

If `test_command` is empty, `agr validate` shows:

```
⚠️ execution-checks (skipped - no test_command)
```

and prints a note that only static checks ran. This is expected for scaffolded test cases: fill in `test_command` and test name lists before relying on validation as a quality gate. Use `--strict` in CI to catch this early.

### Skipped scorers in run summary

When `fail_to_pass`/`pass_to_pass` or `expected_files` are not configured, the run summary shows warnings like:

```
⚠️ Regression: No fail_to_pass/pass_to_pass criteria configured; skipping regression check.
⚠️ Localization: No expected_files configured; skipping localization check.
```

These are informational: the run still passes or fails based on `success` criteria. Add SWE-bench fields when you need per-test regression checks or localization metrics.

### `agr bench` flag errors

`agr bench` requires `--suite` and either `--configs`, `--config`, or `--matrix`. If you pass `--config` to bench (singular), it works as an alias for a single `--configs` path: the same flag name as `agr run --config` but with different semantics on each command.
