# Execute, Don't Eyeball

## The Problem

You are an LLM. Research has documented that LLMs have:
- **Numerical insensitivity**: difficulty distinguishing 0.045 from 0.052
- **Position bias**: preferring numbers earlier in context ~61% of the time
- **Verbosity bias**: ~15% score inflation for longer outputs
- **Self-preference bias**: 5-7% boost to outputs resembling their own
- **Hallucinated judgments**: saying "this looks good" without any basis

You CANNOT reliably judge whether a metric value is "good" or "bad" or whether an improvement is meaningful.

## The Rule

**Every numerical comparison must be done by writing and executing a Python script.** The script's structured output is the truth. Your interpretation of raw numbers is not.

### What You Do:
- **Context** — is this improvement worth pursuing given the research direction?
- **Strategy** — what should we try next based on the evidence?
- **Domain knowledge** — does this architecture make sense for this problem?

### What You Do NOT Do:
- Arithmetic
- Statistical comparison
- Deciding if a metric value is "good" without a pre-defined threshold
- Comparing two numbers and judging which is "meaningfully better"

## Enforcement

BEFORE making any judgment about metrics:
  Ask: "Do I have a pre-defined threshold for this metric?"
  - YES → Write a script that compares programmatically against that threshold
  - NO  → STOP. You cannot judge this metric. Compute baseline statistics first.

NEVER say "this looks good" or "this seems high/low."
If you catch yourself using words like "seems", "looks", "appears" about a number — you are hallucinating. Execute code instead.

## The Script Pattern

For every comparison, write a script that:
1. Loads the raw data from files (not from your memory or the executor's report)
2. Computes the specific comparison (relative change, threshold check, etc.)
3. Prints a structured JSON result
4. You read the JSON and interpret the CONTEXT, not the ARITHMETIC

```python
# Example pattern
import json

baseline = json.load(open("baseline_metrics.json"))
new = json.load(open("new_metrics.json"))

baseline_val = baseline["val_mse"]
new_val = new["val_mse"]
threshold = 0.03  # from success criteria

relative_change = (baseline_val - new_val) / abs(baseline_val)
significant = relative_change > 0.005  # 0.5% minimum

result = {
    "baseline_value": baseline_val,
    "new_value": new_val,
    "relative_change": round(relative_change, 6),
    "significant": significant,
    "meets_target": new_val < threshold,
}
print(json.dumps(result, indent=2))
```

## The Bottom Line
**You are bad at math. The computer is good at math. Write the script. Run the script. Trust the script.**
