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

For direct comparison, only compare equivalent pipelines. For example, Gemini direct vision should not be presented as the same architecture as DeepSeek over OCR text unless the report clearly labels it as `ocr-plus-text`.
