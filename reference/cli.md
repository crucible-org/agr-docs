# CLI Reference

The `agr` command ships with the [`agentgrader`](https://www.npmjs.com/package/agentgrader) npm package.

```bash
npm install -g agentgrader
# or per-invocation:
bunx agentgrader <command>
```

## `agr run`

Run a single test case with one agent config. Useful for debugging a specific case or iterating on prompts.

```bash
agr run test-cases/fix-greeting/agr.yaml --config agent.yaml
```

### Options

| Flag | Default | Description |
|---|---|---|
| `<testCase>` | Required | Path to an `agr.yaml` file. |
| `--config <path>` | Built-in default | Path to an agent config YAML. If omitted, uses `gpt-4o-mini` with `max_steps: 20`. |
| `--verbose` | `false` | Stream agent steps live to the console as they happen. |

### Examples

```bash
# Default agent (gpt-4o-mini, 20 steps)
agr run test-cases/fix-greeting/agr.yaml

# Custom agent config
agr run test-cases/fix-greeting/agr.yaml --config agent.yaml

# Watch tool calls and messages in real time
agr run test-cases/fix-greeting/agr.yaml --config agent.yaml --verbose
```

## `agr bench`

Run every test case in a suite against one or more agent configs (or an optimizer matrix). Shows a live terminal dashboard and runs evaluations in parallel.

```bash
agr bench --suite test-cases/ --configs agent.yaml,agent-alt.yaml --concurrency 2
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--suite <path>` | Required | Directory containing test case folders (each with an `agr.yaml`). |
| `--configs <paths>` | One of `--configs` / `--config` / `--matrix` required | Comma-separated paths to agent config YAML files. |
| `--config <path>` | (none) | Alias for `--configs` when you have a single agent config file. |
| `--matrix <path>` | (none) | Optimizer matrix YAML. Expands into the cartesian product of agent configs, tags runs with a shared `matrixId`, and prints a Pareto summary. See [Core Concepts: Optimizer matrices](/guide/concepts#optimizer-matrices). |
| `--concurrency <n>` | `2` | Number of parallel sandbox executions. |

### Examples

```bash
# Single agent config (--config is an alias for --configs)
agr bench --suite test-cases/ --config agent.yaml

# Multiple agent configs
agr bench --suite test-cases/ --configs agent.yaml,agent-openrouter.yaml

# Optimizer matrix sweep
agr bench --suite test-cases/ --matrix matrix.yaml

# Higher parallelism
agr bench --suite test-cases/ --config agent.yaml --concurrency 4
```

Every bench run is also scored by `StaticQualityScorer` (diff size, lint violations, etc.). See [Quality scorers](/guide/concepts#quality-scorers-and-the-optimizer).

## `agr validate`

Validate a test case the way SWE-bench validates a candidate instance: static checks, then (when `test_command` is set) pre-patch and post-patch execution inside Docker.

```bash
agr validate test-cases/fix-greeting/agr.yaml
```

When `test_command` is missing, execution checks are skipped (shown with ⚠️). Use `--strict` in CI to require `test_command`, `fail_to_pass`, and `pass_to_pass`.

### Options

| Flag | Default | Description |
|---|---|---|
| `<testCase>` | Required | Path to an `agr.yaml` file. |
| `--strict` | `false` | Exit with code 1 if `test_command`, `fail_to_pass`, or `pass_to_pass` are missing. |

### Examples

```bash
# Static + execution checks (when test_command is configured)
agr validate test-cases/my-case/agr.yaml

# CI gate: reject incomplete definitions
agr validate test-cases/my-case/agr.yaml --strict
```

## `agr import-pr`

Fetch a GitHub pull request diff, split it into solution and test patches, and scaffold a new test case with `expected_files` and `forbid_modified` pre-filled.

```bash
agr import-pr owner/repo 123 --out test-cases/new-case --clone-fixture
```

With `--clone-fixture`, the repo is checked out at the PR's base commit into `<out>/fixture`, and `success`/`test_command` are guessed from the project layout (Python, Node, Go). You still need to fill in `fail_to_pass` and `pass_to_pass` manually before `agr validate` can verify execution.

Set `GITHUB_TOKEN` to avoid GitHub's low unauthenticated rate limits.

### Options

| Flag | Default | Description |
|---|---|---|
| `<repo>` | Required | GitHub repository in `owner/repo` format. |
| `<prNumber>` | Required | Pull request number. |
| `--out <dir>` | `./imported/<repo>-pr-<n>` | Output directory for the scaffolded test case. |
| `--clone-fixture` | `false` | Clone the repo at the PR's base commit into `<out>/fixture`. |
| `--validate` | `false` | Run `agr validate` after scaffolding. Most useful after filling in test name lists. |

### Examples

```bash
# Scaffold patches and agr.yaml only
agr import-pr astropy/astropy 12907 --out test-cases/astropy-12907

# Clone fixture and guess test commands
agr import-pr astropy/astropy 12907 --clone-fixture --out test-cases/astropy-12907

# Scaffold and validate (after filling in fail_to_pass/pass_to_pass)
agr import-pr astropy/astropy 12907 --clone-fixture --validate
```

## `agr trace`

Print the step trace and metrics for a single run, looked up by run ID (shown in bench/run output and stored in `.agr/db.sqlite`).

```bash
agr trace 3f1c2e2a-8b4d-4e1f-9c3a-1a2b3c4d5e6f
```

### Options

| Flag | Default | Description |
|---|---|---|
| `<runId>` | Required | UUID of the run to inspect. |
| `--quality` | `false` | Show only the quality-metrics breakdown (`static-quality`, `llm-judge`, diff, localization) instead of the full step trace. |

### Examples

```bash
# Full step-by-step trace
agr trace 3f1c2e2a-8b4d-4e1f-9c3a-1a2b3c4d5e6f

# Quality metrics only
agr trace 3f1c2e2a-8b4d-4e1f-9c3a-1a2b3c4d5e6f --quality
```
