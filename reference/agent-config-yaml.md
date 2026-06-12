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

- **`toolkits:`** — directories with custom CLI tools (`bin/`) and/or Agent Skills (`.claude/skills/*/SKILL.md`). Copied into the sandbox; skill names/descriptions are injected into the system prompt (full `SKILL.md` read on demand via `readFile`).
- **`mcp_servers:`** — MCP servers (stdio or remote SSE) whose tools are merged at run time, namespaced as `<serverName>_<toolName>`.

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

### `max_steps`

**Type:** `number` (default: `30`)

Hard cap on ReAct loop iterations before the agent is stopped.

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

`submit` is always available, even when omitted from `tools` — Agentgrader adds it automatically (with a console warning) because a run cannot complete without it.

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

Paths to toolkit directories containing custom CLI tools (`bin/`) and/or Agent Skills (`.claude/skills/*/SKILL.md`). At run time, toolkit files are copied into the sandbox and skill names/descriptions are appended to the system prompt (progressive disclosure — the full `SKILL.md` body is read on demand via `readFile`).

Can be set in `agent.yaml` and/or per test case in `agr.yaml`; paths from both sources are merged and deduplicated.

```yaml
toolkits:
  - ../toolkits/python-linter
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
