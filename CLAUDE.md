# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Model Trainer** is a Claude Code plugin for autonomous ML model training. It ships as pure markdown/YAML skills — no Python engine. Claude Code is the runtime.

## Plugin Structure

- `skills/` — SKILL.md files that Claude loads and follows
- `commands/` — Slash command stubs that trigger skills
- `hooks/` — SessionStart hook bootstraps the plugin
- `.claude-plugin/` — Plugin manifest

## Workflow

```
/data-check → /hypothesize → /design-experiments → /train → /report
```

Each stage must complete before the next. Human approves at hypothesis, plan, and batch report gates.

## Skills

| Skill | What it does |
|---|---|
| using-model-trainer | Bootstrap — loaded at session start, lists all available skills |
| data-check | Validates data exists and meets quality standards (3 paths) |
| hypothesize | Agrees on architecture, metrics, concrete success criteria |
| design-experiments | Plans batches, sets up git branches, creates experiment log |
| train | Executes experiments with git tracking, dispatches reviewer subagents |
| review-metrics | 4-layer defense-in-depth metric validation (subagent) |
| review-strategy | Complexity scoring, Pareto front, coherence (subagent) |
| report | Generates X-Ray dashboard and evidence-based recommendations |

## Key Principles

- **Execute, Don't Eyeball** — all numerical comparisons via executed Python scripts, never by reading numbers
- **Bad work is worse than no work** — always OK to escalate
- **Lean context** — each skill carries what it needs
- **Structural distrust** — no agent both produces and approves its own work

## Skill Anatomy

Every skill has: Core Principle, Gate Functions, Rationalization Table, Red Flags, Bottom Line.

## Status Vocabulary

All skills use: DONE, DONE_WITH_CONCERNS, BLOCKED, NEEDS_CONTEXT.

## Duplicated Skill References

The file `references/execute-dont-eyeball.md` is intentionally duplicated in two locations:
- `skills/review-metrics/references/execute-dont-eyeball.md`
- `skills/review-strategy/references/execute-dont-eyeball.md`

The two copies must remain byte-identical. When editing one, also edit the other and run:

`diff skills/review-metrics/references/execute-dont-eyeball.md skills/review-strategy/references/execute-dont-eyeball.md`

A non-zero exit code is a bug.

This intentional duplication honors the project's self-contained-skills convention. A shared-references pattern would be a larger architectural change and is out of scope.
