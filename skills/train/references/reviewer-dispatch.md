# Reviewer Dispatch Reference

## Core Principle

Parallel dispatch is one assistant message carrying N Task calls. Subagents receive full context inline. The controller never approves its own work.

## Single-Message Dispatch

- All Task calls for a parallel wave go in a single assistant message. Sequential messages serialize and lose the parallelism the worktrees were created for.
- The controller emits the full list of Task calls in one response, then waits. It does not dispatch, inspect, and re-dispatch one at a time inside a wave.
- A wave is complete only when every Task call in the message has returned. Acting on partial results is forbidden.

## Worktree Isolation

- Every builder Task call includes `isolation: "worktree"`. This gives the subagent its own git worktree so parallel builders cannot conflict on files.
- Runtime Task calls operate on pre-built worktrees and do not need new isolation — they are pointed at an existing worktree by absolute path.
- Worktrees are never reused across experiments.

## Inline Context Discipline

- The experiment spec, the locked integrity constraints, the parent worktree path, and the assigned worktree path are passed inline in the Task prompt.
- The controller never instructs a subagent to "read the plan file" or "look at the hypothesis." File reading pollutes the subagent's context and is forbidden.
- Scene-setting context that a subagent needs to place its work in the project is included inline, not referenced.

## Cross-Subagent Aggregation

- After every wave, collect all status values from the returned subagents.
- Route by status: DONE joins the runnable manifest; DONE_WITH_CONCERNS joins with the concerns logged; NEEDS_CONTEXT is re-dispatched with the missing context; BLOCKED is diagnosed per the handling protocol.
- A failed subagent slot is re-dispatched alone — do not re-dispatch healthy slots.
- Aggregation is mechanical: tally by status, act on each bucket, never average verdicts.

## Retry Caps

- Builders: maximum two rebuild attempts. Each rebuild is a fresh dispatch of the same subagent with the specific failures from the build reviewer listed inline. A third failure marks BLOCKED_BUILD and excludes the experiment from Runtime.
- Runtime subagents: zero retries. A crash is a crash, logged and moved on. A BLOCKED_TAMPER halts the batch.
- Retries do not reuse a subagent that returned — every retry is a new dispatch with updated context.

## Compute-Derived Wave Concurrency

- The concurrency limit is computed at the start of the batch from hardware discovery and is frozen for the whole batch.
- Waves are sized to the concurrency limit; the final wave carries the remainder.
- Adaptive dispatch — raising the limit because VRAM usage is lower than expected — is forbidden. Adjust in a later batch or in a later plan, not mid-batch.

## Four-Status Vocabulary and Handling

The base vocabulary is DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED. Handling per status:

- DONE — proceed to the next stage (builder to build reviewer, runtime to aggregation).
- DONE_WITH_CONCERNS — read the concerns before proceeding. Correctness or scope concerns are addressed before the next stage; observations are logged.
- NEEDS_CONTEXT — provide the missing context inline and re-dispatch the same subagent.
- BLOCKED — diagnose: missing context (add and re-dispatch), task too large (split), task requires more reasoning (re-dispatch with a more capable model), or plan is wrong (escalate to human). Never retry identically.

Train extends this vocabulary for Runtime-specific failures (BLOCKED_BUILD, BLOCKED_PREFLIGHT, BLOCKED_TAMPER, CRASHED, CRASHED_TIMEOUT, CRASHED_OOM, CRASHED_NO_METRICS) — the extended set is declared in SKILL.md and is consumed by the controller and /report, not the subagents themselves.

## Structural Distrust

- No agent both produces and approves its own work. Builder self-assessment is not a review.
- Build reviewers are fresh subagents with no inheritance from the builder's context.
- Runtime subagents do not interpret metrics — they extract mechanically and return facts. Interpretation is /report's job.
- The controller does not read metrics during aggregation. It records them.

## Tamper Flag Surfacing

- Any BLOCKED_TAMPER from a runtime subagent halts the entire batch immediately.
- The halt surfaces to the human with the specific file whose hash changed, the expected hash, and the observed hash.
- A halted batch does not advance to Handoff. The controller returns BLOCKED with the tamper evidence attached.

## Gate Functions

- BEFORE sending a dispatch message: "Am I emitting all Task calls in this single message, or am I about to split them across messages?"
- BEFORE each Task call: "Did I pass the full experiment spec and locked constraints inline, or am I telling the subagent to read a file?"
- BEFORE each builder Task call: "Did I include `isolation: "worktree"`?"
- BEFORE aggregating: "Has every Task in the wave returned, or am I acting on partial results?"
- BEFORE a retry: "Am I changing something (context, model, scope), or am I retrying identically?"
- BEFORE raising the concurrency limit: "Was this limit computed from hardware at batch start? If yes, it is frozen."
- BEFORE the controller reads a metric value: "Is this interpretation, or is this recording?"

## Rationalization Table

| Rationalization | Response |
|---|---|
| "One builder at a time is easier to debug" | Worktrees exist so builders run in parallel. Dispatch in one message. |
| "The subagent can read the plan file, it's just one file" | File reading pollutes context and drifts scope. Inline context. |
| "Some builders returned, I can start reviewing those" | Partial results are forbidden. Wait for the full wave. |
| "Concurrency can go up because the GPU has headroom" | The limit is frozen. Adjust in the next batch, not this one. |
| "The crash was flaky, one retry won't hurt" | Runtime has zero retries. Log it. |
| "I'll just verify the metrics myself, it's faster" | Verification is /report's job. The controller records. |

## Red Flags

- Sequential dispatch in a loop instead of one message with N Task calls
- "Read the plan file" in any subagent prompt
- Acting on a partial wave result
- Adaptive concurrency adjustment
- Retrying a runtime crash
- Controller reading metric values and deciding
- `isolation: "worktree"` missing on a builder Task call
- Re-dispatching a healthy slot along with the failed one

## Bottom Line

Write and execute a script that inspects the controller's dispatch log for the current batch and asserts: every build wave was emitted as a single assistant message with one Task call per experiment; every builder Task carried `isolation: "worktree"`; no subagent prompt contains the phrase "read the plan"; every wave was fully returned before the next began; the concurrency limit at the end of the batch equals the value frozen at the start; no runtime subagent was re-dispatched; no controller action between aggregate and /report invocation touched a metric value. Print REVIEWER DISPATCH: PASS or REVIEWER DISPATCH: FAIL with the specific failing check.
