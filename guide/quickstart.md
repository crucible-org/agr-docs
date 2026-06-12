# Quickstart

You can run your first agent evaluation in a few minutes. Install the CLI from npm, create a minimal test case on disk, and run it.

## Prerequisites

- Node.js 18+ or [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/) installed and running
- An API key from [OpenRouter](https://openrouter.ai/),  [OpenAI](https://platform.openai.com/login?next=/settings/organization/api-keys), or Anthropic [Anthropic API Keys](https://platform.claude.com/docs/en/api/admin/api_keys/retrieve)

## 1. Install the CLI

Install globally so `agr` is on your `PATH`, or invoke it per-project with `bunx`:

```bash
npm install -g agentgrader
# or
bun add -g agentgrader
# or, without a global install:
bunx agentgrader --help
```

Verify the install:

```bash
agr --help
```

## 2. Set your API key

The CLI loads a `.env` file from the current working directory automatically. Create one in your project folder:

```bash
# .env
OPENROUTER_API_KEY=sk-or-...
```

Alternatively, export the variable in your shell:

```bash
export OPENROUTER_API_KEY=sk-or-...
```

To call Anthropic or OpenAI directly, set `provider: anthropic` or `provider: openai` in your agent config (see [Agent Config](/reference/agent-config-yaml)) and provide `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` instead.

## 3. Create a minimal test case

Create a project directory and add an agent config plus a single test case with a fixture:

```bash
mkdir -p my-benchmark/test-cases/fix-greeting/fixture/src
cd my-benchmark
```

**`agent.yaml`**: which model to use:

```yaml
name: Baseline Agent
model: openai/gpt-4o-mini
max_steps: 15
temperature: 0.2
system_prompt: |
  You are a software developer. Fix the coding task in the sandbox.
  Use executeCommand to run tests. Use readFile and writeFile to edit code.
  Call submit when all tests pass.
```

**`test-cases/fix-greeting/fixture/package.json`**:

```json
{
  "name": "fixture",
  "type": "module",
  "scripts": {
    "test": "node --test --test-reporter=tap src/greet.test.js"
  }
}
```

**`test-cases/fix-greeting/fixture/src/greet.js`**:

```js
export function greet(name) {
  return `Hello, ${name}`;
}
```

**`test-cases/fix-greeting/fixture/src/greet.test.js`**:

```js
import { test } from "node:test";
import assert from "node:assert";
import { greet } from "./greet.js";

test("greet returns a friendly message", () => {
  assert.equal(greet("World"), "Hello, World!");
});
```

**`test-cases/fix-greeting/agr.yaml`**: the test case definition:

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
timeout_seconds: 300
```

## 4. Run your first evaluation

From `my-benchmark/` (where your `.env` lives):

```bash
agr run test-cases/fix-greeting/agr.yaml --config agent.yaml
```

Expected flow:

1. Agentgrader copies the fixture into a fresh Docker container.
2. The agent reads files, runs `npm test`, and edits code.
3. A run summary prints pass/fail, step count, cost, and duration.

To watch agent steps as they happen (useful while debugging):

```bash
agr run test-cases/fix-greeting/agr.yaml --config agent.yaml --verbose
```

Example verbose output:

```
[step 1] tool_call: readFile({"path":"src/greet.js"})
[step 2] tool_result: readFile -> export function greet(name) { ...
[step 3] tool_call: executeCommand({"command":"npm test"})
...
```

## 5. Run a benchmark (optional)

Point `agr bench` at a directory of test cases and one or more agent configs:

```bash
agr bench \
  --suite test-cases/ \
  --config agent.yaml
```

`--config` is a shorthand alias for `--configs` when you only have a single agent config. Use `--concurrency 2` (default) to run evaluations in parallel.

## Next steps

- [Core Concepts](/guide/concepts): test cases, agent configs, scoring, and where results are stored
- [Best Practices](/guide/best-practices): CI gates, `fail_to_pass`/`pass_to_pass`, matrix sweeps, troubleshooting
- [CLI Reference](/reference/cli): full command and flag reference
- [Programmatic API](/advanced/programmatic-api): embed evaluations in your own Node.js or Bun code
