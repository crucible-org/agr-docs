# Agent Config (`agent.yaml`)

The agent config selects which model to use, how many steps it may take, and the system prompt injected at the start of each run.

```yaml
name: Baseline Agent
provider: openrouter
model: openai/gpt-4o-mini
max_steps: 15
temperature: 0.2
system_prompt: |
  You are a professional software developer. Solve the coding task in the sandbox.
  Use executeCommand to run tests. Use readFile and writeFile to edit code.
  Call submit when all tests pass.
```

Pass the file to `agr run --config agent.yaml` or `agr bench --configs agent.yaml`. You can also set `agent_config` in `agr.yaml` so `agr run` picks it up without `--config`.

## Built-in sandbox tools, toolkits, and MCP

Every agent gets four local sandbox tools by default: `executeCommand`, `readFile`, `writeFile`, and `submit`. You can **restrict** which of these the model may call with the optional `tools:` allowlist (see below).

Beyond those defaults, you can extend what the agent can do in two ways (both configured in `agent.yaml`, and optionally duplicated per test case via `toolkits` in `agr.yaml`):

- **`toolkits:`** directories with custom CLI tools (`bin/`) and/or Agent Skills (`.claude/skills/*/SKILL.md`). Copied into the sandbox; skill names/descriptions are injected into the system prompt (full `SKILL.md` read on demand via `readFile`).
- **`mcp_servers:`** MCP servers (stdio or remote SSE) whose tools are merged at run time, namespaced as `<serverName>_<toolName>`.

Many setups only need the four built-in tools; use `toolkits` or `mcp_servers` when you need domain-specific commands or external integrations.

## Schema reference

### `name`

**Type:** `string` (required)

Human-readable name for this configuration. Shown in bench dashboards and stored in the database.

### `id`

**Type:** `string` (optional)

Unique identifier. Defaults to `name` if omitted.

### `model`

**Type:** `string` (required)

LLM identifier. With the default OpenRouter provider, use OpenRouter model strings (`openai/gpt-4o`, `anthropic/claude-sonnet-4`). With `provider: openai` or `provider: anthropic`, use that provider's native model names.

### `provider`

**Type:** `string` (optional, default: `openrouter`)

API gateway: `openrouter`, `openai`, or `anthropic`. Determines which environment variable is required (`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`).

With `provider: anthropic`, the system prompt and tool definitions are sent with a cache-control breakpoint (`cache_control: { type: "ephemeral" }`), so Anthropic caches that prefix for 5 minutes. Repeated runs with the same `agent.yaml` (e.g. `agr bench`/matrix sweeps over many test cases) only pay full input price for the system-prompt+tools prefix on the first run; later runs within the cache window pay the discounted cache-read rate. `agr trace <runId>` shows a `prompt cache: X/Y input tokens served from cache` summary once this kicks in. No effect on other providers.

### `max_steps`

**Type:** `number` (default: `30`)

Hard cap on ReAct loop iterations before the agent is stopped.

### `step_timeout_ms`

**Type:** `number` (default: `120000`)

A per-step inactivity watchdog: aborts the agent loop if a single step makes no progress for this many milliseconds. The timer resets every time a step finishes, so a long run of many healthy steps is never cut off; only a step that genuinely stalls (a provider request that never settles, for example because the connection silently died) triggers the abort. Without this, a stalled request leaves the entire run, including its sandbox container, stuck with no result and no cleanup. When the watchdog fires, the run records an agent error (visible as `agent error:` in `agr trace`) and proceeds to scoring and cleanup as if the agent had stopped on its own.

Raise this if you expect individual steps to legitimately take longer (e.g. a model that "thinks" for a long time before responding, or a `success.run` command invoked via `executeCommand` that takes minutes).

Note for `@agentgrader/agent-openrouter` 3.x and earlier: the original implementation used `AbortSignal.timeout`, which capped the entire loop (not a single step) and could fail to fire at all on a silently dropped connection, letting the run process exit with no output and exit code 0. Upgrade if you see runs vanish mid-trace with no error.

### `temperature`

**Type:** `number` (optional)

Sampling temperature for the model.

### `system_prompt`

**Type:** `string` (optional)

System message injected at the start of the run. Define the agent's persona and available tools here.

### `tools`

**Type:** `string[]` (optional)

Allowlist of tool names the agent may call. Valid names:

- **Local tools:** `executeCommand`, `readFile`, `writeFile`, `submit`
- **MCP tools:** `<mcpServerName>_<toolName>` (namespace prefix = server name from `mcp_servers`)

`submit` is always available, even when omitted from `tools`. Agentgrader adds it automatically (with a console warning) because a run cannot complete without it.

When `tools` is **not** set, all local tools plus all tools from every configured MCP server are available (default, unchanged behavior).

Names that do not match any local or MCP tool are ignored with a console warning.

```yaml
name: read-only-reviewer
model: claude-sonnet-4-6
max_steps: 15
tools:
  - readFile
  - executeCommand
```

### `toolkits`

**Type:** `string[]` (optional)

Paths to toolkit directories containing custom CLI tools (`bin/`) and/or Agent Skills (`.claude/skills/*/SKILL.md`). At run time, toolkit files are copied into the sandbox and skill names/descriptions are appended to the system prompt (progressive disclosure: the full `SKILL.md` body is read on demand via `readFile`).

Can be set in `agent.yaml` and/or per test case in `agr.yaml`; paths from both sources are merged and deduplicated.

```yaml
toolkits:
  - ../toolkits/python-linter
```

### `require_tools_before_submit`

**Type:** `string[]` (optional)

Command names (e.g. a toolkit's `run-tests` or `inspect-code`, or a generic `pytest`/`biome`) that should have been invoked at least once before `submit`. Checked against direct tool names and the first word of `executeCommand`/`terminal/create` commands (see [Measuring toolkit adoption](/guide/best-practices#measuring-toolkit-adoption)).

This never blocks the run or affects `passed`/`score`; it only annotates `metrics["tool-adoption"]` with `{ passed, detail, required, missing }`, surfaced by `agr trace --quality` and the `TOOL ADOPTION BY CONFIG` footer of `agr bench`. Useful for spotting toolkit tools that are configured and described to the agent but never actually used.

```yaml
toolkits:
  - ../toolkits/jetbrains-tools
require_tools_before_submit:
  - run-tests
  - inspect-code
```

### `mcp_servers`

**Type:** `record<string, McpServerConfig>` (optional)

Connects to the listed MCP servers and exposes their tools alongside the local sandbox tools, namespaced as `<serverName>_<toolName>`.

**Stdio transport** (`command` / `args` / `env`):

```yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

**Remote transport** (`url` / `headers`, SSE):

```yaml
mcp_servers:
  remote:
    url: https://example.com/mcp
    headers:
      Authorization: Bearer ${TOKEN}
```

### `escalate_after_steps` / `escalate_model`

**Type:** `number` / `string` (both optional)

Model escalation: if the agent has not called `submit` after `escalate_after_steps` steps, the loop switches to `escalate_model` for all remaining steps. Useful for starting on a cheap model and falling back to a stronger one only when the cheap model is struggling - similar to how IDE chat agents (Cursor, JetBrains AI Assistant) let a single conversation move between models.

```yaml
model: claude-haiku-4-5-20251001
provider: anthropic
escalate_after_steps: 15
escalate_model: claude-sonnet-4-6
```

Both fields must be set for escalation to take effect; `escalate_model` is resolved through the same `provider` auto-detection as `model`, so it can be on a different provider (e.g. escalate from an OpenRouter model to a native Anthropic one) as long as the corresponding API key is available. The switch happens at most once per run and is logged to stderr as `[escalate] step N >= escalate_after_steps (...) - switching to ...`.

## ACP agent fields

Use these fields with `@agentgrader/agent-acp` and `--adapter acp`. They configure an external ACP-compatible agent subprocess (Claude Code, Cursor Agent, etc.) instead of the built-in AI SDK loop. See [ACP Agent Adapter](/advanced/acp-agent) for architecture and CLI examples.

### `acp_command`

**Type:** `string` (optional)

Executable for the ACP agent. Required when using `--adapter acp`. Examples: `claude`, `cursor-agent`. If `acp_args` is omitted, the string is split on whitespace (`cursor-agent acp` becomes command `cursor-agent` with arg `acp`).

### `acp_args`

**Type:** `string[]` (optional)

Arguments passed to `acp_command`, for example `["--acp"]` or `["acp"]`.

### `acp_cwd`

**Type:** `string` (optional, default: `/app`)

Working directory sent to `session/new`. Should match the sandbox root (`/app` for the default Docker provider).

### `acp_env`

**Type:** `record<string, string>` (optional)

Extra environment variables for the spawned ACP subprocess (API keys the agent binary expects, etc.).

```yaml
name: Claude Code (ACP)
model: acp
step_timeout_ms: 300000
acp_command: claude
acp_args:
  - --acp
acp_cwd: /app
```

When using the ACP adapter, `provider`, `temperature`, `system_prompt`, `tools`, and `mcp_servers` in this file are ignored; the external agent brings its own model and tooling. `step_timeout_ms` still applies to the prompt turn.

## Example: toolkits, MCP, and allowlist combined

```yaml
name: full-featured-agent
model: claude-sonnet-4-6
max_steps: 30
toolkits:
  - ../toolkits/python-linter
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
tools:
  - executeCommand
  - readFile
  - writeFile
  - github_create_issue
```
