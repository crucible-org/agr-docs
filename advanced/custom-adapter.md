# Custom Agent Adapter

Agentgrader is designed to be highly flexible. It allows you to bring your very own agent implementation into the framework. Whether you want to test a JetBrains AI Assistant, a local Ollama model, or proprietary agents, you can do it by writing a Custom Agent Adapter.

All you need to do is implement the `AgentAdapter` interface.

## Implementation Example

```typescript
import type { AgentAdapter, AgentResult, StepEvent } from "@agentgrader/core";

export class MyCustomAdapter implements AgentAdapter {
  readonly name = "my-agent";

  async solve(input: {
    prompt: string;
    sandbox: SandboxHandle;    // The docker sandbox where you call exec(), readFile(), writeFile()
    config: AgentConfig;       // Contains model, max_steps, system_prompt, etc.
    onStep: (step: StepEvent) => void;   // Call this for every step so Agentgrader can track your cost
  }): Promise<AgentResult> {
    // 1. Initialize your custom logic right here
    
    // 2. Loop until the task is complete or you hit max_steps
    // For example, use await input.sandbox.exec("npm test") to run commands
    // Make sure to call input.onStep() after each LLM inference to record tokens and execution traces
    
    // 3. Finalize everything and report the git diff
    const diff = await input.sandbox.gitDiff();
    
    return {
      finished: true,   // Did the agent complete and submit, or did it hit max_steps?
      finalDiff: diff,  // What the agent actually changed
    };
  }
}
```

Once you have your adapter implemented, you can pass it directly into the `runSingle` or `runBenchmark` programmatic API functions and test it out.
