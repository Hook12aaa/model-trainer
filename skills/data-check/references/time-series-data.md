# Time Series Data Quality Reference

## Core Principle

Verify temporal integrity and prevent chronological leakage. Random splits are leakage -- fail immediately.

## Checks

### Temporal Integrity

- Timestamps monotonically increasing. Fail if not.
- Duplicate timestamps for same series. Fail.
- Infer expected interval from median gap. Flag gaps > 2x median interval.
- Gap percentage: > 5% for high-frequency data (interval < 1h), > 1% for low-frequency data (interval >= 1d). Fail.
- All timestamps must share timezone. Mixed offsets. Fail.

### Stationarity

- ADF test p > 0.05. Non-stationary, recommend differencing.
- KPSS test p < 0.05. Confirms non-stationary.
- Blocking for ARIMA, VAR, exponential smoothing, linear regression. Informational for tree-based and deep learning.

### Seasonality

- ACF: significant spikes (outside 1.96/sqrt(N)) at regular lags. Seasonal.
- Test periods: hourly data 24, 168. Daily 7, 30, 365. Weekly 52. Monthly 12.
- STL decomposition: seasonal strength > 0.6. Significant.
- Multiple periods: use MSTL for nested seasonality.

### Missing Data

- Classify: random (< 3 consecutive), block (>= 3 consecutive), systematic (chi-squared on gap positions p < 0.05).
- Never mean impute. Destroys autocorrelation structure.
- Smooth signals: linear interpolation. Step functions: forward-fill. Periodic: seasonal decomposition.

### Train/Test Split

- max(train_timestamps) >= min(test_timestamps). FAIL IMMEDIATELY. This is leakage. No exceptions.
- Test set >= 1 full seasonal cycle.
- Embargo period >= 1 full period between train end and test start for high-frequency data.
- Walk-forward cross-validation: minimum 3 folds, each fold's train end < validation start.

### Feature Validation

- Lag-k feature at time t must source from t-k only. Referencing t or later. Fail.
- Rolling windows must exclude current observation.
- Calendar features: extract only after confirming timezone.

### Regime and Drift

- CUSUM or Pettitt test on rolling mean (window = 5% of series). p < 0.05. Regime change.
- Train vs test: KS test on target. p < 0.05. Concept drift. Flag feature mean drift > 0.5 std.

## Gate Functions

- BEFORE splitting: "Is this a chronological split? Random split on time series is leakage. No exceptions."
- BEFORE approving: "Did I check for stationarity? Did I test for seasonality?"
- BEFORE features: "Do lag features and rolling windows strictly exclude current and future observations?"

## Rationalization Table

| Rationalization | Counter |
|---|---|
| "Random split is fine for this time series" | No. Chronological split only. No exceptions. |
| "The series looks stationary" | Run ADF and KPSS. "Looks" is not a p-value. |
| "Missing gaps are small" | Compute gap percentage. "Small" is not a number. |
| "Mean imputation is quick and easy" | Mean imputation destroys autocorrelation. Never use it on time series. |

## Red Flags

- "Random train/test split"
- "Series looks stationary"
- "Gaps are negligible"
- "Mean imputation"
- Any split that is not chronological

## Bottom Line

Write and execute a script that loads the quality report, asserts chronological split (max train < min test), gap percentage within threshold, stationarity tested, and no lag features reference future data. Print TIME SERIES CHECKS: PASS or FAIL with the specific failing check.
