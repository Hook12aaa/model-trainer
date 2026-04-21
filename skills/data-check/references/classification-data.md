# Classification Data Quality Reference

## Core Principle

Verify labels are clean, classes are separable, and balance is addressed.

## Checks

### Label Quality

- Contradictory labels: identical feature vectors with different targets. >2% contradictions --> investigate.
- Mixed casing, trailing whitespace, synonym variants in label values --> fail. Normalize before proceeding.
- Confidence scores available: flag samples below 0.70. No confidence scores: use cleanlab. Noise rate >5% --> flag.
- Multi-label detection: target contains lists or multiple binary columns summing >1 per row.
- Ordinal detection: numeric integers with <20 unique values or ordered keywords --> confirm task type with user.

### Class Balance

- Imbalance ratio 4:1 --> monitor.
- Imbalance ratio 9:1 --> remediate with class weights or SMOTE.
- Imbalance ratio 19:1 --> severe. Use focal loss or ensemble methods.
- Imbalance ratio 99:1 --> reframe as anomaly detection.
- Per-class minimum samples: 50 floor. 100 reliable. 1000 for deep learning.
- Metric selection: accuracy acceptable above 80:20 balance. Below 80:20 --> use PR-AUC, F1, or MCC. Never ROC-AUC alone below 10:1.

### Feature Relevance

- Single-feature AUC >0.95 --> probable leakage, fail.
- All features AUC <0.55 --> poor separability, warn.
- Chi-squared test for categorical features. ANOVA F-test for continuous features. p >0.05 --> irrelevant feature.

### Decision Boundary

- 1-NN leave-one-out accuracy <60% --> high class overlap, warn.
- Features per samples-per-class >20 --> curse of dimensionality. Recommend dimensionality reduction.

### Evaluation Setup

- Stratified splits mandatory. Class proportions must stay within 5% relative of original distribution.
- Minimum 30 test samples per class for statistical significance.
- CV fold selection: n <500 --> 10-fold. 500-10K --> 5-fold. >10K --> 3-fold or holdout.

## Gate Functions

- BEFORE approving labels: "Did I check for contradictory labels and noise rate?"
- BEFORE approving balance: "Did I compute imbalance ratio and select an imbalance-robust metric matching that ratio (F1/PR-AUC/balanced accuracy)?"
- BEFORE approving split: "Did I verify stratification preserves class proportions?"

## Rationalization Table

| Rationalization | Response |
|---|---|
| "Classes are roughly balanced" | Compute the ratio. "Roughly" is not a number. |
| "Accuracy is a fine metric" | What is the imbalance ratio? Below 80:20, accuracy is misleading. |
| "A few mislabeled samples won't matter" | Compute noise rate. "A few" is not a count. |
| "We have enough samples" | Compute per-class count. "Enough" is not a number. |

## Red Flags

- "Classes look balanced"
- "Accuracy should work"
- "Labels seem clean"
- Any claim about balance without computing the ratio

## Bottom Line

Write and execute a script that loads the quality report, asserts label noise rate <5%, imbalance ratio computed, stratified split verified, and minimum per-class samples met. Print CLASSIFICATION CHECKS: PASS or FAIL with the specific failing check.
