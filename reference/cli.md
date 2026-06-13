# CLI Reference

The `agr` command ships with the [`agentgrader`](https://www.npmjs.com/package/agentgrader) npm package.

```bash
npm install -g agentgrader
# or per-invocation:
bunx agentgrader <command>
```

> **Output convention**: `agr` output never contains emoji or other pictographic symbols, anywhere. Status is conveyed with plain text labels (`PASS`/`FAIL`, `[OK]`/`[WARN]`/`[FAIL]`, `[error]`) and, where the terminal supports it, ANSI/Ink color (green for pass, red for fail, yellow for warnings/in-progress, cyan for headers, gray for secondary text).

## `agr init`

Scaffold a minimal, runnable agentgrader project in the current directory (or `[dir]`), so you can try `agr run` immediately without writing any YAML by hand.

```bash
agr init
# or into a new directory:
agr init my-project
```

This creates:

- `agent.yaml`: a baseline agent config using `claude-haiku-4-5-20251001` with `provider: anthropic` and `max_steps: 15`.
- `tasks/hello-world/agr.yaml` and `tasks/hello-world/fixture/`: a tiny, self-contained test case. The fixture is a `math.js` with an unimplemented `add(a, b)` and a `math.test.js` using Node's built-in test runner (`node --test`), so no `npm install` or `pip install` is needed inside the sandbox.

After scaffolding, set `ANTHROPIC_API_KEY` in your environment and run:

```bash
agr run tasks/hello-world/agr.yaml --config agent.yaml --verbose
```

### Options

| Flag | Default | Description |
|---|---|---|
| `[dir]` | `.` | Directory to scaffold into. Created if it does not exist. |
| `--force` | `false` | Overwrite `agent.yaml` if it already exists. Without it, `agr init` refuses to run on a directory that already has an `agent.yaml`, similar to `git init` on an existing repo. |

### Examples

```bash
# Scaffold into the current directory
agr init

# Scaffold into a new directory
agr init my-project

# Re-scaffold, overwriting agent.yaml
agr init my-project --force
```

## `agr run`

Run a single test case with one agent config. Useful for debugging a specific case or iterating on prompts.

```bash
agr run test-cases/fix-greeting/agr.yaml --config agent.yaml
```

`agr run` renders a live terminal UI (built with Ink) while the agent works, then a summary panel and diff once it finishes:

- **Live steps**: each `StepEvent` the agent emits appears as soon as it happens, color-coded by kind (tool calls, tool results, messages, thinking). With `--verbose`, each step shows its tool name and a truncated content preview (up to 200 characters). Without `--verbose`, you instead get a compact running counter of step count and accumulated cost.
- **Summary panel**: a bordered `RUN SUMMARY` box showing status (`PASSED`/`FAILED`), step count, cost, duration, the prompt-cache hit rate (`prompt cache: X/Y input tokens served from cache (Z%)`), any run error, and the regression/diff/localization metric lines (skipped checks are flagged with `[skip]`).
- **Diff**: if the agent changed any files, a `Diff` panel renders the unified git diff with added lines in green, removed lines in red, and hunk headers (`@@ ...`) in cyan. Large diffs are capped at 60 lines with a "... N more line(s)" note.

Exit codes are unchanged: `0` once the run completes (regardless of `PASSED`/`FAILED`), `1` if the run itself throws (e.g. a sandbox or provider error).

### Options

| Flag | Default | Description |
|---|---|---|
| `<testCase>` | Required | Path to an `agr.yaml` file. |
| `--config <path>` | Built-in default | Path to an agent config YAML. If omitted, uses `gpt-4o-mini` with `max_steps: 20`. |
| `--verbose` | `false` | Show full per-step detail (tool name + content preview) in the live step list, instead of the compact step/cost counter. |

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
agr bench --suite test-cases/ --configs-dir agents-configs/
agr bench --manifest bench.yaml
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--manifest <path>` | (none) | Bench manifest YAML with `suite` and `agents` (paths/glob). Replaces `--suite` + `--configs` on the CLI. |
| `--suite <path>` | Required without `--manifest` | Directory containing test case folders (each with an `agr.yaml`). |
| `--configs <paths>` | One agent source required | Comma-separated paths to agent config YAML files. |
| `--config <path>` | (none) | Alias for `--configs` when you have a single agent config file. |
| `--configs-dir <dir>` | (none) | Load every `.yaml`/`.yml` file in the directory as an agent config. |
| `--matrix <path>` | (none) | Optimizer matrix YAML. Expands into the cartesian product of agent configs, tags runs with a shared `matrixId`, and prints a Pareto summary. See [Core Concepts: Optimizer matrices](/guide/concepts#optimizer-matrices). |
| `--concurrency <n>` | `2` | Number of parallel sandbox executions. Overrides manifest `concurrency` when set. |

Use only **one** agent source per run: `--manifest`, `--configs`/`--config`, `--configs-dir`, or `--matrix`.

### Examples

```bash
# Bench manifest (suite + agent glob in one file)
agr bench --manifest bench.yaml

# All agent YAMLs in a folder
agr bench --suite test-cases/ --configs-dir agents-configs/

# Single agent config (--config is an alias for --configs)
agr bench --suite test-cases/ --config agent.yaml

# Multiple agent configs
agr bench --suite test-cases/ --configs agent.yaml,agent-openrouter.yaml

# Optimizer matrix sweep
agr bench --suite test-cases/ --matrix matrix.yaml

# Higher parallelism
agr bench --manifest bench.yaml --concurrency 4
```

See [Bench Manifest YAML](/reference/bench-manifest-yaml) for the manifest file format.

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
| `--tools` | `false` | Show only a tool-usage breakdown: how many times each tool name appears across the run's `tool_call` steps, sorted by call count. |

### Examples

```bash
# Full step-by-step trace
agr trace 3f1c2e2a-8b4d-4e1f-9c3a-1a2b3c4d5e6f

# Quality metrics only
agr trace 3f1c2e2a-8b4d-4e1f-9c3a-1a2b3c4d5e6f --quality

# Tool-usage breakdown (which tools the agent actually called, and how often)
agr trace 3f1c2e2a-8b4d-4e1f-9c3a-1a2b3c4d5e6f --tools
```

`--tools` is especially useful for checking whether a custom toolkit, MCP server, or Agent Skill was actually used by the agent versus only made available to it. For example, if you wire in a custom toolkit but its tools show a count of `0`, the agent saw the tool but chose not to call it, which may be a sign the system prompt needs to nudge it more explicitly.

## `agr compare`

Compare the step traces of two completed runs side by side. Useful after a matrix or bench run with multiple agent configs on the same test case: see when and where the agents diverged (different tool calls, files, or reasoning).

```bash
agr compare 3f1c2e2a-8b4d-4e1f-9c3a-1a2b3c4d5e6f 7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d
```

Run IDs come from bench/run output or the `runs` table in `.agr/db.sqlite`. Both runs should usually share the same `test_case_id` so step indices align.

### Options

| Flag | Default | Description |
|---|---|---|
| `<runIdA>` | Required | First run to compare (shown as column A). |
| `<runIdB>` | Required | Second run to compare (shown as column B). |
| `--full` | `false` | Print full step content without the 200-character truncation used by `agr trace`. |
| `--only-diff` | `false` | Show only divergent steps, plus one step of context before and after each divergence. |

### Examples

```bash
# Full side-by-side comparison
agr compare <runIdA> <runIdB>

# Only where the runs diverged (with 1-step context)
agr compare <runIdA> <runIdB> --only-diff

# Full content for divergent steps
agr compare <runIdA> <runIdB> --only-diff --full
```

## `agr cleanup`

Lists (or, with `--yes`, removes) leftover sandbox containers from runs whose process exited or was killed before the `cleanup` workflow step could call `destroy()` - for example a hung provider request that an external `timeout` had to kill. These show up as containers running `tail -f /dev/null`, labeled `agentgrader.sandbox=true` by `DockerSandboxProvider`.

```bash
agr cleanup
agr cleanup --yes
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--yes` | `false` | Actually remove the listed containers. Without it, `agr cleanup` only lists what would be removed. |

Set `step_timeout_ms` in `agent.yaml` (see [Agent Config: `step_timeout_ms`](/reference/agent-config-yaml#step-timeout-ms)) to prevent new leftovers in the first place - `agr cleanup` is for sweeping up containers from runs that predate that fix, or from any other interrupted run.

Containers created before this label was added (older `@agentgrader/sandbox-docker` versions) won't be found by `agr cleanup`; remove those manually with `docker ps -a` / `docker rm -f`.
