# Module Layout — Authoritative

Every experiment worktree contains exactly ten files. Builder subagents produce all ten. Train's reviewer verifies all ten.

## Files

### 1. `data.py`

Responsibility: load the locked splits, enforce the feature whitelist, assert set-disjointness between train/val/test.

Forbidden contents: feature engineering, augmentation, synthetic data generation, any I/O outside the declared split paths.

Cross-file contract: reads split paths from `constraints.lock`. Rejects any feature not in the whitelist declared in `constraints.lock`.

### 2. `model.py`

Responsibility: define the architecture. Nothing else.

Forbidden contents: training loop, loss computation, optimizer construction, data loading.

Cross-file contract: parameter count bounded by `architecture_bounds_max_params` declared in `constraints.lock`.

### 3. `train.py`

Responsibility: execute the training loop. Loads model from `model.py`, data from `data.py`, config from `config.py`.

Forbidden contents: architecture definitions, metric computation for reporting, evaluation of the test split.

Cross-file contract: reads hyperparameters only from `config.py`.

### 4. `eval.py`

Responsibility: compute the locked metrics on val and test splits. Emit to the declared output path.

Forbidden contents: reading the train split; any metric not declared in `metrics_manifest.json`; any metric renaming or aliasing.

Cross-file contract: metric keys in the emitted JSON match `metrics_manifest.json` verbatim. When `history_keys.train_loss` or `history_keys.val_loss` is non-null in the manifest, `eval.py` emits the corresponding per-epoch array under that exact key name.

### 5. `config.py`

Responsibility: typed configuration. Every hyperparameter used anywhere in the worktree is declared here.

Forbidden contents: conditional logic, runtime discovery, defaults scattered across other files.

Cross-file contract: keys referenced in the plan's `config_diff` field must exist here.

### 6. `preflight.py`

Responsibility: pre-flight integrity gate. Verifies `constraints.lock` byte-matches the hypothesis integrity block, recomputes split hashes, verifies feature whitelist subset of data columns. Exits non-zero on any mismatch.

Forbidden contents: training, evaluation, any mutation of `constraints.lock`.

Cross-file contract: runs first inside `run.sh`. `run.sh` aborts if `preflight.py` exits non-zero.

### 7. `run.sh`

Responsibility: single entry point. Runs `python preflight.py`, then `python train.py`, then `python eval.py`. Exits on first failure.

Forbidden contents: any command other than the three declared python invocations; inline Python; parameter overrides; environment mutation beyond `PYTHONHASHSEED`.

Cross-file contract: invoked by train's runtime phase.

### 8. `metrics_manifest.json`

Responsibility: declare exact metric names, the output file path, and the extraction command.

Schema:

    {
      "metric_output_path": "<relative path>",
      "locked_metric_names": {
        "primary": "<string>",
        "secondary": ["<string>", ...],
        "integrity": ["<string>", ...]
      },
      "history_keys": {
        "train_loss": "<string | null>",
        "val_loss": "<string | null>"
      },
      "extraction_command": "<jq or grep expression>"
    }

`history_keys` declares the exact key names under which `eval.py` will emit per-epoch loss arrays. Null means no history emitted.

Cross-file contract: `locked_metric_names` values copied verbatim from the hypothesis integrity block.

### 9. `constraints.lock`

Responsibility: byte-identical copy of the hypothesis integrity block (the region between `<!-- integrity-block:start -->` and `<!-- integrity-block:end -->`, exclusive).

Forbidden contents: edits, comments, reformatting, trailing whitespace changes.

Cross-file contract: `preflight.py` recomputes SHA-256 and compares to the hypothesis sidecar hash. Any mismatch aborts the run.

### 10. `BUILD_REPORT.md`

Responsibility: module-by-module description produced by the builder subagent. One section per file. States what the builder wrote and why. Declares zero deviations on PASS.

Forbidden contents: TODO, TBD, deferred work, aspirational statements.

Cross-file contract: read by train's build reviewer subagent.

## Enforcement

Builder subagents produce all ten files or report BLOCKED_BUILD. Train's build reviewer verifies file presence, contract compliance, and `constraints.lock` byte-match before the runtime phase dispatches.
