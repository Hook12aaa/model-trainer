# Research-Agent Dispatch — Three Fixed Agents

Design-experiments dispatches three research agents in parallel before drafting the plan. Dispatch uses a single message containing three `Agent` tool calls. No sequential dispatch. No skipping any agent.

## Agent 1: Environment

Model: cheap.

Prompt contract: execute commands, return machine-verified facts. Interpretation forbidden.

Commands to run:

- `uname -a`
- `python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.backends.mps.is_available())"`
- `nvidia-smi` on CUDA systems, skip on others
- `python -c "import platform; print(platform.python_version())"`
- `vm_stat` on macOS, `cat /proc/meminfo` on Linux

Output schema (JSON):

    {
      "os": "<uname -s>",
      "arch": "<uname -m>",
      "python_version": "<string>",
      "torch_version": "<string>",
      "compute_backend": "cuda | mps | cpu",
      "device_count": <int>,
      "vram_gb_per_device": <float | null>,
      "ram_gb": <float>,
      "cpu_count": <int>
    }

Forbidden output: recommendations, opinions, any field not in the schema; any occurrence of TBD, TODO, FIXME, e.g., appropriate, should consider, maybe, probably in output prose.

## Agent 2: Data-Context

Model: standard.

Prompt contract: extract from existing artifacts. Synthesis forbidden.

Inputs read:

- `docs/model-trainer/data-quality-report.json`
- The approved hypothesis file at `docs/model-trainer/hypotheses/<file>.md`
- The hypothesis sidecar at `docs/model-trainer/hypotheses/<file>.md.sha256`
- The three split sidecars declared in the hypothesis Integrity Block's `## Split Strategy` subsection: `splits/train.parquet.sha256`, `splits/val.parquet.sha256`, `splits/test.parquet.sha256`

Output schema (JSON):

    {
      "split_paths": {"train": "<path>", "val": "<path>", "test": "<path>"},
      "split_hashes": {"train": "<sha256>", "val": "<sha256>", "test": "<sha256>"},
      "feature_whitelist": [<string>],
      "excluded_features": [<string>],
      "sample_counts": {"train": <int>, "val": <int>, "test": <int>},
      "class_balance_or_target_distribution": <blob>,
      "locked_primary_metric": "<string>",
      "locked_secondary_metric": "<string>",
      "locked_integrity_metric": "<string>",
      "architecture_bounds_max_params": <int>,
      "generalization_gap_bound": <float>
    }

Forbidden output: new statistics, metric recommendations, hypothesis judgment, any field not in the schema; any occurrence of TBD, TODO, FIXME, e.g., appropriate, should consider, maybe, probably in output prose.

## Agent 3: Pitfall

Model: most capable.

Prompt contract: research known failure modes for the task class declared in the hypothesis. Every row must point to a concrete plan field that addresses the risk.

Inputs read:

- The approved hypothesis file at `docs/model-trainer/hypotheses/<file>.md`

Output schema (JSON array):

    [
      {
        "risk": "<short name>",
        "evidence_source": "<citation or link>",
        "mitigation": "<imperative statement>",
        "plan_impact": "<exact plan field that enforces the mitigation>"
      }
    ]

Forbidden output: generic advice, prose commentary, rows with null or empty `plan_impact`, any object key not in the schema; any occurrence of TBD, TODO, FIXME, e.g., appropriate, should consider, maybe, probably in output prose.

## Dispatch Pattern

Single message, three `Agent` tool calls, sent in parallel. Each call specifies its model per the section above. Collect all three results before proceeding to plan drafting.

Failure handling: if any agent returns a malformed output (schema mismatch), redispatch that single agent. Do not proceed to plan drafting with partial or malformed outputs.
