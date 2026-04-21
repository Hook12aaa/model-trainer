# Integrity Verification Reference

## Core Principle

The locked constraints are immutable. Verification is mechanical, not interpretive. Every check runs as an executed command, not as a judgement.

## Hash File Conventions

- Every locked file carries a SHA-256 sidecar at the same path plus `.sha256` containing a single line: the hex digest followed by two spaces and the filename.
- Verification uses `sha256sum -c` on Linux and `shasum -a 256 -c` on macOS. Both read the same sidecar format.
- Sidecars are committed to git alongside the file they protect.
- A missing sidecar on a locked file is a hard failure.

## Locked Split Files

- Splits are pinned as three Parquet files: `splits/train.parquet`, `splits/val.parquet`, `splits/test.parquet`.
- Each file contains only the row identifier column plus any required stratification key.
- Sort order: ascending by the primary identifier.
- Compression codec: handled transparently by the parquet reader. Not declared in the hypothesis and not verified by preflight.
- Each file has a sibling `.sha256` sidecar.
- Split files are loaded by exact path. Regenerating them, reindexing them, or loading through a HuggingFace cache fingerprint is forbidden.
- Set-disjointness between train, val, and test must be asserted at load time, not assumed.

## Trainable Parameter Assertion

- Sum `numel()` over every parameter with `requires_grad=True` after the model is fully constructed, fully wrapped (LoRA, adapters, FSDP, compile), and after any freezing.
- The assertion runs before the first forward pass.
- Buffers (BatchNorm running statistics), optimizer state, and parameters with `requires_grad=False` are excluded.
- The asserted value is the exact integer bound from the hypothesis. Less-than-or-equal is the only accepted comparison.
- A mismatch is a hard failure and BLOCKED_PREFLIGHT.

## Determinism Minimum Set

All of the following must be in place before the first tensor is created:

- Environment: `CUBLAS_WORKSPACE_CONFIG=:4096:8` and `PYTHONHASHSEED` set before importing torch.
- Seeds: `torch.manual_seed`, `torch.cuda.manual_seed_all`, `numpy.random.seed`, `random.seed` all called with the same integer.
- Backends: `torch.backends.cudnn.deterministic = True`, `torch.backends.cudnn.benchmark = False`.
- Deterministic algorithms: `torch.use_deterministic_algorithms(True)`.
- DataLoader: pass an explicit `generator` with a fixed seed and a `worker_init_fn` that reseeds `numpy.random` and `random` from the worker's seed.
- Any transform that calls a random function reads from the seeded generator, not from entropy.

Missing any one of these is a hard failure.

## Pre-Flight Order

The preflight gate runs these checks in this exact order. The first failure stops the gate and returns BLOCKED_PREFLIGHT.

1. All locked files present and sidecar hashes verify.
2. Train/val/test set-disjointness from the locked split files.
3. Determinism minimum set in place.
4. Data loader produces one batch.
5. Model constructed, fully wrapped, trainable parameter count asserted.
6. One forward pass with loss finite (not NaN, not Inf).
7. One backward pass with gradients populated on every `requires_grad=True` parameter.
8. One optimizer step completes.
9. One validation batch emits the locked metric key into the manifest-declared output path.

## Metric Name Pinning

- The locked metric names come from the hypothesis. `metrics_manifest.json` in the worktree is a copy of that block.
- `eval.py` reads the metric names from the manifest at load time. The manifest is the only place a metric name appears as a string.
- At the first log call, assert that the emitted key matches the manifest exactly. Any key-name drift is a hard failure — `val_mse` and `validation_mse` are not synonyms.
- No synonym rewriting, no alias dictionaries.

## Post-Run Tamper Manifest

- Before `run.sh` begins, a SHA-256 manifest of `data.py`, `model.py`, `train.py`, `eval.py`, `config.py`, `constraints.lock`, and `metrics_manifest.json` is written to a stash path outside the worktree.
- After `run.sh` returns, the same manifest is recomputed.
- Any difference between the stashed and recomputed manifests is BLOCKED_TAMPER and halts the batch.
- The stash path is not writable from inside the worktree.

## Gate Functions

- BEFORE any training run: "Do every locked file and its sidecar exist and verify?"
- BEFORE asserting parameter count: "Is the model fully wrapped and frozen first?"
- BEFORE any forward pass: "Is the determinism minimum set in place, including the DataLoader `generator` and `worker_init_fn`?"
- BEFORE reading a metric name: "Am I reading it from the manifest, or am I hard-coding a string?"
- BEFORE `run.sh` starts: "Did I write the tamper stash manifest to a path outside the worktree?"
- BEFORE marking a run DONE: "Did the post-run tamper manifest diff clean?"

## Rationalization Table

| Rationalization | Response |
|---|---|
| "Determinism flags are slow" | Non-deterministic runs are not reproducible. They are not optional. |
| "Regenerating the split from a fingerprint is equivalent" | It is not. The locked split is a file with a hash. |
| "The parameter count is only slightly over the bound" | "Slightly" is not a comparison. `≤` is. |
| "The metric name drift is cosmetic" | It breaks the manifest contract. Hard failure. |
| "Skipping the tamper manifest saves time" | It removes the only mechanism that detects an edited training script. |
| "The OOM only happens on large seeds" | Seeds do not cause OOM. A silent parameter growth does. |

## Red Flags

- Any locked file without a `.sha256` sidecar
- Regenerated splits, HuggingFace fingerprint lookups, pickled index arrays
- Parameter count checked before wrapping or freezing
- Missing `CUBLAS_WORKSPACE_CONFIG` or `worker_init_fn`
- Metric names as hard-coded strings outside the manifest
- Tamper stash written inside the worktree
- "≈" or "close enough" applied to any hash comparison

## Runtime Subagent Contract

Runtime subagents execute a build-passed worktree. They verify integrity, run preflight and training, extract metrics, and return a typed payload. They never edit files, never retry, never interpret metrics.

Runtime input: worktree absolute path, wall-clock timeout, expected `constraints.lock` SHA-256.

Runtime steps in order:

1. Verify the `constraints.lock` SHA-256. Mismatch → BLOCKED_TAMPER.
2. Execute `preflight.py`. Non-zero exit → BLOCKED_PREFLIGHT with the preflight output.
3. Execute `run.sh` under a shell-level timeout. Capture stdout and stderr to the log path.
4. Timeout kill → CRASHED_TIMEOUT. Non-zero exit → CRASHED. OOM line detected in the log → CRASHED_OOM.
5. Execute the metric extraction command from `metrics_manifest.json`. Missing metrics → CRASHED_NO_METRICS.
6. Return a payload with worktree path, status, metrics blob (if any), wall-clock, log path, and the last N log lines on failure.

Forbidden actions: editing any file in the worktree; retrying a failed run; interpreting metrics; silencing errors; running without the declared timeout.

Status returns: DONE / BLOCKED_TAMPER / BLOCKED_PREFLIGHT / CRASHED / CRASHED_TIMEOUT / CRASHED_OOM / CRASHED_NO_METRICS.

## Four Train-Level Enforcement Points

Train invokes this reference at four mechanical gates. Every batch, every experiment, all four run.

1. **At train's gate check** — hash the hypothesis integrity block and compare to the hash recorded in the plan; hash the plan integrity block and compare to `<plan>.sha256`. Either mismatch blocks the entire run.
2. **At builder output** — verify the returned worktree contains `constraints.lock` byte-identical to the hypothesis integrity block. Mismatch excludes the experiment from Runtime.
3. **Inside preflight** — the pre-flight gate in this reference runs in full. First non-PASS step is BLOCKED_PREFLIGHT.
4. **After runtime** — the post-run tamper manifest (see below) is recomputed and diffed. Any drift is BLOCKED_TAMPER and halts the entire batch.

## Bottom Line

Write and execute a script that, for every locked file, re-computes the SHA-256 and compares it to the sidecar; asserts each preflight step in order; dumps the final determinism state and asserts every minimum-set entry is active; reads the metric names from the manifest and asserts they are the only metric names that appear as string literals elsewhere in the worktree; and re-computes the post-run tamper manifest. Print INTEGRITY VERIFICATION: PASS or INTEGRITY VERIFICATION: FAIL with the specific failing check.
