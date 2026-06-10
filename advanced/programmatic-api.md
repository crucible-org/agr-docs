# Programmatic API

If you want to embed Agentgrader right into your existing CI pipelines or tools, you can easily do that using the TypeScript Programmatic API exposed by `@agentgrader/core`.

## `runSingle()`

This function lets you run a single test case programmatically.

```typescript
import { runSingle } from "@agentgrader/core";
import { DockerSandboxProvider } from "@agentgrader/sandbox-docker";
import { OpenRouterAgentAdapter } from "@agentgrader/agent-openrouter";
import { initDb } from "@agentgrader/store";
import { randomUUID } from "crypto";

const result = await runSingle({
  testCase: {
    id: "my-task",
    name: "my-task",
    fixture: "./my-fixture",
    prompt: "Fix the bug in src/index.ts",
    success: [{ run: "npm test", expect: { exit_code: 0 } }],
    timeout_seconds: 300,
  },
  agentConfig: {
    id: "baseline",
    name: "baseline",
    model: "gpt-4o-mini",
    max_steps: 20,
  },
  adapter: new OpenRouterAgentAdapter(),
  sandboxProvider: new DockerSandboxProvider(),
  db: initDb(),          // This is optional. Just omit it if you want to skip saving to the database.
  runId: randomUUID(),
});

console.log(result.passed);    // This returns a boolean
console.log(result.costUsd);   // The total cost in USD, for example 0.012
console.log(result.stepsCount); // How many tool iterations the agent took
console.log(result.finalDiff); // The git diff showing exactly what changed
```

## `runBenchmark()`

This function is for when you want to orchestrate multiple test cases against multiple agent configurations all at the same time.

```typescript
import { runBenchmark } from "@agentgrader/core";

const result = await runBenchmark({
  testCases: [...],      // An array of TestCase objects
  agentConfigs: [...],   // An array of AgentConfig objects
  adapter: new OpenRouterAgentAdapter(),
  sandboxProvider: new DockerSandboxProvider(),
  concurrency: 3,        // How many should run in parallel
  onRunUpdate: (run) => {
    // This gives you streaming updates as the runs progress
    console.log(`${run.testCaseId}: ${run.status}`);
  },
});
```
