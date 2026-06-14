# ACP Agent Adapter

Agentgrader can benchmark any [Agent Client Protocol (ACP)](https://agentclientprotocol.com/) compatible coding agent (Claude Code, Cursor Agent, Gemini CLI, and others) without writing a custom adapter.

The `@agentgrader/agent-acp` package implements `AcpAgentAdapter`. Agentgrader acts as the **ACP client**: it spawns the agent as a subprocess, talks JSON-RPC 2.0 over stdio via `@agentclientprotocol/sdk`, and routes file and terminal tool calls into the Docker sandbox.

## How it works

Click the sequence diagram to zoom and inspect each step.

```mermaid
sequenceDiagram
    participant AGR as Agentgrader (ACP client)
    participant Agent as ACP agent subprocess
    participant Sandbox as Docker sandbox

    AGR->>Agent: spawn + ndJsonStream(stdio)
    AGR->>Agent: initialize / session/new / session/prompt
    Agent->>AGR: fs/read_text_file
    AGR->>Sandbox: readFile()
    Sandbox-->>AGR: file content
    AGR-->>Agent: ReadTextFileResponse
    Agent->>AGR: terminal/create
    AGR->>Sandbox: exec (background)
    Sandbox-->>AGR: output / exit status
    AGR-->>Agent: terminal responses
    Agent-->>AGR: prompt complete (stopReason)
    AGR->>Sandbox: gitDiff()
```

The ACP agent process runs on the **host** (where you invoke `agr`). Sandbox isolation is preserved because every filesystem and terminal operation the agent requests is forwarded to `SandboxHandle` inside the container. Session paths use `acp_cwd` (default `/app`, matching the Docker sandbox working directory).

Permission prompts (`session/request_permission`) are auto-approved so benchmarks can run unattended in CI.

## Install

The ACP adapter ships with the CLI from Agentgrader 1.3+. For programmatic use:

::: code-group

```bash [npm]
npm install @agentgrader/agent-acp @agentgrader/core @agentgrader/sandbox-docker
```

```bash [bun]
bun add @agentgrader/agent-acp @agentgrader/core @agentgrader/sandbox-docker
```

:::

You must also install the external ACP agent binary you want to benchmark (for example `claude` with ACP mode, or `cursor-agent`) and ensure it is on your `PATH`.

## Agent config

Add ACP fields to `agent.yaml`. The `model` field is still required by the schema but is not used by the ACP adapter; set it to `acp` as a placeholder.

```yaml
name: Claude Code (ACP)
model: acp
max_steps: 30
step_timeout_ms: 300000
acp_command: claude
acp_args:
  - --acp
acp_cwd: /app
```

| Field | Description |
|---|---|
| `acp_command` | Executable name or path for the ACP agent. If `acp_args` is omitted, a single string is split on whitespace (e.g. `cursor-agent acp`). |
| `acp_args` | Optional argument list passed to `acp_command`. |
| `acp_cwd` | Working directory forwarded to `session/new` (default `/app`). |
| `acp_env` | Optional map of extra environment variables for the spawned subprocess. |
| `step_timeout_ms` | Aborts the prompt turn if the agent stalls (default `120000`). |

Ready-made examples live in the main repository under `examples/configs/agent-acp-claude.yaml` and `examples/configs/agent-acp-cursor.yaml`.

## CLI

Select the adapter explicitly; the default remains the AI SDK / OpenRouter adapter (`ai-sdk`).

```bash
agr run tasks/hello-world/agr.yaml \
  --config examples/configs/agent-acp-claude.yaml \
  --adapter acp

agr bench \
  --suite examples/suites/typescript-bugs \
  --configs examples/configs/agent-acp-claude.yaml \
  --adapters acp
```

Compare the built-in LLM loop against an external ACP agent in one bench run:

```bash
agr bench \
  --suite test-cases/ \
  --configs agent.yaml,examples/configs/agent-acp-claude.yaml \
  --adapters ai-sdk,acp
```

## Using `toolkits` with ACP agents

`toolkits:` (on the agent config or the test case) work the same way for
ACP agents as for the built-in AI SDK loop: the sandbox is set up *before*
either adapter runs, so a toolkit's `bin/` scripts are already on `PATH` and
its `.claude/skills/*/SKILL.md` files are already in `/app/.claude/skills/`
by the time the ACP agent's prompt turn starts.

This means an ACP agent (Claude Code, Cursor Agent, ...) can invoke a custom
toolkit command - e.g. a JetBrains-style `find-usages`/`view-structure`
script - via `terminal/create`, exactly as it would invoke `pytest` or
`git`. Whether it *chooses* to depends on the agent's own system prompt and
tool-selection behavior, which agentgrader does not control for ACP agents
(unlike `agent.yaml`'s `system_prompt`, which only applies to the AI SDK
adapter). Use `agr trace <runId> --tools` to check adoption either way -
`executeCommand`-equivalent terminal calls are bucketed by command name the
same as for the AI SDK adapter.

**How this is wired:** the ACP agent process itself runs on the host, but
every file and shell operation it performs for the session goes through the
ACP client methods (`fs/read_text_file`, `fs/write_text_file`,
`terminal/create`), which agentgrader's `AcpAgentAdapter` implements by
forwarding into the Docker sandbox (resolving relative paths against
`acp_cwd`, default `/app`). So `readFile(".claude/skills/find-usages/SKILL.md")`
and `terminal/create({ command: "find-usages", args: [...] })` both resolve
inside the same sandbox container where `toolkits:` placed those files -
there is no separate host-side copy for the agent to miss.

### Scaffolding a new toolkit tool

Use `agr toolkit-add <name>` to generate the `bin/<name>` script and
`.claude/skills/<name>/SKILL.md` stubs for a new toolkit command, in the
layout both adapters expect:

```bash
agr toolkit-add find-usages --dir ./toolkits/jetbrains-tools
```

This creates `./toolkits/jetbrains-tools/bin/find-usages` (executable stub)
and `./toolkits/jetbrains-tools/.claude/skills/find-usages/SKILL.md`. Fill in
the script's implementation and the skill's description, then reference the
toolkit directory from `toolkits:` in an agent config or test case. `--dir`
defaults to `./toolkit`.

## Programmatic API

```typescript
import { runSingle } from "@agentgrader/core";
import { AcpAgentAdapter } from "@agentgrader/agent-acp";
import { DockerSandboxProvider } from "@agentgrader/sandbox-docker";

const result = await runSingle({
  testCase,
  agentConfig: {
    name: "claude-acp",
    model: "acp",
    max_steps: 30,
    acp_command: "claude",
    acp_args: ["--acp"],
    acp_cwd: "/app",
  },
  adapter: new AcpAgentAdapter(),
  sandboxProvider: new DockerSandboxProvider(),
  runId: crypto.randomUUID(),
});

console.log(result.passed, result.finalDiff);
```

For cross-adapter matrices, pass multiple adapters to `runBenchmark()`:

```typescript
import { AcpAgentAdapter } from "@agentgrader/agent-acp";
import { AiSdkAgentAdapter } from "@agentgrader/agent-openrouter";

await runBenchmark({
  testCases,
  agentConfigs,
  adapters: [new AiSdkAgentAdapter(), new AcpAgentAdapter()],
  sandboxProvider,
});
```

## Tool routing

| ACP client method | Sandbox |
|---|---|
| `fs/read_text_file` | `sandbox.readFile()` |
| `fs/write_text_file` | `sandbox.writeFile()` |
| `terminal/create` | background `sandbox.exec()` |
| `terminal/output`, `terminal/wait_for_exit`, `terminal/kill`, `terminal/release` | poll/kill temp files in the container |
| `session/request_permission` | auto-approve first allow option |

Session updates (`tool_call`, `agent_message_chunk`, etc.) are mapped to `StepEvent` traces for `agr trace` and the live run UI.

## Completion and errors

When the agent finishes a prompt turn, `AcpAgentAdapter` calls `sandbox.gitDiff()` and returns `finished: true` if `stopReason` is `end_turn`. Other stop reasons (`cancelled`, `max_tokens`, etc.) set `finished: false` and populate `AgentResult.error`, surfaced as `agent error:` in `agr trace`.

If you need a different agent integration (custom auth, non-stdio transport, proprietary tools), implement your own adapter; see [Custom Agent Adapter](/advanced/custom-adapter).
