# Build Craftsmanship Reference

## Core Principle

Experiments are production code, not scratchpads. Modules are typed, single-responsibility, and fail loud. A reviewer must be able to hold one file in context at once and audit it against the spec without running it.

## Required Module Layout

### `data.py`

Loads the locked split files by exact path, enforces the feature whitelist, asserts train/val/test set-disjointness before returning any data, and re-verifies the split SHA-256 sidecars against the recorded digests.

Forbidden: generating splits, filling missing values with defaults, loading features outside the whitelist, silencing decode errors, resampling rows, reordering rows between runs.

### `model.py`

Defines the architecture from the typed config and returns the model object.

Forbidden: data loading, training logic, metric computation, any reference to the optimizer, any reference to the loss function, any filesystem access.

### `train.py`

Runs the training loop: forward pass, backward pass, optimizer step, logging, checkpointing.

Forbidden: architecture definition, data loading, metric-name decisions. Metric names come from the manifest, never from string literals in this file.

### `eval.py`

Computes metrics on a given split and writes them to the manifest-declared output path using the exact locked metric names.

Forbidden: modifying data, training, logging to any path other than the manifest path, renaming metrics, adding metrics that are not in the manifest.

### `config.py`

Typed configuration object as a dataclass or pydantic model. Holds every hyperparameter, every path, and every flag the run depends on. Every other module receives this object as an argument.

Forbidden: any logic beyond validation of field types. No conditional branching, no path construction, no derived values computed at import time.

### `preflight.py`

Asserts the integrity contract in the order specified by `references/integrity-verification.md` and runs a one-batch dry pass.

Forbidden: training, writing to any path except its assertion log, running more than one batch, silencing assertion failures, catching exceptions from the integrity checks.

### `run.sh`

The single entry point Runtime will execute. Calls `preflight.py` first, then training, then evaluation, in that order.

Forbidden: retry loops, silencing non-zero exits with `|| true` or equivalent, background processes, parallel dispatch, environment mutation beyond what the spec declares.

### `metrics_manifest.json`

Declares the exact metric names, the output file path, and the mechanical extraction command using grep or jq.

Forbidden: listing metric names not declared in the hypothesis's locked metric block, declaring output paths outside the experiment worktree, declaring extraction commands that require interpretation.

### `constraints.lock`

Byte copy of the hypothesis integrity block with its SHA-256.

Forbidden: any edit of any kind. A single byte change invalidates the lock.

### `BUILD_REPORT.md`

Describes what was built module by module and lists zero deviations on PASS.

Forbidden: claiming features not implemented, referencing rationale not present in the spec, marking PASS when any deviation exists, omitting any required module.

## Craftsmanship Rules

- Every public function carries type hints on every parameter and on the return value.
- No try/except that swallows errors. Exceptions propagate to the top of the run.
- No `.get()` with a default value on required configuration keys. A missing key is a hard failure.
- No `return None` or `return {}` as a sentinel for failure. Return the real type or raise.
- No magic numbers outside `config.py`. Every numeric literal lives in the typed config.
- One responsibility per module. A reviewer must be able to hold each file in context at once.
- No feature flags, no graceful-degradation shims, no "temporary" branches.
- No placeholder comments. No `# TODO`, no `# FIXME`, no `pass` as a sole function body.
- No generic exception messages. An assertion failure names the specific constraint that was violated.

## Antipatterns

- Swallowing errors behind bare `except:`, `except Exception`, or `.get("key", default)` on required config.
- Magic numbers scattered across modules instead of centralized in `config.py`.
- Data loading logic inside `train.py` or `model.py`.
- Architecture construction inside `train.py`.
- Metric names hard-coded in `eval.py` instead of read from `metrics_manifest.json`.
- Graceful degradation on missing files, missing columns, or failed decodes.
- Silent shape or dtype coercion when input does not match the declared contract.
- A single module owning more than one of: data, model, training, evaluation, config.
- `preflight.py` that runs the full training loop instead of asserting and dry-passing one batch.
- `run.sh` that retries a failed preflight or masks a non-zero exit.

## Gate Functions

- BEFORE writing `data.py`: "Does it load only the locked split files by exact path and enforce the feature whitelist?"
- BEFORE writing `model.py`: "Does it touch training or data at all? If yes, move those out."
- BEFORE writing `train.py`: "Does it define architecture or load data? If yes, move those out."
- BEFORE writing `eval.py`: "Does it emit only the locked metric names to the manifest-declared path?"
- BEFORE writing `config.py`: "Are all hyperparameters here, or are magic numbers still scattered across other modules?"
- BEFORE writing `preflight.py`: "Does it assert the integrity contract in the order from `references/integrity-verification.md`?"
- BEFORE marking `BUILD_REPORT.md` PASS: "Are there any deviations from the spec? If yes, this is not a PASS."

## Rationalization Table

| Rationalization | Response |
|---|---|
| "A small try/except here keeps the run going" | Graceful degradation hides bugs. Let it fail. |
| "`.get("key", 0)` is a safe default" | A missing required key is a hard failure. Raise. |
| "It's cleaner to load data inside the training loop" | Cleaner for writing, worse for auditing. Keep `data.py` separate. |
| "A couple of magic numbers won't hurt" | They hurt the next reviewer. All constants in `config.py`. |
| "The metric name in `eval.py` is obvious" | Then read it from the manifest. The manifest is the contract. |
| "The builder knows the architecture is fine as-is" | The spec is the architecture. The builder implements. |

## Red Flags

- Bare `except:` with no specific exception class.
- `.get(` with a positional default on a required config key.
- `return None` used as a failure sentinel.
- `# TODO`, `# FIXME`, or `pass` as a statement body.
- Magic numbers anywhere outside `config.py`.
- A module that imports from more than one of the data, model, train, and eval concerns.
- `preflight.py` that invokes the full training run.
- `run.sh` with retry logic or `|| true`.

## Reviewer Enforcement

Build reviewer subagents verify every builder output against this reference. The reviewer is a fresh subagent with no inheritance from the builder's context. BUILD_REPORT claims are not trusted until the reviewer confirms them against the actual files.

Reviewer input: experiment spec inline, worktree path, locked integrity constraints block inline.

Reviewer checks (any FAIL blocks Runtime for that experiment):

- Required module layout is complete (ten files present)
- Single-responsibility boundaries are honored; no cross-module leakage
- `data.py` loads only the locked split files and enforces the feature whitelist
- `preflight.py` asserts trainable parameter count, split-file hashes, determinism flags, and the locked metric name
- `model.py` returns a model whose measured trainable-parameter count falls within the declared bound. The reviewer records the measured count and verifies it matches the `trainable_params` field declared in `BUILD_REPORT.md`
- `metrics_manifest.json` declares the locked metric name exactly
- `constraints.lock` is byte-identical to the hypothesis integrity block
- No bare `except`, no `.get()` defaults on required config, no magic numbers outside `config.py`
- Config diff from parent matches the spec exactly
- `BUILD_REPORT.md` claims nothing that is not implemented

Reviewer status returns: DONE / BLOCKED. No soft pass.

## Bottom Line

Write and execute a verification script that walks the experiment worktree, greps every Python file for forbidden patterns (bare `except:` with no specific class, `.get(` with a positional default, `return None`, `return {}`, `return []`, `# TODO`, `# FIXME`, `pass` as a sole body, numeric literals in any module other than `config.py`), asserts every required file in the module layout exists, asserts `constraints.lock` is present and byte-identical to the reference copy of the hypothesis integrity block, and asserts `BUILD_REPORT.md` lists zero deviations. Print BUILD CRAFTSMANSHIP: PASS or BUILD CRAFTSMANSHIP: FAIL with the specific failing file and pattern.
