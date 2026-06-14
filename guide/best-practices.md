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

A `MISSING` result is a *diagnostic* signal, not something prompt wording
reliably fixes. On easy tasks, a model that is confident its first attempt is
correct may skip verification entirely (no test command of any kind, not even
a generic `pytest`) rather than switch to the toolkit's `run-tests`, and
stronger wording ("you MUST...", "X is the ONLY way to...") can make adoption
*worse* by competing for attention on a task the model already considers
trivial. Treat persistent `MISSING` results as a cue to look at task
difficulty and the model's own confidence, not just at your system prompt.

If one toolkit tool internally calls another (e.g. a `rename-symbol` that
runs `run-tests` on the affected files after renaming, instead of leaving
verification to the agent), the wrapped tool still counts as "used" for
`require_tools_before_submit`, as long as it prints a self-identifying
`<name>: ...` line to its output (the way `run-tests` prints
`run-tests: running <files>`). Without that marker line, a wrapped call is
invisible to the adoption check, since the agent never invoked the wrapped
command itself.

### Scaffolding new toolkit tools

Run `agr toolkit-add <name> [--dir <toolkitDir>]` to generate a `bin/<name>`
script stub and matching `.claude/skills/<name>/SKILL.md` stub in the layout
described in [ACP Agent Adapter](/advanced/acp-agent). Fill in the
implementation and description, then reference `<toolkitDir>` from
`toolkits:` in an agent config or test case - no more hand-copying an
existing tool's pair of files and editing every reference.

### Design new toolkit tools as part of an existing workflow step

When adding a new optional `toolkits` tool, slot it into a workflow step the
agent is *already* following alongside a tool it already adopts, rather than
introducing it as its own standalone step (and especially rather than adding
it straight to `require_tools_before_submit`). A tool grouped with an
already-adopted tool for the same step (e.g. "before submit, run `lint-tool`
and `new-tool` on every changed file") tends to get picked up immediately,
even unrequired - whereas a standalone new step competes for the agent's
attention the same way stronger prompt wording does (see above).

**Caveat: don't draw conclusions from a single run.** Tool adoption on small,
synthetic tasks (e.g. one-file leetcode-style fixtures) varies a lot
run-to-run independent of toolkit design - the same agent config can adopt
every "before submit" tool on one task and skip all of them, including ones
it previously adopted, on another equally trivial task. A single A/B run
cannot reliably attribute an adoption change to a prompt or toolkit tweak;
either average over several runs, or use a task where the model isn't
confident enough to skip verification outright.

**Caveat: a redundant tool can stay unused even on a perfect-fit task.** If a
new tool's purpose overlaps with an existing, already-adopted tool's (e.g. a
"can I safely delete X?" tool vs. a general "find all references to X" tool
that can answer the same question), the agent may default to the familiar
tool even on a task designed specifically to need the new one - not because
the new tool failed to register, but because the existing tool already
satisfies the immediate question. This is distinct from the
overconfidence-driven MISSING above: the agent *did* verify before acting, it
just used tool A where you expected tool B. Before adding a tool that
overlaps with an existing one, consider whether it should instead be an
additional mode/flag on the existing tool (the existing tool then surfaces
both answers in one call) rather than a separate command competing for the
same moment in the workflow.

**Confirmed fix: fold the redundant tool's output into the adopted tool's
output.** A "can I delete X?" tool (`safe-delete`) and a "where is X used?"
tool (`find-usages`) were tested side by side on two different fixtures - a
single-file zero-usage case and a multi-file case with several call sites
per symbol. Both runs adopted only `find-usages` (3/3 calls including the
to-be-deleted symbol) and never called `safe-delete` (0/3), independent of
usage-pattern complexity or prompt ordering. Rather than removing the
redundant tool outright, its check was merged directly into the adopted
tool's output: `find-usages` now appends a one-line "no usages outside its
own definition - likely safe to delete" verdict whenever a symbol's only
match is its own declaration. A follow-up regression run confirmed the
agent still adopted `find-usages`, still removed the dead function, and did
not short-circuit on the new verdict line. This gets the redundant tool's
information to the agent for free, on the call it was already going to make,
without adding a competing step to the workflow.

### Toolkit setup hooks (`setup.sh`)

A persistent `run-tests`-MISSING result (consistent since the metric was
introduced) turned out not to be a prompt or adoption problem at all: the
fixtures used a bare `python:3.11` image, which doesn't ship `pytest`. Both
the toolkit's `run-tests` wrapper *and* the agent's own first-choice
`python -m pytest` failed identically with `No module named pytest` - the
agent then abandoned pytest entirely and fell back to ad-hoc `python -c`
assertions, which still let the task pass but meant no test runner (custom
or standard) was ever successfully invoked.

A toolkit can now ship a `setup.sh` at its root, executed once when the
toolkit is injected into the sandbox (before the agent's prompt turn
starts) - see [ACP Agent Adapter](/advanced/acp-agent#using-toolkits-with-acp-agents).
`toolkits/jetbrains-tools/setup.sh` runs `pip install -q pytest` if missing.
After this fix, the agent's own `python -m pytest test_x.py` succeeded on
the first try - fewer steps, lower cost, no failed-command detour.

`run-tests` itself was also given a defense-in-depth self-install (the same
`pip install pytest`-if-missing check), so it works correctly even without
the toolkit's `setup.sh` having run.

Note this did **not** flip `run-tests` from MISSING to adopted: once
`python -m pytest <file>` works, it satisfies the agent's verification need
on these small, single-test-file fixtures just as well as `run-tests` would
- the same "redundant tool" dynamic as above, except the competing tool here
is a standard command agentgrader can't extend with a verdict line. Treat
`run-tests` adoption as most useful as a signal on larger repos with many
test files, where finding *which* test file to run has real value over a
blind `pytest`.

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

### Validate a SWE-bench fixture's `success:` command before trusting FAIL

A `FAIL` on a SWE-bench style task can mean the agent's patch is wrong, or it can
mean the fixture's own `success:` command never passes even on the *unmodified*
fixture (a broken dependency pin, an unpinned transitive build dependency, a
flaky registry timeout). Before treating repeated `FAIL` results on a given
fixture as an agent-quality signal, run the `success:` command once against the
unmodified fixture (e.g. in a throwaway Docker container) to confirm it can pass
at all. A common culprit for Python fixtures: `pip install -e ".[test]"` without
`--no-build-isolation` builds in an isolated venv populated from
`pyproject.toml`'s `[build-system] requires`, so a version pin applied only to
the outer `pip install` (e.g. `pip install "setuptools<60"`) does not protect the
isolated build env, which can resolve a newer, incompatible build tool. If the
`success:` command fails this way, fix it once (e.g. add the same pin to
`[build-system] requires`) and re-validate before spending bench budget on that
fixture again.

## Next steps

- [Quickstart](/guide/quickstart): minimal end-to-end walkthrough
- [Core Concepts](/guide/concepts): test cases, scorers, persistence
- [Programmatic API](/advanced/programmatic-api): embed runs in custom tooling
