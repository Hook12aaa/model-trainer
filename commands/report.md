---
description: "Generate the post-train batch report with reviewer subagents and dashboard"
---

Invoke the model-trainer:report skill.

Generate the post-train batch report. Dispatches review-metrics and review-strategy as fresh subagents, computes batch and cross-batch analysis, spins up a local Node dashboard server, presents a terminal recommendation, and waits for the human to approve a winner.
