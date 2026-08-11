# LexiPath model comparison

This table uses strict, case-insensitive exact matching on `written` and `intended` against the same human-vetted ground truth. Model inference is isolated from the ground-truth directory; only this post-run evaluator reads both.

| Run                  | Model   | Provider                        | Pipeline      | Guardrails | Samples | GT errors |  TP |  FP |  FN | Precision | Recall |    F1 | Category accuracy | Avg latency (ms) |
| -------------------- | ------- | ------------------------------- | ------------- | :--------: | ------: | --------: | --: | --: | --: | --------: | -----: | ----: | ----------------: | ---------------: |
| gpt-5.5-guardrail    | gpt-5.5 | independent-agent-visual-review | direct-vision |    yes     |     3/3 |        22 |   8 |  12 |  14 |     0.400 |  0.364 | 0.381 |             1.000 |              n/a |
| gpt-5.5-no-guardrail | gpt-5.5 | independent-agent-visual-review | direct-vision |     no     |     3/3 |        22 |  13 |   6 |   9 |     0.684 |  0.591 | 0.634 |             1.000 |              n/a |

## Interpretation limits

- The dataset currently contains only three samples, so results are a pilot rather than a population estimate.
- Historical GPT-5.5 rounds did not capture latency.
- Strict text matching penalises transcription differences even when a model notices the same approximate location.
- Live-provider rows should be compared only when they use the same samples, preprocessing setting, guardrails, and ground-truth revision.
