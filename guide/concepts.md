# Core Concepts

When you start using Agentgrader, there are a few important concepts that form the backbone of how everything works together. Let's break them down clearly.

## 1. The Test Case (`agr.yaml`)

Think of a test case as the specific challenge you are giving to your agent. It lives inside a folder containing an `agr.yaml` file and a `fixture/` directory. The fixture folder holds the starting codebase that your agent will try to fix or modify.

```yaml
# agr.yaml
name: add-error-handling
description: fetchWithRetry() crashes on network timeout. Please make it resilient.
fixture: ./fixture          # The path to the starting codebase, relative to this file
prompt: |
  The function fetchWithRetry() in src/client.ts throws an unhandled error when
  the network times out. Add proper error handling so it retries up to 3 times
  (total of 4 attempts: 1 initial and 3 retries), then throws the error if all fail.
  Please do not change the signature of fetchWithRetry.
success:
  - run: npm install && npm test   # The command used to verify the solution
    expect: { exit_code: 0 }       # What a successful result looks like
  - assert: steps <= 10            # The agent must finish in 10 tool calls or less
  - assert: cost_usd <= 0.05       # The entire run must cost less than 5 cents
timeout_seconds: 300
```

### Types of Success Criteria:
*   `run` combined with `expect.exit_code`: This runs a shell command right in the sandbox and checks the final exit code.
*   `assert: steps <= N`: This checks how many tool calls the agent used to find a solution.
*   `assert: cost_usd <= N`: This checks the total monetary cost of the model during the run.

## 2. Agent Config (`baseline.yaml`)

This configuration file tells Agentgrader exactly which model to use and how it should behave.

```yaml
id: baseline
name: Baseline Agent
model: gpt-4o-mini          # You can use any OpenRouter model string here
max_steps: 15               # This is a hard cap on ReAct loop iterations
temperature: 0.2
system_prompt: |
  You are a professional software developer. Solve the coding task in the sandbox.
  Use executeCommand to run tests. Use readFile and writeFile to edit code.
  Call submit when all tests pass.
```

The `model` field is incredibly flexible. You can use any model that is available through OpenRouter, such as:
*   `openai/gpt-4o`
*   `anthropic/claude-opus-4`
*   `google/gemini-2.5-pro`
*   `meta-llama/llama-3.1-70b-instruct`

## 3. The Sandbox

For every single run, Agentgrader provisions a fresh and completely isolated Docker container. The starting code from the fixture folder is copied directly into `/app` inside the container. 

The agent interacts with this environment using four core tools:

| Tool | What it does |
|---|---|
| `executeCommand(command)` | Runs a bash command inside the `/app` folder of the container. |
| `readFile(path)` | Reads the contents of a specific file. |
| `writeFile(path, content)` | Writes your new content into a specific file. |
| `submit({ summary })` | Lets the framework know that the agent believes the task is complete. |

Once the agent calls `submit()` or the run hits the timeout limit, Agentgrader steps in and runs the scorers to verify the final result.

## 4. Scoring

Agentgrader handles scoring automatically at the end of each evaluation using two main tools:

*   **CommandScorer**: This runs every `run:` criterion as a shell command within the sandbox and validates the exit code.
*   **AssertionScorer**: This evaluates mathematical `assert:` expressions. You have access to variables like `steps`, `cost_usd`, `tokens_in`, and `tokens_out` to create very flexible success criteria.
