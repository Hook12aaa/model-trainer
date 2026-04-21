# Quality-Check Threshold Rationale

## Purpose

The eight universal checks in `data-check/SKILL.md` cite numeric thresholds (row-count floors, missing-value bands, imbalance ratios, correlation caps, outlier bounds). This file records the rationale behind each threshold so plans may override with cause. Thresholds are the spec of the quality gate, not fallback defaults — they encode the mechanical rule the check applies.

## Overrideable via `data_quality_config`

A plan or an explicit operator instruction may declare a `data_quality_config` block at the project root (`docs/model-trainer/data-quality-config.json`) overriding any of the values below field-by-field. When present, the quality reviewer subagent reads that file first and uses the merged values. When absent, the reviewer applies the values in this reference as-is. The reviewer records the effective threshold source (`reference` or `config`) per check in `data-quality-report.json`.

## Thresholds and Rationale

### Shape & Size

- `min_rows = 30` — below 30 samples, statistical significance tests lose power regardless of method. Cell cutoff for the Central Limit Theorem on most distributions.
- `min_samples_per_feature = 10` — rule of thumb for tabular ML; below this ratio, the one-in-ten rule predicts systematic overfitting.

### Missing Values

- `impute_simple_max = 0.05` — up to 5% missing is safe for mean/mode imputation; bias introduced is negligible relative to sampling variance.
- `impute_advanced_max = 0.15` — 5–15% requires imputation that preserves covariance structure (MICE, KNN); simple imputation begins to distort distributions.
- `missingness_indicator_max = 0.40` — 15–40% missingness carries information; the indicator column preserves that signal for the model.
- `drop_column_min = 0.40` — above 40% missing, imputation introduces more noise than signal; the column is dropped.

### Target Variable

- `target_missing_max = 0.40` — same cutoff as the feature-drop threshold; more missing target values than this is a data-collection problem, not a modeling problem.

### Duplicates

- `duplicate_row_warn = 0.01` — above 1% duplicate rows, leakage between train and test becomes likely.

### Distributions

- `skew_abs_max = 1.0` — |skew| above 1 violates assumptions of linear models and distance-based methods; transform recommended.
- `near_constant_max = 0.99` — a column whose modal value covers 99%+ of rows carries almost zero information.

### Correlations

- `feature_redundancy_threshold = 0.90` — |r| > 0.9 between features produces multicollinearity severe enough to destabilize linear-model coefficients.
- `feature_target_leakage_threshold = 0.98` — |r| > 0.98 between a single feature and the target is almost always a leak or a tautology, not a real signal.
- `vif_max = 10` — standard variance-inflation-factor cutoff for multicollinearity.

### Outliers

- `mad_z_threshold = 3.5` — robust z-score cutoff; MAD-based rather than standard-deviation-based because outliers inflate SD and hide themselves.
- `outlier_fraction_investigate = 0.05` — above 5% flagged outliers in a column, the distribution itself needs inspection before removal.

### Classification Balance (from `classification-data.md`)

- `imbalance_monitor = 4.0` (4:1 ratio) — above this, default accuracy is already slightly misleading.
- `imbalance_remediate = 9.0` — class weighting or SMOTE becomes necessary.
- `imbalance_severe = 19.0` — requires focal loss or ensembles.
- `imbalance_anomaly = 99.0` — reframe as anomaly detection; classification is the wrong tool.
- `min_samples_per_class_floor = 50` / `reliable = 100` / `deep_learning = 1000` — power-analysis-derived floors for per-class statistical reliability.
- `accuracy_balance_max = 4.0` (80:20) — above an 80:20 balance, accuracy is an acceptable top-line metric; below it, use PR-AUC, F1, or MCC.

## Revision Discipline

Changes to this file require a tracked commit on the plugin repository. Per-project tuning belongs in `docs/model-trainer/data-quality-config.json`, not here.
