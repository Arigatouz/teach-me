# Quiz authoring guide

The engine ships inside `assets/template.html` — do not rewrite it. Author two files in the course folder: `quiz.js` (the final quiz) and `quickchecks.js`. The engine handles rendering, shuffling (question order and MC option order re-shuffle on every attempt), a one-time warning about unanswered questions, grading, locking the graded attempt until a retake, per-module evaluation, study recommendations, and best-score persistence.

## Strings are HTML

Question text, options, `explain` and `topicName` are inserted as HTML, so `<code>`, `<em>` and `<strong>` work. A tag *name* must therefore be escaped: write `'<code>&lt;input&gt;</code>'`, never `'<input>'`, which renders as a live, empty element. verify.js fails any raw tag outside this formatting set — `code em strong b i u s sub sup kbd mark small var samp abbr q bdi bdo span br` — and any unclosed one.

Fill-in `answer` strings are the exception: they are plain text (what the learner types) and are displayed escaped, so write `'<input>'` there as is.

## Final quiz — `quiz.js`

Comma-separated question objects:

```js
{ type: 'mc', topic: 'm1', topicName: 'Module 1 name',
  q: 'Question text?',
  options: ['Option A', 'Option B', 'Option C', 'Option D'],
  answer: 1,                       // index into options AS AUTHORED (engine remaps on shuffle)
  explain: 'Why B is correct, and why the tempting A is not.' },
{ type: 'tf', topic: 'm2', topicName: 'Module 2 name',
  q: 'Statement that is true or false.',
  answer: true,                    // a boolean, not the string 'true'
  explain: 'Why.' },
{ type: 'fill', topic: 'm2', topicName: 'Module 2 name',
  q: 'The ____ keyword defines a function in Python.',
  answer: ['def', 'the def keyword'],   // list ALL reasonable phrasings
  explain: '<code>def</code> introduces a function definition.' }
```

Rules (verify.js enforces each):

- ≥2 questions per module; all three types represented across the quiz
- `topic` must equal a module section id (`m1`, `m2`, …); use the same `topicName` for every question of a module
- `explain` is mandatory; it is shown after grading for right AND wrong answers
- MC: 3–5 distinct options, no "all/none of the above" (options get shuffled); `answer` is an integer index
- Fill-in: matching ignores case, extra whitespace, the punctuation `.,;:!?'"`()` and a leading "the/a/an", but is otherwise exact — so list every acceptable phrasing, and no answer may be punctuation only

## Writing good questions

The quiz is what tells a learner whether they understood, so it must measure understanding — not reading speed or luck.

- **Test use, not recall.** At least half the questions should make the learner apply an idea to a new case: predict an output, pick the right tool for a scenario, spot the bug, explain an observation. Recall-only questions ("What year…", "Which term means…") are the minority.
- **One unambiguous answer.** An expert should agree instantly. No trick wording, no double negatives; avoid "Which is NOT…" stems — if one is unavoidable, bold the NOT.
- **Distractors are real mistakes.** Every wrong option should be something a learner who missed the point would plausibly choose — take them from the misconception map and top learner questions. A distractor nobody would pick is a wasted option.
- **No give-aways.** Options parallel in grammar and similar in length; the correct one is not the longest, the most hedged, or the only one that repeats the stem's wording.
- **True/false:** state one idea, unambiguously true or false. "Always"/"never" must not be a tell — use them in true statements too.
- **Fill-in:** ask for one term with a single unambiguous answer; avoid answers that are long phrases.
- **`explain` teaches.** Say why the right answer is right and why the most tempting wrong answer is wrong, in one or two sentences.
- **Coverage follows weight.** More questions for the modules that carry the course objectives; every objective is tested at least once.

## Quick checks — `quickchecks.js`

One or two per module, placed in the lesson right after the concept they test. Two parts that must match.

In the module file:

```html
<div class="quickcheck" id="qc1"></div>
```

In `quickchecks.js` (comma-separated entries keyed by div id):

```js
qc1: { type: 'mc', q: 'Which of these compounds?',
  options: ['Interest on principal only', 'Interest on principal and past interest'],
  answer: 1, explain: 'Compounding reinvests past interest.' },
qc2: { type: 'tf', q: 'Doubling time falls as the rate rises.',
  answer: true, explain: 'Rule of 72: years ≈ 72 / rate.' }
```

Quick checks give instant feedback on click, are not scored, and don't affect quiz results — they exist for retrieval practice while reading, so ask about the idea just taught, at the level of the final quiz. Types: `mc` (2–4 options) or `tf` only — there is no fill-in quick check. verify.js fails the build if a `quickcheck` div has no matching entry or vice versa.

## Evaluation behavior (built in)

- Verdict bands: ≥90 Excellent · ≥70 Good · ≥50 Getting there · <50 Needs review
- Per-module breakdown with "review [module]" links for any module below 100%
- After grading, each question shows the correct answer and its explanation; the attempt locks until "Retake", which re-renders with a fresh shuffle
- Best score persists in localStorage and shows above the quiz

## Verification

Do not hand-run smoke tests — build.js runs verify.js, which executes the quiz core (schema, HTML safety, coverage, scoring math, shuffle correctness, quick-check wiring).
