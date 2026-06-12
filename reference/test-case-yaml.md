# Test Case (`agr.yaml`)

A test case defines the problem an agent should solve and how success is measured. Each test case is a folder containing `agr.yaml` and a `fixture/` directory with the starting codebase.

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

test_command: "node --test --test-reporter=tap src/**/*.test.js"
fail_to_pass:
  - "handles empty input"
pass_to_pass:
  - "greet returns a friendly message"
expected_files:
  - src/greet.js
forbid_modified:
  - src/greet.test.js
solution: ./solution.patch
test_patch: ./test_patch.patch
created_at: "2024-06-01T00:00:00Z"
tags:
  - javascript
```

## Schema reference

### `name`

**Type:** `string` (required)

Unique identifier for this test case.

### `id`

**Type:** `string` (optional)

Database ID. Defaults to `name` if omitted.

### `description`

**Type:** `string` (optional)

Short human-readable summary.

### `fixture`

**Type:** `string` (required)

Path to the starting codebase directory, relative to `agr.yaml`. Copied into `/app` inside the Docker sandbox at run time.

### `prompt`

**Type:** `string` (required)

Instructions handed to the agent.

### `success`

**Type:** `SuccessCriterion[]` (required)

List of pass/fail checks:

- **Run criterion**: `run: <shell command>` with `expect: { exit_code: 0 }` (or another exit code).
- **Assert criterion**: `assert: <expression>` using run statistics: `steps`, `cost_usd`, `tokens_in`, `tokens_out`. Example: `assert: steps <= 10`.

### `timeout_seconds`

**Type:** `number` (default: `300`)

Maximum run duration in seconds.

### `image`

**Type:** `string` (optional)

Custom Docker image for the sandbox. Defaults to the sandbox provider's standard image.

### `toolkits`

**Type:** `string[]` (optional)

Paths to toolkit directories (custom CLI tools + Agent Skills) injected into the sandbox for this test case, in addition to any toolkits on the agent config.

## SWE-bench fields (optional)

These fields enable per-test regression scoring, tamper guards, and gold-patch validation: the same concepts as [SWE-bench](https://www.swebench.com/).

### `tags`

**Type:** `string[]` (optional)

Labels for tag-based pass-rate breakdowns in `agr bench` output.

### `test_command`

**Type:** `string` (optional)

Shell command to run the test suite inside the sandbox. Output must be **TAP** (Test Anything Protocol) so Agentgrader can parse per-test pass/fail status.

Examples:

```yaml
# Node.js (built-in test runner)
test_command: "node --test --test-reporter=tap src/**/*.test.js"

# Python (requires pytest-tap: pip install pytest-tap)
test_command: "pytest --tap-stream"
```

TAP lines look like:

```
ok 1 - greet returns a friendly message
not ok 2 - handles empty input
```

### `fail_to_pass`

**Type:** `string[]` (optional)

Test names (as they appear in TAP output) that must be **failing** before the agent's changes and **passing** after. Used by `RegressionScorer` and `agr validate`.

### `pass_to_pass`

**Type:** `string[]` (optional)

Test names that must remain **passing** throughout (regression guard).

### `forbid_modified`

**Type:** `string[]` (optional)

Glob patterns for files the agent must not modify (e.g. test files: tamper guard). If the agent's diff touches a matching path, the run fails.

### `expected_files`

**Type:** `string[]` (optional)

Glob patterns for files the agent is expected to touch. Used by `LocalizationScorer` for precision/recall metrics.

### `solution`

**Type:** `string` (optional)

Path to a gold-standard patch (or inline unified diff) that fixes the issue. Used by `DiffScorer` and `agr validate` post-patch checks.

### `test_patch`

**Type:** `string` (optional)

Path to a patch that adds or updates tests. Applied **only during evaluation**: the agent never sees this patch (mirrors SWE-bench).

### `created_at`

**Type:** `string` (optional, ISO 8601)

Original issue or PR creation date. Used for contamination and date-cutoff checks during `agr validate`.

## Validating a test case

```bash
agr validate path/to/agr.yaml
```

Without `test_command`, execution checks are skipped (⚠️). Use `--strict` in CI to require `test_command`, `fail_to_pass`, and `pass_to_pass`. See [Best Practices](/guide/best-practices).

`agr validate` checks your definition: it does **not** auto-fill `fail_to_pass` or `pass_to_pass`. Populate those after running the test suite and reading TAP output.
