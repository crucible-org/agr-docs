# Best Practices

Practical patterns for teams running Agentgrader in day-to-day development and CI. These recommendations come from real benchmark workflows: fast feedback loops, reproducible scoring, and predictable cost.

## Start with `agr init`

Use the built-in scaffold instead of hand-writing every file:

::: code-group

```bash [npm]
npm install -g agentgrader
agr init my-benchmark
cd my-benchmark
```

```bash [bun]
bun add -g agentgrader
agr init my-benchmark
cd my-benchmark
```

:::

Set your API key, then run the bundled hello-world task:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
agr run tasks/hello-world/agr.yaml --config agent.yaml --verbose
```

Once that passes, replace the fixture and prompt with your own task. Keep the same folder layout (`tasks/<name>/agr.yaml` + `fixture/`).

## Project layout

A layout that scales well for teams:

```
my-benchmark/
  bench.yaml                 # optional manifest for agr bench --manifest
  agent.yaml                 # default agent for quick agr run
  agents-configs/            # one YAML per architecture you want to compare
    claude-sonnet.yaml
    gpt-mini.yaml
  test-cases/
    fix-greeting/
      agr.yaml
      fixture/
  .env                       # local only, never commit API keys
  .agr/db.sqlite             # run history (gitignore this)
```

Version-control test cases and agent configs. Ignore `.agr/` and `.env` in git.

## Validate before you benchmark

Agent runs are slow and cost money. Catch YAML mistakes first:

```bash
agr validate test-cases/fix-greeting/agr.yaml
agr validate test-cases/fix-greeting/agr.yaml --strict
```

`--strict` fails when SWE-bench fields (`test_command`, `fail_to_pass`, `pass_to_pass`) are missing. Use it in CI before any `agr bench` step.

## Fill in regression fields deliberately

For SWE-bench style scoring, `agr validate` does **not** auto-populate `fail_to_pass` or `pass_to_pass`. You must run the test suite once, read TAP output, and copy test names into `agr.yaml`:

1. Run `test_command` inside the fixture (locally or in Docker).
2. Note which tests fail on the broken fixture (`fail_to_pass`).
3. Note which tests must stay green (`pass_to_pass`).
4. Re-run `agr validate --strict` to confirm execution checks pass.

See [Test Case YAML](/reference/test-case-yaml) for the full schema.

## Set budget guardrails in YAML

Add `assert:` criteria so a run fails when an agent spirals:

```yaml
success:
  - run: npm test
    expect: { exit_code: 0 }
  - assert: steps <= 15
  - assert: cost_usd <= 0.10
timeout_seconds: 300
```

Tune limits per task difficulty. Tight limits catch runaway tool loops early.

## Choose the right bench mode

| Goal | Command |
|---|---|
| One task, one agent | `agr run tasks/foo/agr.yaml --config agent.yaml` |
| Full suite × several agents | `agr bench --suite test-cases/ --configs-dir agents-configs/` |
| Hyperparameter sweep (model × temperature) | `agr bench --matrix matrix.yaml --suite test-cases/` |
| Reproducible team config in one file | `agr bench --manifest bench.yaml` |

Use [Bench Manifest YAML](/reference/bench-manifest-yaml) when you want suite paths and agent globs checked into one file. Use `--matrix` when you need a cartesian product of dimensions, not hand-written agent files.

## Compare adapters fairly

When benchmarking an external ACP agent (Claude Code, Cursor Agent) against the built-in AI SDK loop, pass both adapters explicitly:

```bash
agr bench \
  --suite test-cases/ \
  --configs agent.yaml,agents-configs/agent-acp-claude.yaml \
  --adapters ai-sdk,acp
```

See [ACP Agent Adapter](/advanced/acp-agent) for config fields and tool routing.

## Debug failed runs

Every run gets a UUID stored in `.agr/db.sqlite`:

```bash
agr trace <runId>
agr trace <runId> --quality
```

Use `--verbose` during `agr run` to watch tool calls live. Check `metrics["static-quality"]` and `metrics["llm-judge"]` for non-blocking quality signals that do not affect pass/fail.

To reset history, delete `.agr/db.sqlite`. Test case folders on disk are never modified; only the sandbox copy inside Docker changes.

### Measuring toolkit adoption

`agr trace <runId> --tools` and the `agr bench` `TOOL USAGE BY CONFIG`
footer break down `executeCommand` (AI SDK adapter) and `terminal/create`
(ACP adapter) calls by the *first word of the command*, e.g.
`executeCommand:find-usages` or `terminal/create:pytest`, instead of one
opaque `executeCommand`/`terminal/create` total. This makes it possible to
see, at a glance, whether a custom `toolkits` CLI tool (vs. generic shell
exploration like `find`/`grep`/`cd`) is actually being used, and to compare
adoption across a `--matrix` of `toolkits` dimensions.

If you know up front which toolkit commands an agent *should* use, set
[`require_tools_before_submit`](/reference/agent-config-yaml#require-tools-before-submit)
in `agent.yaml` (e.g. `["run-tests", "inspect-code"]`). Every run then
annotates `metrics["tool-adoption"]` with which of those commands were
actually invoked before `submit`, surfaced by `agr trace --quality` and a
`TOOL ADOPTION BY CONFIG` footer in `agr bench`. This never blocks the run;
it just turns "is the agent actually using the tools I gave it" from a manual
trace-reading exercise into a structured, comparable signal.

## CI recommendations

- Install with `npm install -g agentgrader` or `bun add -g agentgrader` on the runner.
- Validate all cases with `--strict` before benchmarking.
- Store API keys in encrypted CI secrets, not in the repo.
- Cap parallelism with `--concurrency` to match runner CPU and Docker limits.
- Gate expensive suites behind labels or scheduled workflows.

Full GitHub Actions example: [CI Integration](/advanced/ci-integration).

## Docker checklist

- Docker daemon must be running locally and on CI runners.
- Pull base images ahead of large benches to avoid cold-start timeouts.
- Increase `timeout_seconds` for tasks that compile heavy dependencies on first run.

## Next steps

- [Quickstart](/guide/quickstart): minimal end-to-end walkthrough
- [Core Concepts](/guide/concepts): test cases, scorers, persistence
- [Programmatic API](/advanced/programmatic-api): embed runs in custom tooling
