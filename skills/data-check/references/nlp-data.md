# NLP Data Quality Reference

## Core Principle

Verify text is clean, vocabulary is adequate, and duplicates are removed.

## Checks

### Text Integrity

- UTF-8 decode all documents. Any failures flag and re-encode or discard.
- >5% empty or whitespace-only documents flag. Drop before training.
- >1% non-printable characters (Unicode Cc/Cf excluding \n, \t) flag. Strip.
- >2% documents with HTML/markup tags detected flag. Strip tags.
- Encoding artifacts (mojibake: Â, â€™, Ã©) flag. Re-decode from likely source encoding.

### Document Length

- Compute token counts. Report min, max, mean, median, std, P5, P95.
- >10% documents under 3 tokens flag (negligible signal).
- Coefficient of variation (std/mean) > 2.0 flag (extreme variability).
- >5% documents exceed model max sequence length flag truncation risk. Report % at 128, 256, 512, 1024.

### Vocabulary

- Compute vocabulary size and growth curve. Heaps' law beta < 0.3 indicates repetitive data. beta > 0.7 indicates noisy/uncleaned data.
- OOV rate against target tokenizer. > 20% warn. For subword tokenizers, average splits per word > 2.5 warn.
- Tokens appearing < 3 times: flag if > 50% of vocabulary (normal but note).
- Stopword ratio > 0.8 per document indicates low-content. < 0.05 indicates likely not natural language.

### Language

- Run langdetect or fasttext on sample of min(500, N) documents.
- >5% unexpected language flag.
- Flag mixed-language documents (sentence-level detection).

### Duplicates

- Exact: SHA-256 hash. >5% deduplicate.
- Near-duplicate: MinHash (128 permutations), Jaccard > 0.9 is near-duplicate. >10% in clusters flag.
- Boilerplate: same sentence in >5% of documents strip.

### Labels (if classification)

- Same balance thresholds as classification reference.
- Label-length Spearman |r| > 0.3 indicates bias (long documents always one class).
- Single-token precision > 0.95 indicates keyword leakage.
- Inter-annotator Cohen's kappa: > 0.6 acceptable, > 0.8 good, < 0.4 unreliable.

### Preprocessing

- Assert identical tokenizer config across train/val/test (hash and compare).
- Report truncation % at chosen max length. >10% consider longer length or chunking.
- Document special token handling decisions (URLs, emails, numbers, dates).

## Gate Functions

- BEFORE approving text: "Did I check encoding, or am I assuming UTF-8?"
- BEFORE approving vocabulary: "Did I compute OOV rate against the target tokenizer?"
- BEFORE approving: "Did I run duplicate detection, or am I assuming uniqueness?"

## Rationalization Table

| Rationalization | Counter |
|---|---|
| "Text looks clean" | Run encoding check. "Looks" is not a byte-level verification. |
| "Vocabulary coverage is fine" | Compute OOV rate. "Fine" is not a percentage. |
| "No duplicates — documents have different titles" | Titles mean nothing. Hash the content. |
| "Documents are long enough" | Compute length distribution. "Enough" is not a token count. |

## Red Flags

- "Text looks clean"
- "Vocabulary seems adequate"
- "No obvious duplicates"
- Any quality claim without computed metrics

## Bottom Line

Write and execute a script that loads the quality report, asserts encoding clean, OOV rate < 20%, duplicates < 5%, and length distribution computed. Print NLP CHECKS: PASS or FAIL with the specific failing check.
