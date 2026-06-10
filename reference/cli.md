# CLI Reference

The command line tool for this project is called `agr`. You can easily install it globally by running `npm install -g agentgrader`.

## `agr bench`

This command runs a complete benchmark. It evaluates all of your specified test cases against every agent configuration you provide. It also supports running these tests in parallel to save time. While it runs, you will see a live interactive dashboard right in your terminal to keep track of the progress.

```bash
agr bench \
  --suite examples/suites/typescript-bugs/ \
  --configs examples/configs/baseline.yaml \
  --concurrency 2
```

### Available Options

| Flag | Default | Description |
|---|---|---|
| `--suite` | Required | The path pointing to a directory filled with test case folders. |
| `--configs` | Required | A comma separated list of paths to your agent configuration YAML files. |
| `--concurrency` | `2` | Determines how many benchmark runs should execute at the same time. |

## `agr run`

If you want to run just a single test case, this is the command to use. It is especially helpful when you are debugging specific tests or actively developing new agents.

```bash
agr run examples/suites/typescript-bugs/add-error-handling/agr.yaml \
  --config examples/configs/baseline.yaml
```

### Available Options

| Flag | Default | Description |
|---|---|---|
| (positional) | Required | The exact path to a specific `agr.yaml` test case file. |
| `--config` | Optional | The path to your agent config YAML. If you leave this out, it defaults to using `gpt-4o-mini` with a maximum of 20 steps. |

## `agr validate`

This command validates a test case the way SWE-bench validates a candidate task before it's added to a benchmark. It runs static checks, a pre-patch run (verifying FAIL_TO_PASS tests fail and PASS_TO_PASS tests pass), and a post-patch run using the gold solution.

```bash
agr validate examples/suites/typescript-bugs/add-error-handling/agr.yaml
```

### Available Options

| Flag | Default | Description |
|---|---|---|
| (positional) | Required | The exact path to a specific `agr.yaml` test case file. |

## `agr import-pr`

This command fetches a PR's diff from GitHub, splits it into a gold solution patch and an optional test patch, and automatically scaffolds a new `agr.yaml` test case complete with `expected_files` and `forbid_modified` fields.

```bash
agr import-pr agentgrader/agr 123 --outdir examples/suites/new-bug
```

### Available Options

| Flag | Default | Description |
|---|---|---|
| (positional) | Required | The GitHub repository in `owner/repo` format. |
| (positional) | Required | The Pull Request number. |
| `--outdir` | Required | The destination directory to scaffold the test case into. |
