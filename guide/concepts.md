# Core Concepts

Agentgrader evaluates coding agents against **test cases** in isolated Docker sandboxes. This page explains the main building blocks and how they fit together.

## Test case vs. agent config vs. run

| Concept | File | Purpose |
|---|---|---|
| **Test case** | `agr.yaml` + `fixture/` | Defines the problem: starting codebase, prompt, and success criteria |
| **Agent config** | `agent.yaml` (any path) | Defines the agent: model, temperature, system prompt, toolkits |
| **Run** | `agr run <agr.yaml>` | One agent attempting one test case |
| **Benchmark** | `agr bench --suite … --configs …` | Every test case in a suite × every agent config |
| **Matrix benchmark** | `agr bench --suite … --matrix …` | Same as bench, but agent configs are generated from an optimizer matrix YAML |

A **test case** is self-contained: an `agr.yaml` manifest and a `fixture/` directory with the starting code. You can version-control a folder per test case.

An **agent config** is reusable across many test cases. Pass it to `agr run` with `--config` or to `agr bench` with `--configs` (comma-separated) or `--config` (single file alias).

A **run** executes exactly one test case with one agent config. Results are written to the local database (see [Persistence](#persistence) below).

A **benchmark** runs the Cartesian product of all test cases in a `--suite` directory against all listed agent configs. An interactive terminal dashboard shows progress.

A **matrix benchmark** expands a matrix YAML (varying model, temperature, system prompt, etc.) into many agent configs automatically, tags every resulting run with a shared `matrixId`, and prints a Pareto summary table when finished.

## The test case (`agr.yaml`)

A test case is the specific challenge you give an agent. It lives in a folder with an `agr.yaml` file and a `fixture/` directory containing the starting codebase.

```yaml
name: fix-greeting
description: greet() is missing the exclamation mark
fixture: ./fixture
prompt: |
  The greet() function in src/greet.js should return "Hello, World!" but
  currently returns "Hello, World". Fix the function so all tests pass.
success:
  - run: npm test
    expect: { exit_code: 0 }
  - assert: steps <= 10
  - assert: cost_usd <= 0.05
timeout_seconds: 300
```

### Success criteria

- **`run` + `expect.exit_code`**: runs a shell command in the sandbox and checks the exit code.
- **`assert: steps <= N`**: limits how many tool calls the agent may use.
- **`assert: cost_usd <= N`**: limits total model cost for the run.

See [Test Case YAML](/reference/test-case-yaml) for SWE-bench fields (`test_command`, `fail_to_pass`, `pass_to_pass`, etc.).

## Agent config (`agent.yaml`)

The agent config selects the model and behavior:

```yaml
name: Baseline Agent
model: openai/gpt-4o-mini
max_steps: 15
temperature: 0.2
system_prompt: |
  You are a professional software developer. Solve the coding task in the sandbox.
  Use executeCommand to run tests. Use readFile and writeFile to edit code.
  Call submit when all tests pass.
```

By default, requests route through OpenRouter (`openai/gpt-4o-mini`, `anthropic/claude-sonnet-4`, etc.). Set `provider: openai` or `provider: anthropic` to call those APIs directly with their native model names.

See [Agent Config YAML](/reference/agent-config-yaml) for `toolkits`, `mcp_servers`, and other fields.

## The sandbox

For every run, Agentgrader provisions a fresh Docker container. The fixture is copied to `/app` inside the container. The agent interacts through four built-in tools:

| Tool | What it does |
|---|---|
| `executeCommand(command)` | Runs a bash command in `/app` |
| `readFile(path)` | Reads a file |
| `writeFile(path, content)` | Writes a file |
| `submit({ summary })` | Signals the agent believes the task is complete |

When the agent calls `submit()` or hits the timeout, scorers verify the result.

## Scoring

Core scorers determine pass/fail:

- **CommandScorer**: runs each `success` `run:` criterion and checks exit codes.
- **AssertionScorer**: evaluates `assert:` expressions (`steps`, `cost_usd`, `tokens_in`, `tokens_out`).
- **RegressionScorer**: when `test_command`/`fail_to_pass`/`pass_to_pass` are set, re-runs the test suite and checks per-test outcomes; also enforces `forbid_modified` (tamper guard).
- **DiffScorer** / **LocalizationScorer**: when `solution`/`expected_files` are set, compare the agent's diff against the gold patch and report file-level precision/recall.

### Quality scorers and the optimizer

`agr bench` also runs **additive, non-blocking** quality scorers that never affect `passed`:

- **StaticQualityScorer** (`@agentgrader/scorer-static`, always on): diff size, files touched, TODO markers, lint violations. Recorded under `metrics["static-quality"]`.
- **LlmJudgeScorer** (`@agentgrader/scorer-llm-judge`, opt-in): LLM-rated correctness and quality. Recorded under `metrics["llm-judge"]`.

Inspect these for a single run with [`agr trace <runId> --quality`](/reference/cli#agr-trace).

### Optimizer matrices

To sweep many agent configurations at once, define a matrix YAML and pass it to `agr bench --matrix`:

```yaml
name: model-comparison
base:
  max_steps: 15
  temperature: 0.2
dimensions:
  model:
    - anthropic/claude-sonnet-4
    - openai/gpt-4o-mini
  temperature:
    - 0.2
    - 0.7
```

```bash
agr bench --matrix matrix.yaml --suite ./test-cases
```

This expands every combination of `dimensions` on top of `base`, runs the full suite against each config, tags runs with a shared `matrixId`, and prints a Pareto-marked summary table.

## Persistence

Every run is recorded locally in **`.agr/db.sqlite`** (created in the directory where you invoke `agr`). Nothing is lost between runs: the database accumulates history.

| Table | Contents |
|---|---|
| `runs` | Pass/fail, cost, duration, metrics JSON, `matrixId`, status |
| `traces` | Per-step events (tool calls, messages, token counts) |
| `test_cases` / `agent_configs` | Definitions seen during runs |

Look up a run by ID with [`agr trace <runId>`](/reference/cli#agr-trace). The run ID appears in bench/run output and in the database.

To start fresh, delete `.agr/db.sqlite`. Test case folders on disk are never modified by Agentgrader: only the sandbox copy inside Docker is edited.
