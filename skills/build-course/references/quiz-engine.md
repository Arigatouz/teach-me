# Quiz authoring guide

The engine ships inside `assets/template.html` — do not rewrite it. Author two things: the `{{QUIZ_QUESTIONS}}` array and the `{{QUICK_CHECKS}}` object. The engine handles rendering, shuffling (question order and MC option order re-shuffle on every attempt), scoring, per-topic evaluation, study recommendations, and best-score persistence.

## Final quiz questions — `{{QUIZ_QUESTIONS}}`

Replace the placeholder with comma-separated objects:

```js
  { type: 'mc', topic: 'm1', topicName: 'Module 1 name',
    q: 'Question text?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    answer: 1,                       // index into options AS AUTHORED (engine remaps on shuffle)
    explain: 'Why B is correct.' },
  { type: 'tf', topic: 'm2', topicName: 'Module 2 name',
    q: 'Statement that is true or false.',
    answer: true,
    explain: 'Why.' },
  { type: 'fill', topic: 'm2', topicName: 'Module 2 name',
    q: 'The ____ keyword defines a function in Python.',
    answer: ['def', 'the def keyword'],   // list ALL reasonable phrasings
    explain: 'def introduces a function definition.' }
```

Rules:

- ≥2 questions per module; all three types represented across the quiz
- `topic` must equal a module section id (`m1`, `m2`, …) — the verifier enforces this
- `explain` is mandatory; it is shown after submission for right AND wrong answers
- MC: 3–5 options, no "all of the above" (options get shuffled)
- Fill-in: matching is case/whitespace/punctuation-insensitive and strips a leading "the/a/an", but otherwise exact — so list every acceptable phrasing in the `answer` array

## Quick checks — `{{QUICK_CHECKS}}`

One or two per module, placed in the lesson right after the concept they test. Two parts that must match:

In the module HTML:

```html
<div class="quickcheck" id="qc1"></div>
```

In the `{{QUICK_CHECKS}}` placeholder (object entries, comma-separated):

```js
  qc1: { type: 'mc', q: 'Which of these compounds?',
    options: ['Interest on principal only', 'Interest on principal and past interest'],
    answer: 1, explain: 'Compounding reinvests past interest.' },
  qc2: { type: 'tf', q: 'Doubling time falls as the rate rises.',
    answer: true, explain: 'Rule of 72: years = 72 / rate.' }
```

Quick checks give instant feedback on click, are not scored, and don't affect quiz results — they exist for retrieval practice while reading. Types: `mc` (2–4 options) or `tf` only. The verifier fails the build if a `quickcheck` div has no matching entry or vice versa.

## Evaluation behavior (built in)

- Verdict bands: ≥90 Excellent · ≥70 Good · ≥50 Getting there · <50 Needs review
- Per-topic breakdown with "review [module]" links for any topic below 100%
- Best score persists in localStorage and shows above the quiz
- Retake button re-renders with a fresh shuffle

## Verification

Do not hand-run smoke tests — `scripts/verify.js` executes the quiz core (schema, scoring math, shuffle correctness, quick-check wiring) as part of the mandatory Step 5 check.
