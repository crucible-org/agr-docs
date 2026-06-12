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

Pass the file to `agr run --config agent.yaml` or `agr bench --configs agent.yaml`.

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

Reserved for future per-tool configuration. The default agent uses the built-in sandbox tools (`executeCommand`, `readFile`, `writeFile`, `submit`).

### `toolkits`

**Type:** `string[]` (optional)

Paths to toolkit directories containing custom CLI tools and Agent Skills (`SKILL.md` files). Toolkits are injected into the sandbox and their skill names/descriptions are appended to the system prompt. Can also be set per test case in `agr.yaml`.

### `mcp_servers`

**Type:** `record<string, McpServerConfig>` (optional)

MCP servers to connect to and expose as additional agent tools. Each entry is keyed by a short name.

**Stdio server:**

```yaml
mcp_servers:
  my-tools:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/app"]
```

**HTTP/SSE server:**

```yaml
mcp_servers:
  remote:
    type: http
    url: https://example.com/mcp
    headers:
      Authorization: Bearer ${TOKEN}
```
