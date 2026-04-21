# Problem Framing Reference

## Core Principle

Framing is derived from the downstream decision, not the data shape. Ask what action the prediction triggers before choosing the problem type.

## Decision Rule

- Threshold-based action (approve/deny, flag/pass) -- classification.
- Arithmetic use of prediction (pricing, forecasting, inventory) -- regression.
- Ordering items (recommendations, search ranking) -- ranking.
- Cost-asymmetric decisions (fraud detection, medical diagnosis) -- weighted loss.
- Multi-modal target distribution (bimodal demand, mixed populations) -- mixture model or quantile regression.

## Data Characteristics That Inform Framing

- Target cardinality: continuous high-cardinality -- regression. Low discrete values -- classification. Ordered discrete values -- ordinal regression.
- Class balance: severe imbalance (minority < 1%) may indicate anomaly detection framing instead of classification.
- Temporal structure: time-indexed data with a forecasting need -- time series framing, not tabular regression.
- Multi-target: multiple outputs with shared structure -- multi-task learning framing.

## Common Misframings

- Binning a continuous target into categories when the consumer needs a number. Use regression.
- Classification when ranking is the real need. Optimize NDCG, not accuracy.
- Regression when the target distribution is multimodal. Consider mixture models or quantile regression.
- Binary classification ignoring cost asymmetry. False positive and false negative costs differ -- use weighted loss or threshold tuning on calibrated probabilities.
- Defaulting to classification because the target column has discrete values. For ordered categories use ordinal regression; discrete-but-ordered targets carry rank information classification discards.

## Gate Functions

- BEFORE framing: "What decision does this model inform? Am I choosing by data shape or by decision context?"
- BEFORE classification: "Is the consumer comparing to a threshold, or do they need the actual number?"
- BEFORE regression: "Is the target distribution unimodal, or does it have multiple modes?"
- BEFORE ranking: "Does the consumer need relative ordering or absolute scores?"
- BEFORE locking the problem type: "Did I check target cardinality, class balance, temporal structure, and multi-target characteristics?"

## Rationalization Table

| You think... | Reality |
|---|---|
| "The target is categorical, so it's classification" | Check if the categories are ordered. Ordinal regression may be correct. |
| "I'll bin the continuous target into buckets" | The consumer loses precision. Use regression unless the decision is genuinely threshold-based. |
| "Accuracy is the right metric for this classifier" | What is the class balance? What are the relative costs of false positives vs false negatives? |
| "Regression handles this continuous target" | Plot the distribution. If it is bimodal, a single-point prediction is misleading. |
| "Classification works because we only care about top/bottom" | If you need ordering within top/bottom, that is ranking, not classification. |
| "The target has 5 values so it's multi-class" | Are those values ordered (ratings, severity levels)? Ordinal regression preserves that structure. |
| "Class imbalance just needs oversampling" | Severe imbalance may mean the problem is anomaly detection, not classification. Reframe before resampling. |
| "Time-indexed data is just another regression feature" | Temporal structure requires time-series framing: chronological train/val/test splits, zero future leakage, horizon-aware metrics (MAPE, sMAPE, MASE). |

## Red Flags

- Choosing problem type before asking what decision the model informs.
- "The target column is categorical, so classification."
- "The target column is numeric, so regression."
- Binning a continuous target without confirming the consumer needs categories.
- Optimizing accuracy on an imbalanced dataset.
- Ignoring cost asymmetry between error types.
- Using tabular regression on time-indexed forecasting data.
- Single-point regression on a multimodal target distribution.
- "We'll figure out the right framing during training."

## Bottom Line

Write and execute a verification script that checks: the hypothesis document contains a decision-context justification for the chosen problem type, the framing matches the decision rule (not the data shape), misframing checks were addressed (target cardinality, class balance, temporal structure, multi-target), and the chosen framing is consistent with the data quality report characteristics. Print FRAMING VERIFIED or FRAMING INCOMPLETE with the specific gap.
