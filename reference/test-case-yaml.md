# Test Case (agr.yaml)

A test case is how you define the problem you want your agent to solve. It also sets the rules for figuring out if the agent actually succeeded. Everything is defined in a simple `agr.yaml` manifest file.

```yaml
name: add-error-handling
description: fetchWithRetry() crashes on network timeout. Please make it resilient.
fixture: ./fixture
prompt: |
  The function fetchWithRetry() in src/client.ts throws an unhandled error when
  the network times out. Add proper error handling so it retries up to 3 times
  (total of 4 attempts: 1 initial and 3 retries), then throws the error if all fail.
  Please do not change the signature of fetchWithRetry.
success:
  - run: npm install && npm test
    expect: { exit_code: 0 }
  - assert: steps <= 10
  - assert: cost_usd <= 0.05
timeout_seconds: 300

# SWE-bench based metadata (optional)
test_command: "npx tsx --test --test-reporter=tap src/client.test.ts"
fail_to_pass:
  - "should retry on failure and succeed"
pass_to_pass:
  - "should succeed on first attempt"
expected_files:
  - src/client.ts
forbid_modified:
  - src/client.test.ts
solution: ./solution.patch
```

## Schema Reference

### `name`
**Type:** `string`  
A unique string that identifies this specific test case.

### `description`
**Type:** `string`  
A short and easy to read summary explaining what the test is about.

### `fixture`
**Type:** `string`  
This is the path to the directory that holds the base code for the task. It is relative to where the `agr.yaml` file is located. When a test runs, the contents of this directory will be copied straight into the container sandbox.

### `prompt`
**Type:** `string`  
The specific instructions and context that will be handed over to the agent.

### `success`
**Type:** `Array<SuccessCriterion>`  
A list of specific checks to determine if the agent successfully completed the task.  

*   **Run Criteria**:
    *   `run`: A bash script to execute inside the sandbox environment.
    *   `expect`: These are your assertions on the command output, like expecting `exit_code: 0`.
*   **Assert Criteria**:
    *   `assert`: This is a mathematical or logical expression that looks at run statistics like `steps`, `cost_usd`, `tokens_in`, and `tokens_out`.

### `timeout_seconds`
**Type:** `number`  
The absolute maximum time allowed for the run, measured in seconds. If the agent does not finish its work or submit within this time limit, the run is considered a failure.

### SWE-bench Based Fields (Optional)

The following fields mirror the metadata found in SWE-bench instances to provide granular test scoring, tamper guards, and regression testing:

*   **`tags`**: A list of strings used for tag-based pass-rate breakdowns in the `agr bench` command.
*   **`test_command`**: The shell command used to run the test suite. The CLI currently expects TAP output to parse `PASS/FAIL/SKIP` states.
*   **`fail_to_pass`**: A list of test names that are expected to be failing before the agent's changes, and passing after.
*   **`pass_to_pass`**: A list of test names that are passing initially and must remain passing (regression guard).
*   **`forbid_modified`**: A list of glob patterns representing files the agent is NOT allowed to touch (e.g., test files to prevent tampering).
*   **`expected_files`**: A list of glob patterns of files the agent is expected to touch. Used by the `LocalizationScorer` to calculate precision/recall metrics.
*   **`solution`**: Path to a gold-standard patch (or a raw unified diff) that solves the issue. Used by the `DiffScorer` and `agr validate`.
*   **`test_patch`**: Path to a patch that adds or updates tests. This patch is applied strictly for evaluation and is completely hidden from the agent.
*   **`created_at`**: Original issue/PR creation date (useful for contamination or date-cutoff checks).
