# Regression Data Quality Reference

## Core Principle

Verify target is continuous and features have measurable signal before training.

## Checks

### Target Validation

- Unique values < 20 — likely classification. Confirm with user before proceeding.
- |skewness| >= 1.0 — recommend log1p for positive values, Yeo-Johnson when negatives present.
- Zero-inflated: >30% zeros — recommend two-stage model or Tweedie regression.
- Target scaling required if |mean| > 100*std or range > 1e6.

### Feature-Target Signal

- Compute Pearson and Spearman correlations against target.
- <10% of features with |r| > 0.05 — weak signal, warn.
- Any feature |r| > 0.98 — probable leakage, fail.
- Compute mutual information. All features MI < 0.01 nats — no predictive value, fail.

### Multicollinearity

- Compute VIF. Fail if > 10. Warn if > 5.
- Condition number > 100 — severe multicollinearity.
- Critical for linear models. Irrelevant for tree-based prediction-only use.

### Outlier Diagnostics

- Cook's distance > 4/n — investigate. > 1 — remove.
- Studentized residuals |t| > 3 — outlier.
- High-leverage: h_ii > 2p/n.
- <1% influential — investigate individually. 1-5% — RobustScaler. >5% — distribution issue.

### Sample Size

- n >= 10*p minimum for linear regression. n >= 5*p for regularized.
- p > 0.5*n — warn. p > n — require regularization or dimensionality reduction.
- n < 30 — fail absolutely.

### Heteroscedasticity

- Breusch-Pagan test p < 0.05 — heteroscedasticity present.
- Remedy: weighted least squares, robust standard errors, or log-transform target.

## Gate Functions

- BEFORE approving data: "Did I compute skewness and recommend transform if needed?"
- BEFORE approving features: "Did I compute VIF, or am I assuming independence?"
- BEFORE proceeding: "Did I check for heteroscedasticity?"

## Rationalization Table

| Rationalization | Response |
|---|---|
| "Target looks roughly normal" | Compute skewness. "Roughly" is not a number. |
| "Features seem independent" | Compute VIF. "Seem" means you didn't check. |
| "A few outliers won't matter" | Compute Cook's distance. "A few" is not a count. |
| "Dataset is big enough" | Compute samples-per-feature ratio. "Big enough" is not a number. |

## Red Flags

- "Target distribution looks fine"
- "Features seem uncorrelated"
- "Outliers are just noise"
- Any size claim without computing the ratio

## Bottom Line

Write and execute a script that loads the quality report, asserts skewness was computed, VIF max < 10, Cook's D outliers resolved, and samples/features >= 10. Print REGRESSION CHECKS: PASS or FAIL with the specific failing check.
