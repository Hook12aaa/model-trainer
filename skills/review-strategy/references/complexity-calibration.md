# Complexity Threshold Calibration

## Purpose

review-strategy's Check 1 ("Complexity Score") uses four numeric thresholds to classify an experiment's parameter-ratio and efficiency into `worth it`, `diminishing returns`, or `not worth it`. This file declares the default calibration values. /report reads these values only when the plan's `review_config.complexity_thresholds` block is absent. Plans that declare their own values override this reference field-by-field.

## Calibration Values

    param_ratio_worth_it_max      = 1.5
    param_ratio_not_worth_it_min  = 2.0
    efficiency_worth_it_min       = 0.05
    efficiency_not_worth_it_max   = 0.02

## Rationale

- **`param_ratio_worth_it_max = 1.5`** — a 50% parameter increase is the upper bound at which added capacity is routinely justified by meaningful accuracy gains on tabular and small-sequence benchmarks. Above 1.5, the marginal gain per parameter typically compresses.
- **`param_ratio_not_worth_it_min = 2.0`** — doubling parameter count is the lower bound at which the experiment must clear a higher efficiency bar to justify itself. Below 2.0 but above 1.5 is the ambiguous band.
- **`efficiency_worth_it_min = 0.05`** — a 5% relative metric improvement per unit of added parameter fraction. Derived from the target-cost regime where a strong improvement offsets a moderate capacity bump.
- **`efficiency_not_worth_it_max = 0.02`** — below 2% efficiency, the cost of the added capacity (inference latency, memory pressure, training time) dominates the signal.

## Plan Override

A plan may declare any subset of the four keys inside its `review_config.complexity_thresholds` block adjacent to the integrity block. /report merges the plan's declared values over this reference field-by-field. Both sources together must produce all four values before review-strategy dispatches; partial coverage with no reference fallback is a dispatch error.

## Revision

Values in this file change only via a tracked commit on the plugin repository. Per-plan tuning belongs in the plan's `review_config`, not here.
