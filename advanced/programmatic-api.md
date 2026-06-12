# Programmatic API

Embed Agentgrader in CI pipelines, custom tools, or evaluation scripts using the TypeScript packages published on npm.

```bash
bun add @agentgrader/core @agentgrader/sandbox-docker @agentgrader/agent-openrouter @agentgrader/store
```

## `runSingle()`

Run a single test case programmatically:

```typescript
import { runSingle } from "@agentgrader/core";
import { DockerSandboxProvider } from "@agentgrader/sandbox-docker";
import { AiSdkAgentAdapter } from "@agentgrader/agent-openrouter";
import { StaticQualityScorer } from "@agentgrader/scorer-static";
import { initDb } from "@agentgrader/store";
import { randomUUID } from "node:crypto";

const result = await runSingle({
  testCase: {
    name: "fix-greeting",
    fixture: "./test-cases/fix-greeting/fixture",
    prompt: "Fix the greet() function so all tests pass.",
    success: [{ run: "npm test", expect: { exit_code: 0 } }],
    timeout_seconds: 300,
  },
  agentConfig: {
    name: "baseline",
    model: "openai/gpt-4o-mini",
    max_steps: 20,
  },
  adapter: new AiSdkAgentAdapter(),
  sandboxProvider: new DockerSandboxProvider(),
  db: initDb(),
  runId: randomUUID(),
  extraScorers: [new StaticQualityScorer()],
  matrixId: undefined,
  onStep: (step) => {
    console.log(`[step ${step.index}] ${step.kind}`);
  },
});

console.log(result.passed);
console.log(result.costUsd);
console.log(result.stepsCount);
console.log(result.finalDiff);
console.log(result.metrics);
```

`AiSdkAgentAdapter` is the current adapter class. `OpenRouterAgentAdapter` remains available as a backwards-compatible alias from `@agentgrader/agent-openrouter`.

`db` is optional: omit it to skip persisting to `.agr/db.sqlite`. `onStep` is optional: called for every agent step (tool calls, messages) for live progress reporting.

## `runBenchmark()`

Orchestrate multiple test cases against multiple agent configs:

```typescript
import { runBenchmark } from "@agentgrader/core";

const result = await runBenchmark({
  testCases: [...],
  agentConfigs: [...],
  adapter: new AiSdkAgentAdapter(),
  sandboxProvider: new DockerSandboxProvider(),
  concurrency: 3,
  onRunUpdate: (run) => {
    console.log(`${run.testCaseId}: ${run.status}`);
  },
  extraScorers: [new StaticQualityScorer()],
  matrixId: undefined,
});
```

## Optimizer matrix sweeps

`@agentgrader/optimizer` provides the helpers behind `agr bench --matrix`:

```typescript
import { expandMatrix, aggregateResults, paretoFront } from "@agentgrader/optimizer";
import { runBenchmark } from "@agentgrader/core";
import { getRunsByMatrixId, initDb } from "@agentgrader/store";
import { randomUUID } from "node:crypto";

const agentConfigs = expandMatrix({
  name: "model-comparison",
  base: { max_steps: 15, temperature: 0.2 },
  dimensions: {
    model: ["anthropic/claude-sonnet-4", "openai/gpt-4o-mini"],
    temperature: [0.2, 0.7],
  },
});

const db = initDb();
const matrixId = randomUUID();
await runBenchmark({ testCases, agentConfigs, adapter, sandboxProvider, db, matrixId });

const runs = await getRunsByMatrixId(db, matrixId);
const aggregates = aggregateResults(runs, agentConfigs);
const front = paretoFront(aggregates);
```

See [Core Concepts: Optimizer matrices](/guide/concepts#optimizer-matrices) for the YAML equivalent.
