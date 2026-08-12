# LexiPath AI evaluation workspace

This directory is for AI accuracy, recommendation-quality, speed, and model-comparison evidence. It is intentionally separate from deterministic CI tests because live model calls can be slow, costly, and non-deterministic.

## Directory layout

```text
evaluation/
  samples/                  # approved or synthetic scans only
  ground-truth-candidates/  # model-generated drafts; not evidence yet
  ground-truth-vetted/      # human-vetted JSON; counts as ground truth
  predictions/              # model outputs grouped by model/pipeline
  reports/                  # generated accuracy/speed summaries
  schemas/ground-truth.schema.json
  scripts/validate-ground-truth.mjs
  scripts/evaluate-error-detection.mjs
```

## Ground-truth rule

Model-generated labels are only candidates. A file becomes ground truth only after a human reviewer checks/corrects it and saves it under `ground-truth-vetted/`.

Do not fake accuracy numbers. If there is not enough vetted data, report the method or a clearly-labelled small pilot.

## Commands

Run from the repository root.

Validate all human-vetted ground-truth JSON files:

```bash
node evaluation/scripts/validate-ground-truth.mjs
```

Evaluate predictions in the default `evaluation/predictions/gemini/` directory against the vetted
ground truth:

```bash
node evaluation/scripts/evaluate-error-detection.mjs
```

Evaluate a specific model or pipeline directory:

```bash
node evaluation/scripts/evaluate-error-detection.mjs evaluation/predictions/<model-or-pipeline>
```

These scripts are evaluation utilities, not deterministic CI tests. They report meaningful metrics
only when `ground-truth-vetted/` contains human-reviewed labels and the selected predictions
directory contains matching JSON files.

## Error detection/classification metrics

The evaluation scripts are designed to report:

- true positives, false positives, false negatives
- detection precision, recall, and F1
- classification accuracy on matched errors
- per-category confusion counts
- model latency when predictions include `latencyMs`

## Prediction format

Prediction files should follow the same top-level shape as ground truth and may include:

```json
{
  "sampleId": "sample-001",
  "model": "gemini-2.0-flash",
  "pipeline": "direct-vision",
  "latencyMs": 1420,
  "errors": []
}
```

## Generate live Gemini predictions

Load the API key from `server/.env` without printing it and name each model explicitly:

```bash
node --env-file=server/.env evaluation/scripts/generate-model-predictions.mjs \
  gemini-flash-lite-latest gemini-flash-latest gemini-pro-latest
```

The generator mirrors the production upload path by rendering every PDF into one PNG per page before inference. Predictions are written to `evaluation/predictions/<model>/`. Useful optional controls are:

- `BENCHMARK_SAMPLE_IDS=sample-a,sample-b` — run only selected vetted samples.
- `BENCHMARK_RETRY_FAILED_ONLY=true` — preserve successful predictions and retry failures.
- `BENCHMARK_DELAY_MS=2000` — delay between requests to reduce quota pressure.

Evaluate one generated model directory with:

```bash
node evaluation/scripts/evaluate-error-detection.mjs \
  evaluation/predictions/gemini-flash-latest
```

Live model failures remain in the prediction set with `status: "failed"` and count toward false negatives and the reported failure rate. Do not describe a partial or quota-blocked run as a successful model benchmark.

For direct comparison, only compare equivalent pipelines. For example, Gemini direct vision should not be presented as the same architecture as DeepSeek over OCR text unless the report clearly labels it as `ocr-plus-text`.
