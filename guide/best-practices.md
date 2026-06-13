# Best Practices

Practical guidance for authoring test cases, running evaluations in CI, and debugging agent behavior.

## Validate before you benchmark

Use `agr validate` to check a test case definition before spending tokens on a full agent run:

```bash
agr validate test-cases/my-case/agr.yaml
```

Validation performs static field checks and, when `test_command` is configured, runs pre-patch and post-patch execution checks inside Docker (verifying `fail_to_pass` tests currently fail and `pass_to_pass` tests pass, then that the gold `solution` patch fixes them).

### When `test_command` is missing

If `test_command` is not set, execution checks are **skipped** and reported with ⚠️: validation still passes for YAML structure alone. Do not treat a green `agr validate` as proof that Docker execution was verified unless execution checks actually ran.

### Use `--strict` in CI

For pipelines that should reject incomplete test cases, use:

```bash
agr validate test-cases/my-case/agr.yaml --strict
```

`--strict` exits with code 1 if `test_command`, `fail_to_pass`, or `pass_to_pass` are missing. This prevents "YAML lint only" from passing as a quality gate.

Example GitHub Actions step:

```yaml
- name: Validate test cases
  run: |
    npm install -g agentgrader
    for f in test-cases/*/agr.yaml; do
      agr validate "$f" --strict
    done
```

See [CI Integration](/advanced/ci-integration) for a full workflow example.

## Filling in `fail_to_pass` and `pass_to_pass`

These fields list **individual test names** as they appear in TAP output. Agentgrader parses TAP lines like:

```
ok 1 - greet returns a friendly message
not ok 2 - handles empty input
```

### Workflow

1. Set `test_command` to a command that produces TAP output. For Node.js:

   ```yaml
   test_command: "node --test --test-reporter=tap src/**/*.test.js"
   ```

   For Python (requires [pytest-tap](https://pypi.org/project/pytest-tap/)):

   ```yaml
   test_command: "pytest --tap-stream"
   ```

2. Run the test suite manually inside the fixture (or use `agr import-pr --clone-fixture` and inspect output) to collect exact test names.

3. Add names to the lists:

   ```yaml
   fail_to_pass:
     - "handles empty input"
   pass_to_pass:
     - "greet returns a friendly message"
   ```

4. Run `agr validate` to confirm pre-patch and post-patch behavior.

`agr validate` does **not** auto-populate these fields: it only verifies the definition once you fill them in. `agr import-pr` scaffolds empty lists with TODO comments as a starting point.

## Debug agent runs with `--verbose`

Long agent runs can appear silent for 30 to 60 seconds. Stream steps live:

```bash
agr run test-cases/my-case/agr.yaml --config agent.yaml --verbose
```

Each step prints a compact line:

```
[step 3] tool_call: executeCommand({"command":"npm test"})
[step 4] tool_result: executeCommand -> exit_code 1, ...
[step 5] message: I'll fix the off-by-one error...
```

Long `content` strings are truncated to keep output readable. Without `--verbose`, behavior is unchanged: you only see the final summary.

After the run, inspect the full trace:

```bash
agr trace <runId>
```

## When to use `tools` allowlist

By default every agent gets all local sandbox tools plus every tool from configured MCP servers. Set `tools` in `agent.yaml` when you want to **restrict** what the model can call:

- **Read-only reviewers:** allow `readFile` and `executeCommand` but omit `writeFile` so the agent cannot modify the fixture directly.
- **MCP hygiene:** when several MCP servers are connected, allowlist only the namespaced tools you intend (e.g. `github_create_issue`) and exclude the rest.
- **Minimal agents:** force shell-only workflows with `executeCommand` + `submit` and no file tools.

`submit` is always added implicitly. Unknown tool names in the list are ignored with a warning.

See [Agent Config YAML](/reference/agent-config-yaml#tools).

## Getting agents to actually use a custom `toolkits` skill

Adding a toolkit (`toolkits:` in `agent.yaml`/`agr.yaml`) makes its `bin/`
scripts and `.claude/skills/*/SKILL.md` available, but the model still has
to *choose* to call them over the built-in `executeCommand`/`readFile`. Use
[`agr trace <runId> --tools`](/reference/cli#agr-trace) after a run to check
the actual call counts; a custom tool sitting at `0` while
`readFile`/`executeCommand` are high means it was available but unused.

If adoption is low:

- **Be directive in `system_prompt`**, not just descriptive. "You have a
  `find-usages` tool" is weaker than "Before reading a file to locate a
  definition or call site, run `find-usages <symbol>` first."
- **Make the `SKILL.md` description say *when*, not just *what***. Skill
  descriptions are injected into the system prompt up front; the model
  decides whether to read the full `SKILL.md` based on that one line.
  "Finds all references to a symbol across the codebase - use this instead
  of grep when exploring unfamiliar code" beats "Find Usages tool".
- **Test on tasks that reward the tool.** A trivial single-file task gives
  the model no reason to reach for a cross-file search/rename tool; adoption
  is more visible on tasks that span multiple files.
- Re-run and re-check `--tools` after each prompt tweak. Adoption rate
  (custom-tool calls / total tool calls) across a few runs is a much more
  reliable signal than reading a single trace.
- **Give it enough `max_steps`.** Toolkit-heavy exploration (reading
  structure, searching usages, checking git history before editing) burns
  AI-SDK steps quickly - a step limit tuned for a "read one file, make one
  edit" baseline agent (e.g. `max_steps: 20`) can leave a toolkit-using
  agent still investigating when it runs out. 30+ is a more realistic
  starting point once a toolkit is wired in.

## `agent_config` in `agr.yaml` vs. bench config flags

| Goal | Approach |
|---|---|
| One test case, one default agent; `agr run` with no flags | `agent_config: ../agent.yaml` in `agr.yaml` |
| Same agent across an entire suite; `agr bench` with no config flags | Every test case references the **same** `agent_config` path |
| Compare N agents × M test cases | `agr bench --configs-dir …` or `--configs a.yaml,b.yaml` |
| Sweep hyperparameters (model × temperature × prompt) | `agr bench --matrix matrix.yaml` |
| Reproducible suite + agent list in one file | `agr bench --manifest bench.yaml` |

Per-test-case `agent_config` values are **not** expanded into a Cartesian product on `agr bench`. If test cases point at different agent configs, bench fails unless you pass explicit `--configs` / `--matrix` / `--manifest`.

## Compare agents with matrix benchmarks

When evaluating multiple models or hyperparameters, use a matrix YAML instead of maintaining many separate agent config files:

```yaml
name: model-sweep
base:
  max_steps: 20
  temperature: 0.2
dimensions:
  model:
    - openai/gpt-4o-mini
    - anthropic/claude-sonnet-4
```

```bash
agr bench --suite test-cases/ --matrix matrix.yaml
```

Every run shares a `matrixId`. After the benchmark, a **MATRIX SUMMARY** table shows solve rate, average cost, and quality metrics per config, with Pareto-optimal entries marked.

For programmatic access to matrix results, see [Programmatic API: Optimizer Matrix Sweeps](/advanced/programmatic-api#optimizer-matrix-sweeps).

## Troubleshooting

### Docker is not reachable

Agentgrader requires a running Docker daemon. Symptoms include errors about connecting to the Docker socket or failing to create containers.

- Ensure Docker Desktop (or the Docker engine on Linux) is running.
- On Linux CI runners, the `ubuntu-latest` GitHub Actions image includes Docker.
- Verify with `docker ps` before running `agr`.

### Missing API keys

The CLI loads `.env` from the current working directory. If no key is found, the adapter throws a clear error naming the missing variable (`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` depending on `provider`).

Create a `.env` file next to where you run `agr`:

```bash
OPENROUTER_API_KEY=sk-or-...
```

Or export the variable in your shell or CI secrets.

### Validation passes but execution was skipped

If `test_command` is empty, `agr validate` shows:

```
⚠️ execution-checks (skipped - no test_command)
```

and prints a note that only static checks ran. This is expected for scaffolded test cases: fill in `test_command` and test name lists before relying on validation as a quality gate. Use `--strict` in CI to catch this early.

### Skipped scorers in run summary

When `fail_to_pass`/`pass_to_pass` or `expected_files` are not configured, the run summary shows warnings like:

```
⚠️ Regression: No fail_to_pass/pass_to_pass criteria configured; skipping regression check.
⚠️ Localization: No expected_files configured; skipping localization check.
```

These are informational: the run still passes or fails based on `success` criteria. Add SWE-bench fields when you need per-test regression checks or localization metrics.

### A run stops mid-trace with no RUN SUMMARY, and a sandbox container is left running

Symptoms: `agr run --verbose` (or a script built around `runSingle`) prints a series of `[step N]` lines and then nothing else - no `RUN SUMMARY`, no error, and `docker ps` shows a leftover container still running `tail -f /dev/null` for that test case.

This means a single `generateText` call to the model provider never settled (no response, no error) - the entire run, including the `cleanup` step that destroys the sandbox, is blocked on that one awaited call forever. Raising `max_steps` does not help, since the run never reaches the step limit.

The same stall can also end the process instead of hanging it: if the dropped connection was the last live handle, the event loop drains and the process exits with code 0 and no output at all. A run that "vanishes" mid-trace with a clean exit code is this same problem, not a crash in your script.

Set `step_timeout_ms` (default `120000`) in `agent.yaml` - see [Agent Config: `step_timeout_ms`](/reference/agent-config-yaml#step-timeout-ms). When a request hangs past this limit, it is aborted, the error is logged, and the run proceeds to scoring and cleanup normally. Lower it (e.g. to `60000`) to fail faster while iterating, or raise it for models/providers known to have slow individual responses.

If you hit this with an older `agentgrader`/`@agentgrader/agent-openrouter` build that predates `step_timeout_ms`, manually `docker rm -f` the leftover container (it will be `tail -f /dev/null` with no other process running) and upgrade.

### `[WARN] ... unrecognized field(s) "..."` when loading a config

`agr run`, `agr bench`, and `agr validate` now warn on stderr if `agent.yaml` or `agr.yaml` contains a top-level key that the installed `@agentgrader/core` doesn't recognize, for example:

```
[WARN] agent config "agent.yaml": unrecognized field(s) "step_timeout_ms" - these are silently ignored. Likely causes: a typo, or your installed @agentgrader/core doesn't support this field yet (e.g. step_timeout_ms, escalate_after_steps/escalate_model). Check your @agentgrader/core version.
```

This catches a "config version-skew" trap: zod's `.parse()` silently drops unrecognized keys, so a field your YAML sets - `step_timeout_ms`, `escalate_after_steps`/`escalate_model`, etc. - can have *zero effect* with no error if your `@agentgrader/core` predates that field. Before this warning existed, the symptom was indistinguishable from the field simply "not helping" (e.g. a configured `step_timeout_ms: 90000` silently falling back to the 120s default).

If you see this warning, either fix the typo or upgrade `@agentgrader/core` (and re-run `bun link @agentgrader/core` in any project that links it locally, per [Testing unpublished crucible changes locally](#testing-unpublished-crucible-changes-locally) below) so the field takes effect.

### A run finished with `finished: false` but `agr trace` shows no score detail

A run can end up with `finished: false` for two very different reasons that otherwise look identical: either the agent submitted a solution that failed scoring, or the agent loop itself never reached `submit` (an error or a `step_timeout_ms` abort cut it off first).

Run `agr trace <runId>` and check for an `agent error:` line, which is populated from `metrics.agentError`. If present, the agent loop itself errored or was aborted (the message names `step_timeout_ms` when that was the cause), and the run never got a real chance to solve the task, no matter what the scorers say. If absent, the agent ran to completion (or `max_steps`) and the failure is a genuine scoring miss.

### `agr bench` flag errors

`agr bench` requires `--suite` and either `--configs`, `--config`, or `--matrix`. If you pass `--config` to bench (singular), it works as an alias for a single `--configs` path: the same flag name as `agr run --config` but with different semantics on each command.

### `pip install -e` fails with `ModuleNotFoundError: setuptools.dep_util`

When importing older Python projects with `agr import-pr --clone-fixture` (for example pre-2023 `astropy` or `numpy` pull requests), the `success.run` command may fail during `pip install -e ".[test]"` with:

```
ModuleNotFoundError: No module named 'setuptools.dep_util'
```

This happens because `setuptools >= 60` removed `setuptools.dep_util`, which `numpy.distutils`/`extension_helpers`-based `setup.py` builds in older repos still import. It is an environment incompatibility with the fixture's era, not an agent or scoring bug.

Fix by pinning an older `setuptools` (and `wheel`) before the editable install in `agr.yaml`:

```yaml
success:
  - run: pip install -q "setuptools<60" wheel && pip install -q -e ".[test]" && python -m pytest ...
    expect:
      exit_code: 0
```

Check `--tools` (see [`agr trace --tools`](/reference/cli#agr-trace)) to confirm the agent's steps were spent on the actual task rather than fighting the build, then re-run.

## Testing unpublished crucible changes locally

If you're iterating on `@agentgrader/agent-openrouter` (or another
crucible package) and want to test the change against a project that
depends on the *published* `agentgrader` CLI - without an npm publish:

1. `cd packages/<package> && bun link` in the crucible checkout.
2. `bun link @agentgrader/<package>` in the other project. This points the
   *top-level* `node_modules/@agentgrader/<package>` at your local build.

**Caveat**: the published `agentgrader` CLI package ships with its own
`node_modules/agentgrader/node_modules/@agentgrader/<package>` (normal
package-manager dependency isolation). Node/Bun module resolution prefers
that *nested* copy over your top-level link, so `bunx agr run` will keep
using the old, published code - the link alone isn't enough, and you
should not hand-edit anything under `node_modules/agentgrader/` to force
it.

Instead, write a small standalone script that calls `runSingle` /
`AiSdkAgentAdapter` directly:

```ts
import { runSingle, type AgentConfig, type TestCase /* ... */ } from "@agentgrader/core";
import { AiSdkAgentAdapter } from "@agentgrader/agent-openrouter"; // resolves your linked build
import { DockerSandboxProvider } from "@agentgrader/sandbox-docker";

// load testCase/agentConfig from agr.yaml/agent.yaml (same as the CLI does),
// then:
const result = await runSingle({
  testCase, agentConfig,
  adapter: new AiSdkAgentAdapter(),
  sandboxProvider: new DockerSandboxProvider(),
  runId: crypto.randomUUID(),
  onStep: (step) => console.log(step),
});
```

This imports `@agentgrader/agent-openrouter` from the top level (your
link), while `@agentgrader/core`/`@agentgrader/sandbox-docker` come from
the dependent project's already-published, working versions. `db` is
optional on `RunSingleInput` - omit it if `@agentgrader/store`'s bundled
`better-sqlite3` has a Node/Bun ABI mismatch in that project (the run still
works, it just won't be recorded to `.agr/db.sqlite`).

**Always wrap your script's entry point in `.catch()`.** `runSingle` itself
never throws - it catches everything internally and resolves with
`result.error` set - but a standalone script has no equivalent guard around
its own top-level code. If anything outside `runSingle` throws (or any
promise anywhere goes unhandled), the process can exit immediately with
*zero* output: no `RUN SUMMARY`, no error, just a script that silently
stops, identical at first glance to the `step_timeout_ms` hang above but
with no log line to tell them apart - and any sandbox container created
before the crash is leaked (catch it with `agr cleanup`). Use:

```ts
main().catch((err) => {
  console.error(`Fatal error: ${err?.stack || err}`);
  process.exit(1);
});
```
