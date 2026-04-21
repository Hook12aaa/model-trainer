---
name: review-strategy
description: Use as a subagent dispatched by the report skill ONLY after review-metrics reports ACCEPT. Judges whether an improvement justifies its complexity using quantitative scoring (parameter ratio, efficiency), Pareto front analysis, architecture vs hyperparameter balance check, and research coherence. Receives experiment history inline from /report (assembled from prior batches in the same plan).
---

## When to Use
After /report dispatches review-metrics for the experiment and receives ACCEPT. Never before. /report is responsible for the dispatch order — this skill assumes the metric review has already completed and passed.

Do NOT use for: verifying metric accuracy. That is review-metrics' job and is already complete.

## Core Principle
**Execute, Don't Eyeball. Complexity must be quantified by executing code, not estimated by reading diffs. A small improvement that adds ugly complexity is not worth it. A simplification that maintains performance is always worth it.**

## The Execute-Don't-Eyeball Rule

You are an LLM. You cannot reliably count parameters, estimate model complexity, or judge efficiency ratios by reading code. Write a Python script for every complexity comparison.

BEFORE making any judgment about complexity or worth:
  Write a script. Execute it. Read the output.
  Do not say "this seems more complex" or "the model looks bigger."
  Compute the numbers.

For the full methodology, read: `references/execute-dont-eyeball.md`

## Three Scripted Checks

Execute each as a separate Python script.

### Check 1: Complexity Score

Write and execute a script that:
- Reads `trainable_params` for the baseline experiment and the new experiment from the inline dispatch payload. Every experiment's build reviewer already asserted this count against the declared architecture bound, and train recorded it in the plan's `## Results` section under `trainable_params`. This skill never counts parameters from config shapes — arbitrary architectures (MLP, CNN, transformer, recurrent, time-series hybrids) cannot be sized from a JSON config without building the model, and that work already happened during build review.
- If either `trainable_params` value is missing or non-integer, return `{"verdict": null, "missing_inputs": ["baseline_trainable_params" | "new_trainable_params"]}` and report KEEP_WITH_CONCERNS with reason `"dispatch payload missing trainable_params; /report must resolve from plan Results before re-dispatch"`. Never substitute a config-derived estimate.
- Computes param_ratio: `new_params / baseline_params`
- Computes efficiency: `relative_metric_improvement / max(param_ratio - 1.0, 0.001)`
- Reads the four complexity thresholds from the inline dispatch payload: `param_ratio_worth_it_max`, `param_ratio_not_worth_it_min`, `efficiency_worth_it_min`, `efficiency_not_worth_it_max`. /report resolves them from the plan's optional `review_config.complexity_thresholds` block, falling back to the calibration reference at `references/complexity-calibration.md` when the plan is silent. Either source must produce all four values before this skill runs; this skill itself declares no thresholds.
- If the dispatch payload omits any of the four values, return `{"verdict": null, "missing_thresholds": [<names>]}` and report KEEP_WITH_CONCERNS with reason `"dispatch payload missing complexity_thresholds; /report must resolve them from plan or calibration reference before re-dispatch"`.
- Determines verdict: `param_ratio < param_ratio_worth_it_max AND efficiency > efficiency_worth_it_min` → "worth it"; `param_ratio > param_ratio_not_worth_it_min AND efficiency < efficiency_not_worth_it_max` → "not worth it"; else → "diminishing returns"

Output format: `{"baseline_params": int, "new_params": int, "param_ratio": float, "efficiency": float, "verdict": "worth it" | "diminishing returns" | "not worth it"}`

### Check 2: Architecture vs Hyperparameter Balance

The experiment history is passed inline by /report. /report assembles it from prior batches in the same plan file: every experiment's `id`, fully-resolved config (baseline + config_diff chain applied), and primary-metric value. Never read the plan file directly; the inline history is the only input. This check computes the architecture-vs-HP classification itself — /report does not pre-classify.

Write and execute a script that:
- Reads the experiment history (list of past experiment configs and descriptions)
- Classifies each experiment by computing the set-difference between its fully-resolved config and its parent's fully-resolved config. If any changed key belongs to the architecture key-set (`layers`, `activation`, `model_type`, `num_heads`, `hidden_dim`, `depth`), mark it "architecture change". Otherwise mark it "HP tuning". The architecture key-set is declared here in this skill; never inferred from prose.
- Counts consecutive HP-only experiments (no architecture change)
- Flags as stale if more than 3 consecutive HP-only experiments

Output format: `{"total_experiments": int, "arch_changes": int, "hp_changes": int, "consecutive_hp_only": int, "stale": true/false, "recommendation": "string"}`

Research context: analysis of 10,000+ experiments shows 94% of performance variance comes from architecture choices, 6% from hyperparameter tuning. If the agent is only tuning hyperparameters, it is optimizing the 6%.

### Check 3: Pareto Front

Write and execute a script that:
- For each experiment in history, creates a (primary_metric, trainable_params) pair using the recorded `trainable_params` from the plan Results (passed inline by /report alongside history). Never recompute from configs.
- Adds the new experiment's pair
- Determines if the new experiment is Pareto-dominated (another result has BOTH better metric AND fewer or equal parameters)
- Lists which experiments dominate the new one, if any

Output format: `{"on_pareto_front": true/false, "dominated_by": ["exp_id", ...] | null, "pareto_front_members": ["exp_id", ...]}`

## Research Coherence Check

BEFORE reporting your verdict, answer these three questions:
1. What hypothesis was this experiment testing?
2. Does the result support or refute that hypothesis?
3. What does this tell us about the NEXT experiment to try?

If you cannot answer all three, the experiment was random flailing, not research. Report KEEP_WITH_CONCERNS with a note about research coherence.

## Decision Logic

After executing all three checks and the coherence assessment:

```
Check 1 "worth it" + Check 3 on Pareto front + coherent  → KEEP
Check 3 dominated by existing result                      → DISCARD
Check 1 "not worth it"                                    → DISCARD
Check 1 "diminishing returns" + Check 2 stale             → KEEP_WITH_CONCERNS ("try architecture next")
Check 1 "worth it" + Check 2 stale                        → KEEP_WITH_CONCERNS ("try architecture next")
param_ratio < 1.0 (simplification) + metric not degraded  → KEEP (always — simplification wins)
```

## Gate Functions

BEFORE reporting KEEP: Ask: "Is the improvement large enough to justify the complexity added?"
BEFORE reporting DISCARD: Ask: "Am I discarding a genuinely useful change because I'm being too conservative?"
BEFORE reporting: Ask: "Does this experiment build logically on what we've learned so far?"

## Rationalization Table

| You think... | Reality |
|---|---|
| "Any improvement is worth keeping" | Complexity has a cost. Execute the complexity score script. Read the verdict. |
| "The code is ugly but it works" | Ugly code slows future experiments. Simplicity is a feature. |
| "This is a big architectural change so complexity is expected" | Big changes need proportionally big improvements. Check the efficiency ratio. |
| "We should keep it and clean up later" | Later never comes. Judge the change as-is. |
| "We've been tuning LR for 5 experiments and it keeps improving a little" | 94% of variance is architecture. You are optimizing the 6%. Try a different architecture. |
| "The model only got a little bigger" | How much bigger? Compute the parameter ratio. "A little" is not a number. |

## Red Flags

If you catch yourself thinking any of these, STOP:
- "It's just a few extra parameters"
- "We can simplify this later"
- "The improvement is technically positive"
- "I don't want to lose this progress"
- Any sentence estimating model size without executing a script

## When You're in Over Your Head

It is always OK to stop and say "I can't assess the complexity of this change." Bad strategy review is worse than no review. Report KEEP_WITH_CONCERNS with your uncertainty rather than guessing.

## Status Vocabulary

Report exactly one of:
- **KEEP** — Improvement justifies complexity (Check 1 "worth it"), on Pareto front, coherent research direction.
- **DISCARD** — Dominated, or not worth the complexity, or random tangent.
- **KEEP_WITH_CONCERNS** — Improvement is real but concerns exist (stale HP tuning, borderline complexity, weak coherence). Flag for human review.

Include: parameter counts, efficiency ratio, Pareto status, and coherence assessment in your report.

## The Bottom Line
**You are bad at estimating complexity. The computer is good at counting parameters. Write the script. Run the script. Trust the script.**
