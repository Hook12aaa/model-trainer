# Online Sourcing Guide

## Core Principle

Evaluate before downloading. Run `date` to know what "recent" means. No dataset is trustworthy by default.

## Source Trustworthiness Tiers

**Tier 1 (high):** UCI ML Repository, Stanford (SNAP, NLP), official benchmarks (ImageNet, GLUE), government statistics bureaus.

**Tier 2 (medium-high):** data.gov, EU Open Data Portal, WHO, World Bank, national census.

**Tier 3 (medium):** Kaggle (>50 upvotes, >1000 downloads), HuggingFace (>100 downloads, documented card), Google Dataset Search.

**Tier 4 (low):** Web-scraped, GitHub one-off uploads, community forums.

Red flags at any tier: no documentation, single-upload anonymous account, data is "too clean" (zero nulls, perfectly balanced), file is raw dump with no schema.

## Documentation Requirements

Reject any dataset missing 3+ of these 7 items:

1. Data dictionary/schema
2. Collection methodology
3. Collection date
4. Known limitations
5. License
6. Intended use
7. Source attribution

Zero documentation is never acceptable.

## License Compatibility

**Safe:** MIT, Apache 2.0, CC0, CC-BY 4.0, Open Data Commons (ODC-By, PDDL).

**Flag for review:** CC-BY-SA (share-alike constrains distribution), CC-BY-NC (no commercial).

**Avoid:** Proprietary, no license stated, custom terms requiring legal review.

No license stated means do not use. "Public" on Kaggle does not mean legally clear.

## Recency Standards

Run `date` first. Compute `current_year - dataset_year`.

| Domain | Staleness Threshold | Risk |
|---|---|---|
| Financial/economic | >1 year | Regime change risk |
| Medical/clinical | >3 years | Guideline drift |
| NLP/text | >5 years | Vocabulary/cultural drift |
| Computer vision | >5 years | Annotation standard changes |
| General | >2 years | Potential staleness |

Collection date missing: use publication date. Neither available: flag as "age unknown" and treat as stale.

## Pre-Download Checklist

All 6 must be answered before downloading:

1. Description readable without downloading?
2. Sample data or schema available?
3. File size disclosed? Flag >1GB without user confirmation.
4. Terms of use present?
5. Community feedback checked? (Kaggle discussions, GitHub issues, paper errata)
6. License identified and compatible?

2+ "No" answers means do not proceed without explicit user approval.

## Post-Download Validation

- Row/column counts match documentation (tolerance 5%).
- Column names and types match schema.
- File format matches description.
- First load succeeds without encoding errors.
- Null rate is plausible. 0% nulls on a large survey is suspicious.

## Ethics

- **PII scan:** Search for patterns matching emails, phone numbers, names, addresses, SSNs. If found, hard stop.
- **Bias assessment:** Compare demographic distribution vs target population.
- **Consent:** Medical, biometric, user-generated content require verified IRB or equivalent. Absence means do not use.

Any ethics failure is a hard stop. No exceptions.

## Gate Functions

- BEFORE searching: "Did I run `date` to know what today is?"
- BEFORE downloading: "Did I check license, documentation, and recency?"
- BEFORE using: "Did post-download validation match the documentation?"
- BEFORE any dataset: "Did I check for PII?"

## Rationalization Table

| Rationalization | Response |
|---|---|
| "It's on Kaggle so it's fine" | Kaggle has no quality standard. Evaluate independently. |
| "It has lots of downloads" | Downloads do not verify quality, license, or recency. |
| "The license says 'public'" | "Public" is not a license. Check the actual license terms. |
| "It was updated recently" | When? Run `date`. Compute the gap. "Recently" is not a date. |
| "Documentation isn't necessary for a well-known dataset" | Well-known datasets have well-known problems. Check the known issues. |

## Red Flags

- "This dataset is popular so it's good"
- "I'll check the license later"
- "The data looks recent"
- Downloading before evaluating
- Any recency claim without running `date`

## Bottom Line

Before recommending any dataset, write and execute a script that checks: license is in the safe list, collection date is within recency threshold for the domain, documentation score >= 4 of 7 required items present, and no PII patterns detected in a sample. Print DATASET EVALUATION: RECOMMENDED or NOT RECOMMENDED with specific failing criteria.
