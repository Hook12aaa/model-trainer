# Metric Selection Reference

## Core Principle

The metric is the mathematical proxy of the business cost function. If the metric does not penalize what the business penalizes, training optimizes the wrong thing.

## By Problem Type

### Regression

- MSE — Gaussian noise assumption, penalizes large errors quadratically. Outlier-sensitive.
- MAE — robust to outliers, penalizes all errors equally. Use when typical error matters more than worst-case.
- Huber — MSE near zero, MAE in tails. Best of both when outlier presence is moderate.
- MSLE — penalizes relative error. Use when target spans orders of magnitude (prices, counts).
- Quantile loss — asymmetric cost. Use when over-prediction and under-prediction have different costs.

### Classification

- Cross-entropy — calibrated probabilities. Use when downstream consumer needs probability, not just label.
- Focal loss — down-weights easy examples. Use when class imbalance is severe and hard examples matter.
- F1 / F-beta — harmonic mean of precision and recall. beta > 1 weights recall, beta < 1 weights precision.
- MCC — balanced measure across all four quadrants of the confusion matrix. Use when classes are imbalanced and both positive and negative predictions matter.
- PR-AUC — threshold-independent, precision-recall space. Use when positive class is rare and ranking quality matters.

### Ranking

- NDCG — normalized discounted cumulative gain. Use when position matters and relevance is graded.
- MAP — mean average precision. Use when relevance is binary (relevant/not).

### Time Series

- MAPE — mean absolute percentage error. Interpretable but undefined at zero and biased toward under-prediction.
- SMAPE — symmetric MAPE. Bounded, handles near-zero values better than MAPE.
- Directional accuracy — fraction of correctly predicted direction changes. Use when direction matters more than magnitude.

## Anti-Gaming Metrics

### Generalization Gap

Difference between train and val metric. A model that scores well on train but poorly on val is memorizing. Define a bound in the hypothesis — the review-metrics skill enforces it.

- Bound must be set before training begins.
- Typical bound: val metric within 5-10% of train metric, adjusted for problem difficulty.
- Gap increasing across experiments signals overfitting trajectory.

### Parameter Efficiency

Metric improvement per parameter added. A model that needs 10x parameters for 1% improvement is overfitting capacity to noise.

- Track metric-per-parameter across architecture changes.
- Diminishing returns signal complexity ceiling.

## When the Obvious Metric Is Wrong

| Obvious Choice | Problem | Use Instead |
|---|---|---|
| Accuracy on imbalanced data | Majority-class classifier scores high | MCC or PR-AUC |
| MSE with outliers | Single outlier dominates loss | MAE or Huber |
| R-squared across different datasets | Not comparable, depends on target variance | MAE or domain-specific metric |
| RMSE when typical error matters | Squares amplify outlier influence on reported error | MAE |

## Gate Functions

- BEFORE selecting metric: "Is this metric the mathematical proxy of the business cost, or is it the default I always use?"
- BEFORE finalizing: "Does this metric penalize what the business penalizes? If a model minimizes this metric perfectly, does the business win?"
- BEFORE skipping integrity metrics: "Did I define generalization gap bound and parameter efficiency tracking, or am I hoping the model generalizes?"
- BEFORE using accuracy: "What is the class balance? Would a majority-class predictor score well on this metric?"

## Rationalization Table

| Rationalization | Response |
|---|---|
| "MSE is the standard for regression" | Standard for whom? If outliers exist, MSE penalizes the wrong things. Check the residual distribution. |
| "Accuracy is fine, classes are roughly balanced" | Compute the balance. "Roughly" is not a number. If minority class < 20%, accuracy hides misses. |
| "We can always change the metric later" | The review pipeline needs thresholds now. Changing the metric mid-training invalidates all prior experiments. |
| "R-squared tells us how much variance we explain" | R-squared is not comparable across datasets. Report MAE alongside it or use domain-specific error. |
| "Higher AUC is always better" | ROC-AUC is misleading on imbalanced data. A random classifier looks good when negatives dominate. Use PR-AUC. |
| "The metric doesn't matter much, the model is good" | A model is only as good as what it optimizes. Wrong metric, wrong model. |

## Red Flags

- "Accuracy" without stating class balance
- "MSE" without checking for outliers
- "R-squared" as the sole metric
- No generalization gap bound defined
- No integrity metrics alongside the primary metric
- Selecting a metric because "it's standard" without mapping to business cost
- Optimizing a threshold-dependent metric without defining the operating threshold
- Using ROC-AUC on data where positive class is < 5%

## Bottom Line

Write and execute a verification script that checks: primary metric maps to the decision context documented in the hypothesis, secondary metrics cover failure modes the primary misses, generalization gap bound is defined with a numeric threshold, parameter efficiency tracking is specified, and the metric is not in the "obvious but wrong" list for this data profile. Print METRIC SELECTION: PASS or METRIC SELECTION: FAIL with the specific gap.
