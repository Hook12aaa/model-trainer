# Dashboard Spec Reference

## Core Principle

The dashboard JSON spec is the report skill's contract with the rendering page. It is library-agnostic. Swapping ECharts for another chart library means rewriting `render.js`, never the spec or the writer.

## Top-Level Schema

```json
{
  "plan_id": "string",
  "branch": "string",
  "generated_at": "ISO8601 string",
  "header": "object — see Header Object",
  "experiments": "array of Experiment Object",
  "batches": "array of Batch Object",
  "pareto": "object — see Pareto Object",
  "parallel_coords": "object — see Parallel Coords Object", // deprecated — omit
  "learning_curves": "object or null — see Learning Curves Object",
  "trust": "object — see Trust Object",
  "next": "object — see Next Object",
  "hypothesis_integrity_hash": "string — full lowercase hex digest of the hypothesis integrity block"
}
```

Every top-level key is required **except `parallel_coords`**, which is deprecated and should not be emitted by new `/report` invocations. Objects whose value is `null` (e.g. `learning_curves` when no per-iteration history was captured) signal absence of underlying data and are permitted.

## Header Object

```json
{
  "plan_name": "string",
  "total_batches": "int",
  "total_experiments": "int",
  "total_wall_clock_seconds": "int",
  "integrity_summary": {
    "verified": "int",
    "advisory": "int",
    "blocked": "int"
  }
}
```

## Experiment Object

```json
{
  "id": "string",
  "batch": "int",
  "status": "string from train status vocabulary",
  "metrics": "object or null (only present when status is DONE)",
  "params_trainable": "int or null",
  "wall_clock_seconds": "int",
  "worktree_path": "absolute string",
  "log_path": "absolute string",
  "integrity_status": "string: PASS, FAIL_HASH, FAIL_PARAM, FAIL_DETERMINISM, etc.",
  "build_reviewer_verdict": "string: PASS or BLOCKED",
  "metric_reviewer_verdict": "string: ACCEPT, REJECT, INCONCLUSIVE, BLOCKED, or null",
  "strategy_reviewer_verdict": "string: KEEP, DISCARD, KEEP_WITH_CONCERNS, BLOCKED, or null",
  "config": "object — the experiment's full typed config",
  "history": "object or null — per-metric history series if declared in metrics_manifest.json"
}
```

## Batch Object

```json
{
  "id": "int",
  "started_at": "ISO8601 string",
  "completed_at": "ISO8601 string",
  "hardware": {
    "gpu_count": "int",
    "vram_gb_per_gpu": "int or null",
    "ram_gb": "int",
    "cpu_count": "int",
    "python_version": "string",
    "pytorch_version": "string",
    "cuda_version": "string or null"
  },
  "summary": {
    "experiment_count": "int",
    "status_breakdown": "object mapping status string to int count"
  }
}
```

## Pareto Object

```json
{
  "x_axis": "string label",
  "y_axis": "string label",
  "points": [
    {
      "exp_id": "string",
      "x": "float",
      "y": "float",
      "dominated_by": "array of exp_id strings (empty if on Pareto front)"
    }
  ]
}
```

## Parallel Coords Object

```json
{
  "axes": [
    {
      "key": "string",
      "label": "string",
      "scale": "linear, log, or categorical"
    }
  ],
  "series": [
    {
      "exp_id": "string",
      "values": "object mapping axis key to value"
    }
  ]
}
```

## Learning Curves Object

Either `null` when no manifest in the batch declares per-step history, or:

```json
{
  "x_axis": "string",
  "series": [
    {
      "exp_id": "string",
      "points": "array of [step, value] tuples"
    }
  ]
}
```

## Trust Object

```json
{
  "summary_counts": {
    "verified": "int",
    "advisory": "int",
    "blocked": "int"
  },
  "per_experiment_flags": [
    {
      "exp_id": "string",
      "severity": "block or advisory",
      "reason": "string",
      "detail": "string"
    }
  ]
}
```

## Next Object

```json
{
  "diminishing_returns_points": [
    {
      "cumulative_experiment_count": "int",
      "best_metric_so_far": "float"
    }
  ],
  "suggestions": [
    "array of strings, 2-3 cards, each backed by a specific number"
  ],
  "attribution": {
    "architecture": "<float>",
    "hyperparameters": "<float>"
  }
}
```

`diminishing_returns_points` is empty on the first batch.

`attribution` is optional. When present, `architecture` is the share of variance attributable to architecture changes (range [0.0, 1.0]) and `hyperparameters` is the share attributable to HP tuning (range [0.0, 1.0]); the two values should sum to approximately 1.0. The renderer shows the attribution panel only when `attribution.architecture` is a number. Omit the key entirely when no architecture-vs-HP experiments exist in the batch.

## Schema Stability Rules

- Optional keys may be added; existing keys must not change shape.
- Numeric metric values are always floats, never strings.
- Status strings come from the documented vocabulary, never free text.
- Worktree and log paths are always absolute.

## Gate Functions

- BEFORE writing dashboard.json: "Does it conform to the schema in this file?"
- BEFORE adding a new key: "Is it strictly additive, or does it change an existing key's shape?"
- BEFORE rendering on the page: "Is render.js the only place chart-library-specific code lives?"

## Rationalization Table

| Rationalization | Response |
|---|---|
| I can put this metric value as a string for display | All numeric values are floats. Format on the page, not in the spec. |
| Optional means I can use any shape | No. Optional means present-or-null. Shape is fixed. |
| Adding ECharts options to the spec saves a translation step | That couples the spec to a library. Never. |
| The page can compute Pareto on the fly | No. /report computes once and writes points. Page renders. |

## Red Flags

- Any metric value as a string
- Free-text status values not from the train vocabulary
- ECharts option objects in the spec
- Shape changes to existing keys
- Page-side recomputation of analysis already done by /report

## Bottom Line

Write and execute a script that loads `dashboard.json`, validates every required key is present with the declared type, validates every status string is in the documented vocabulary, validates every numeric value is a float not a string, and validates worktree and log paths are absolute. Print `DASHBOARD SPEC: PASS` or `DASHBOARD SPEC: FAIL` with the specific failing key.

## Schema additions (2026-04-15 dashboard redesign)

The dashboard renderer is presence-driven: every panel checks whether its data is present and renders only if so. Additions below are optional; `/report` may omit them at no cost.

### `experiments[].history`

Per-experiment training trajectory. Absent when the builder contract did not capture per-iteration logs.

    experiments[i].history = {
      "x_axis": "boosting_iterations" | "epochs",
      "points": [
        { "iteration": <int>, "train_metric": <float>, "val_metric": <float> },
        ...
      ]
    } | null

Renderer behaviour: the Learning Curves panel renders only when at least one experiment has a non-empty `points` array.

### `experiments[].plain_assessment`

Renderer-visible string summarising the experiment in plain language. Absent → renderer derives from reviewer verdicts using the mapping declared in `skills/report/scripts/render.js` `plainAssessment()`.

    experiments[i].plain_assessment = "honest winner" | "overfit · flagged" | ... | null

### `header.recommendation_headline`

Plain-language one-line verdict string. Absent → renderer constructs one from the winner and flag set.

    header.recommendation_headline = "Experiment exp_003 is the honest winner." | null

### Deprecated

- `parallel_coords` — retained in the schema for backwards compatibility; the renderer ignores the field. New `/report` invocations should not emit it.

### Presence-driven rendering

Every panel is optional at the data layer. The renderer omits the panel entirely (no placeholder text) when the underlying data is absent or empty. Acceptance criterion: a `dashboard.json` containing only `{ header, experiments }` produces a valid dashboard with only Verdict and Full Results sections.
