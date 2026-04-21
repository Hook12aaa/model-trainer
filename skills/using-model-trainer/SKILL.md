---
name: using-model-trainer
description: Use when starting any ML training conversation - establishes how to find and use model-trainer skills for data checking, hypothesis forming, experiment design, training, review, and reporting
---

# Using Model Trainer

You have ML model training skills available. These skills guide you through the complete experiment lifecycle with rigorous methodology.

## Available Skills

| Skill | Trigger | What it does |
|---|---|---|
| data-check | User mentions data, datasets, CSV, features | Validates data exists and meets quality standards |
| hypothesize | User wants to train a model, explore approaches | Agrees on architecture, metrics, success criteria |
| design-experiments | After hypothesis approved | Drafts a locked experiment plan, records the hypothesis integrity hash inside the plan's integrity block, dispatches three parallel research agents (environment, data-context, pitfall), runs executable self-review, dispatches the review-plan reviewer subagent, gates on human approval |
| train | After experiment plan approved | Executes experiments with git tracking and reviewer dispatch |
| review-metrics | Dispatched by report skill after batch completes | 4-layer metric validation, Execute-Don't-Eyeball |
| review-strategy | Dispatched by report skill after review-metrics ACCEPT | Complexity scoring, Pareto front, coherence |
| report | After batch complete | Dispatches reviewer subagents, computes batch analysis, spins up local dashboard server, presents terminal recommendation, executes winner merges |

## The Rule

**Invoke relevant skills BEFORE any response or action.** If a user mentions data, training, models, or experiments — check if a skill applies.

## Workflow Order

```
/data-check → /hypothesize → /design-experiments → /train → /report
```

Each stage must complete before the next begins. The human approves at hypothesis, experiment plan, and batch report gates.

## Core Principles (apply to ALL skills)

1. **Execute, Don't Eyeball** — Never compare metric values in natural language. Write a script, execute it, read the output.
2. **Bad work is worse than no work** — It is always OK to stop and escalate. Never silently produce uncertain work.
3. **Lean context** — Each skill carries what it needs. Don't chase files.
4. **Structural distrust** — No agent both produces and approves its own work.

## Voice (apply to ALL user-facing output)

Write so a person learning ML can follow every answer without looking up a term. Clarity over cleverness. One decision at a time. Plain language. Define every term the first time it appears. Speak directly to the user; never refer to "the skill", "skill mandates", "skill deviation", or any third-person self-reference — describe the action or the need plainly.

## Status Vocabulary

All skills use these base statuses:

- **DONE** — stage complete, proceed
- **DONE_WITH_CONCERNS** — complete but flagged issues for human review
- **BLOCKED** — cannot proceed, needs human input
- **NEEDS_CONTEXT** — missing information, ask before continuing

The train skill and report skill additionally use these experiment-scoped and batch-scoped codes:

- **BLOCKED_BUILD** — builder or build-reviewer subagent failed persistently; experiment excluded from runtime
- **BLOCKED_PREFLIGHT** — preflight.py returned non-zero; experiment cannot execute
- **BLOCKED_TAMPER** — constraint hash drift detected; halts the entire batch
- **CRASHED** — run.sh returned non-zero
- **CRASHED_TIMEOUT** — wall-clock timeout kill
- **CRASHED_OOM** — out-of-memory detected in the run log
- **CRASHED_NO_METRICS** — run completed but the metric extraction command found nothing

The design-experiments skill additionally uses these plan-scoped codes:

- **BLOCKED_MISSING_INPUT** — data-check report or approved hypothesis is missing or unverifiable at pre-entry gates
- **BLOCKED_REVIEWER** — the review-plan reviewer subagent returned FAIL three consecutive times without progress
- **BLOCKED_HUMAN_REJECTED** — the human declined approval at the final gate

Review subagents use their own verdict vocabulary: review-metrics returns ACCEPT, REJECT, or INCONCLUSIVE; review-strategy returns KEEP, DISCARD, or KEEP_WITH_CONCERNS.
