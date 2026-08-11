# First-round AI error findings for human vetting

Evaluator: GPT-5.5 visual review through Hermes Agent  
Date: 2026-08-11  
Status: Candidate labels only — not ground truth until human-vetted.

## How to vet

For each row, fill the `Human verdict` column in your copy/review notes:

- `accept` — keep as ground truth.
- `edit` — keep but change written/intended/category/rationale/location.
- `reject` — remove from ground truth.
- `add` — add any missed error not listed here.

After vetting, copy corrected JSON files from:

```text
evaluation/ground-truth-candidates/
```

to:

```text
evaluation/ground-truth-vetted/
```

and change `reviewStatus` from `candidate` to `vetted`.

## Sample transcripts used for first pass

### writing-16127

Approximate transcript, uncertain words preserved/flagged:

> one Day I was runing back home be cause I need to go pee so  
> I was so abchen that I pee on my pant back home, so I call my  
> mom on my phone and say I my mom my pant she say hurry come back  
> home, so I Hid and I run back home and wash myslef up befor going sleep

### student-191379

> He run  
> The fox hunt  
> I sang  
> Pam swims in water  
> Tom Hoops

### student-92398

> John took a nap in his room.  
> Birds can fly because they have wings and light bones.  
> We planned to visit her in the morning.  
> The girl sat on the bed in the room.  
> Peter ran as fast as he could from cats

## Candidate error table

| ID | Sample | Written text | Intended text | Category | Confidence | Rationale | Human verdict |
|---|---|---|---|---|---:|---|---|
| writing-16127-e001 | writing-16127 | Day | day | capitalisation | 0.80 | Word appears mid-sentence after `one` but is capitalised. |  |
| writing-16127-e002 | writing-16127 | runing | running | orthographic | 0.85 | Missing doubled consonant in `running`. |  |
| writing-16127-e003 | writing-16127 | be cause | because | orthographic | 0.85 | Compound word is split into two words. |  |
| writing-16127-e004 | writing-16127 | need | needed | morphological | 0.65 | Past-tense narrative context likely requires `-ed`. |  |
| writing-16127-e005 | writing-16127 | abchen | anxious | unsure | 0.35 | Teacher-underlined and likely intended as `anxious`, but handwriting is uncertain. |  |
| writing-16127-e006 | writing-16127 | pee | peed | morphological | 0.60 | Past-tense event likely needs `-ed`. |  |
| writing-16127-e007 | writing-16127 | pant | pants | morphological | 0.75 | Plural noun form is expected. |  |
| writing-16127-e008 | writing-16127 | call | called | morphological | 0.75 | Past-tense narrative context likely requires `-ed`. |  |
| writing-16127-e009 | writing-16127 | say | said | morphological | 0.65 | Past-tense speech reporting should use `said`. |  |
| writing-16127-e010 | writing-16127 | Hid | hid | capitalisation | 0.70 | Word appears mid-sentence but is capitalised. |  |
| writing-16127-e011 | writing-16127 | run | ran | morphological | 0.80 | Past tense of `run` should be `ran`. |  |
| writing-16127-e012 | writing-16127 | wash | washed | morphological | 0.75 | Past-tense narrative context likely requires `-ed`. |  |
| writing-16127-e013 | writing-16127 | myslef | myself | orthographic | 0.75 | Letters appear transposed in `myself`. |  |
| writing-16127-e014 | writing-16127 | befor | before | orthographic | 0.70 | Final `e` appears omitted from `before`. |  |
| writing-16127-e015 | writing-16127 | going sleep | going to sleep | unsure | 0.45 | Likely missing function word `to`; phrase-level grammar issue rather than single-word spelling. |  |
| student-191379-e001 | student-191379 | He run | He runs | morphological | 0.85 | Third-person singular present-tense verb likely requires `-s`. |  |
| student-191379-e002 | student-191379 | The fox hunt | The fox hunts | morphological | 0.80 | Third-person singular subject likely requires present-tense `-s`. |  |
| student-191379-e003 | student-191379 | Hoops | hops | orthographic | 0.70 | Likely intended verb is `hops`; written form has an extra `o` and capital H mid-line. |  |
| student-92398-e001 | student-92398 | cats | cats. | punctuation | 0.55 | Final sentence appears to end without a full stop; confirm whether punctuation was expected. |  |

## Category summary before vetting

| Category | Candidate count |
|---|---:|
| capitalisation | 2 |
| orthographic | 5 |
| morphological | 9 |
| punctuation | 1 |
| unsure | 2 |
| phonological | 0 |

## Notes for metric calculation after vetting

After you vet these labels, we can run GPT-5.5/model-output evaluation against the vetted files and calculate:

| Metric group | Metrics |
|---|---|
| Detection | TP, FP, FN, precision, recall, F1 |
| Classification | category accuracy, per-category confusion counts |
| Speed | latency per sample, average latency, p95 if multiple runs exist |
| Recommendation system | evidence faithfulness, target-category relevance, worksheet/page-range usefulness, hallucinated resource rate |

The candidate files created in this pass are:

```text
evaluation/ground-truth-candidates/writing-16127.candidate.json
evaluation/ground-truth-candidates/student-191379.candidate.json
evaluation/ground-truth-candidates/student-92398.candidate.json
```
