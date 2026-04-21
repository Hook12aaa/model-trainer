---
name: design-experiments
description: Use after /hypothesize is approved and /data-check has PASSed. Drafts a locked experiment plan with integrity-block propagation of the hypothesis hash, dispatches three parallel research agents (environment, data-context, pitfall), runs executable self-review, dispatches the review-plan reviewer subagent, and gates on human approval recorded inside the plan's integrity block.
---

## Core Principle

Design-experiments writes one artifact: a plan with its own integrity block that records the hypothesis integrity hash. Train verifies both hashes before dispatching builders. The plan is tamper-evident or the pipeline stops. No fallback defaults. No partial artifacts.

## When to Use

After `/hypothesize` has produced an approved hypothesis document with a sidecar hash and `/data-check` has written a PASS report. Before `/train`.

Do NOT use for: drafting the hypothesis itself, running experiments, interpreting results. Those are separate skills.

## Pre-Entry Gates

All gates must pass before the skill begins work. A failure at any gate stops the skill with a STOP message naming the failed check.

Gate 1: data-quality report exists.

    test -f docs/model-trainer/data-quality-report.json && \
      test "$(jq -r '.overall_status' docs/model-trainer/data-quality-report.json)" = "PASS"

Gate 2: approved hypothesis file exists and sidecar recomputes.

    test "$(ls docs/model-trainer/hypotheses/*.md 2>/dev/null | wc -l)" = "1" && \
      test "$(ls docs/model-trainer/hypotheses/*.md.sha256 2>/dev/null | wc -l)" = "1"

Exactly one `.md` and exactly one matching `.sha256` must be present. Zero or more than one of either fails the gate. Recompute the hypothesis integrity-block SHA-256 and compare to the sidecar. Mismatch means the hypothesis was edited after approval. STOP.

Hypothesis resolution: the skill operates on the single approved hypothesis at `docs/model-trainer/hypotheses/YYYY-MM-DD-<name>.md` with an accompanying `.sha256` sidecar. If multiple candidates exist, the skill STOPs with a message listing the ambiguous paths and requires the human to archive non-target files before re-invocation.

## Skill Flow

The skill executes eleven steps. Each step becomes a TodoWrite task. Steps run in order. No skipping.

1. Verify data-quality report exists.
2. Verify approved hypothesis file and sidecar exist; recompute sidecar.
3. Dispatch three research agents in parallel.
4. Collect agent outputs into plan's Inherited Context and Researched Assumptions sections.
5. Draft plan body: batch declaration, module-layout reference, per-experiment entries (baseline first as `exp_000`).
6. Write plan integrity block with hypothesis path, hypothesis integrity hash, baseline ID, batch count, human-approval-date placeholder, plan schema version.
7. Run inline executable self-review scan.
8. Dispatch `review-plan` reviewer subagent.
9. Loop on reviewer verdict until PASS or escalation.
10. Present plan to human for approval.
11. On approval: record approval date inside integrity block, emit sidecar, commit.

### Flow Graph

    digraph design_experiments {
      entry_gates [shape=diamond label="Pre-entry gates PASS?"];
      research [label="Dispatch 3 research agents (parallel)"];
      draft [label="Draft plan body"];
      integrity [label="Write plan integrity block"];
      self_review [shape=diamond label="Executable self-review PASS?"];
      reviewer [label="Dispatch review-plan subagent"];
      verdict [shape=diamond label="Reviewer verdict?"];
      human [shape=diamond label="Human approves?"];
      commit [label="Record approval, emit sidecar, commit"];
      stop [shape=box style=filled label="STOP with reason"];

      entry_gates -> research [label="yes"];
      entry_gates -> stop [label="no"];
      research -> draft;
      draft -> integrity;
      integrity -> self_review;
      self_review -> reviewer [label="PASS"];
      self_review -> stop [label="FAIL"];
      reviewer -> verdict;
      verdict -> draft [label="FAIL — apply fixes"];
      verdict -> human [label="PASS"];
      human -> commit [label="yes"];
      human -> stop [label="no"];
    }

## Research-Agent Dispatch

Step 3 dispatches three agents in a single message with three `Agent` tool calls. Full prompt contracts and output schemas live in `references/research-agent-dispatch.md`.

Collect all three results before proceeding to step 4. A malformed output from any agent triggers a redispatch of that single agent. Do not proceed to drafting with partial or malformed outputs.

## Plan Document Structure

One markdown file at `docs/model-trainer/plans/YYYY-MM-DD-<name>.md` with sections in this order.

### Header (outside integrity block)

- Feature name (`# <Experiment Series Name>`)
- One-sentence goal
- Required sub-skill pointer: `/train` executed with `superpowers:subagent-driven-development`
- Schema version note pointing to the design spec

### Integrity Block

Delimited by literal HTML comment markers on their own lines. Six fields in fixed order:

    <!-- integrity-block:start -->
    Hypothesis Path: <path>
    Hypothesis Integrity Hash: <sha256>
    Baseline Experiment ID: exp_000
    Batch Count: <int>
    Human Approval Date: <ISO-8601 or PENDING>
    Plan Schema Version: 1
    <!-- integrity-block:end -->

Field order is fixed. Any change invalidates the plan sidecar.

The plan sidecar at `<plan>.sha256` is computed in step 11 AFTER the Human Approval Date field is finalized. Hash range: the byte range strictly between `<!-- integrity-block:start -->` and `<!-- integrity-block:end -->`, exclusive of both marker lines. This matches the hypothesis sidecar convention.

### Inherited Context

Verbatim JSON blobs from the environment and data-context agents. No paraphrasing.

### Researched Assumptions

Pitfall agent's risk table as markdown with columns `Risk`, `Evidence`, `Mitigation`, `Plan Impact`.

### Batch Module Layout

One-time declaration naming `references/module-layout.md` as authoritative. No per-experiment repetition of the 10-file list.

### Experiments

Ordered list. Baseline first. Each entry has nine fixed fields:

- `id` — `exp_000`, `exp_001`, … (contiguous, ascending). `exp_000` is the baseline and carries the full baseline `config.py` contents inline under a `baseline_config` key. Non-baseline entries omit `baseline_config` and rely on the plan-wide inherited value.
- `parent` — `null` for baseline, else parent experiment ID
- `hypothesis` — one-sentence statement
- `rung` — non-negative integer. Baseline rung is 0. Non-baseline rungs are monotonically non-decreasing along parent chains.
- `math` — formal statement (equations, not prose)
- `config_diff` — exactly one key-to-value change from the parent experiment's declared `config_diff` chain resolved against the plan's `exp_000` baseline config block. The plan carries the full baseline config inline under `exp_000`; non-baseline experiments carry only the single-key delta. Multi-key diffs forbidden.
- `success_criterion` — inequality against locked metric name matching regex `^[<>=]=?\s*-?\d+(\.\d+)?` after the metric name
- `failure_criterion` — inequality against locked metric name matching the same regex
- `abort_condition` — runtime trigger (NaN, OOM, preflight fail)

### Results Placeholder

Empty table that `/train` fills post-runtime. Columns: `status`, `metrics`, `wall_clock_seconds`, `worktree_path`, `log_path`, `constraint_hash_verification`, `build_reviewer_verdict`, `build_report_summary`.

## Executable Self-Review

Step 7 runs bash checks against the draft plan. All must exit 0. No LLM judgment.

- `grep -c "<!-- integrity-block:start -->" <plan>` returns 1.
- `grep -c "<!-- integrity-block:end -->" <plan>` returns 1.
- `grep -iE "\b(TBD|TODO|FIXME|e\.g\.|appropriate|should consider|maybe|probably)\b" <plan>` returns zero matches.
- Recompute SHA-256 over the hypothesis integrity block. Compare to the hash echoed in the plan integrity block. Must match.
- Recompute SHA-256 over the hypothesis integrity block. Compare to the hypothesis sidecar. Must match.
- Every experiment entry has all nine required fields (one grep per field, count equals batch count).
- First experiment entry in document order has `id: exp_000` and `parent: null`. No other entry has `parent: null`.
- Experiment entries appear in ascending ID order.
- Environment agent, data-context agent, and pitfall agent output sections exist and are non-empty.

Any non-zero exit stops the skill with a STOP message naming the failed check and the imperative fix. No degraded retry.

## Reviewer Subagent

Step 8 dispatches the `review-plan` reviewer via the `Agent` tool. Full prompt lives at `references/review-plan-prompt.md`.

Inputs passed: plan path, hypothesis path, hypothesis sidecar path, module-layout reference path.

Model: most capable available.

Verdict vocabulary: binary. `PASS` or `FAIL`. No `DONE_WITH_CONCERNS`.

Loop rule: on `FAIL`, apply every fix from the reviewer's `failures` list, then redispatch a fresh reviewer subagent (new context, no memory of prior run). Loops until `PASS` or escalation.

Escalation: three consecutive `FAIL` verdicts without progress triggers status `BLOCKED_REVIEWER` and escalates to the human.

No self-approval. The reviewer is a separate subagent invocation every time.

## Status Vocabulary

Exactly one terminal status:

- `DONE` — plan committed, sidecar emitted, human approval date recorded inside integrity block, reviewer returned `PASS`, all executable gates passed.
- `BLOCKED_MISSING_INPUT` — data-check report or approved hypothesis missing or unverifiable at pre-entry gates.
- `BLOCKED_REVIEWER` — reviewer returned `FAIL` three consecutive times without progress.
- `BLOCKED_HUMAN_REJECTED` — human declined approval at step 10.

On `DONE`, output plan path and sidecar path. Name `/train` as the next skill. Stop. No auto-invocation.

On any `BLOCKED_*`, write no partial artifacts. Either all gates pass or no plan is committed.

## Gate Functions

BEFORE step 3: Did pre-entry gates pass? If no, STOP.
BEFORE step 7: Does the plan integrity block contain six fields in the fixed order? If no, STOP.
BEFORE step 8: Did the executable self-review exit 0 on every check? If no, STOP.
BEFORE step 10: Did the reviewer return `PASS`? If no, loop or escalate.
BEFORE step 11: Did the human type an explicit approval? Silence is not approval. If no, STOP.

## Rationalization Table

| You think... | Reality |
|---|---|
| "The hypothesis sidecar was correct last time, skip recompute" | Skipping the recompute is the one action that breaks the tamper-evidence contract. Recompute. |
| "The pitfall agent's table is obvious, I can summarize it" | Pitfall output is verbatim or missing. No paraphrasing. |
| "The reviewer's FAIL is pedantic, approve anyway" | Self-approval is the gap the reviewer exists to close. Apply the fix. |
| "The human said 'looks good' last week, that's approval" | Approval is an ISO-8601 timestamp inside the integrity block for this plan. No back-dating. No transitivity. |
| "Baseline can be exp_001 if I name exp_000 something else" | Baseline is `exp_000`. No renaming. |
| "Compound config diff is fine, reviewers can untangle it" | Each non-baseline experiment's `config_diff` contains exactly one key. Split the change into two experiments. |
| "Missing preflight.py is fine, train.py can do the checks" | All ten module files are required. No consolidation. |

## Red Flags

STOP if you catch any of these:

- Writing a forbidden token into the plan (any token in the self-review regex).
- Proceeding to the reviewer with executable self-review not exit-0.
- Rewriting the reviewer's failure reasons into "close enough".
- Recording a human-approval date before the human approves.
- Emitting the sidecar before the integrity block is finalized.
- Dispatching fewer than three research agents.
- Inferring a field value the data-context agent did not produce.

## Bottom Line

Design-experiments commits one plan or commits nothing. Hypothesis hash in, plan hash out, human approval inside the block. Train verifies both hashes before builders run. Tamper-evident or pipeline stops.
