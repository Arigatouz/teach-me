# Source folder, template and design system

`scripts/build.js` turns a course source folder into one self-contained HTML file using `assets/template.html`. This doc covers the folder contract, what the shipped engine already does, and the component classes authored content can use. Never edit the template's CSS or engine: verify.js fails any course whose machinery differs from the shipped template.

## The source folder

```
<topic-slug>-course/
  course.json        title, shortTitle, lang (+ optional dir, ui)
  home.html          inner HTML of the home section
  m1.html … mN.html  one module each, numbered without gaps
  quiz.js            final-quiz question objects (references/quiz-engine.md)
  quickchecks.js     quick-check entries (references/quiz-engine.md)
  research/          research reports when the pipeline ran — the build ignores it
```

`course.json`:

```json
{ "title": "Python Decorators, Properly", "shortTitle": "Decorators", "lang": "en" }
```

- `title` — page title, and the key under which learner progress is saved: keep it distinct per course
- `shortTitle` — the sidebar badge (defaults to `title`)
- `lang` — language code (`en`, `ar`, `fr`, …). Right-to-left languages get `dir="rtl"` automatically; set `"dir"` only to override
- `ui` — translated interface strings for non-English courses (`references/localization.md`)

What build.js does with the rest — so you don't:

- wraps each `mN.html` in `<section id="mN" class="module">`, appends its "Mark module complete" button, and makes its sidebar link from the module's `<h2>`; write only the module's inner content
- moves every `<script>` in a module file to the end of the page, in order, so widget scripts run after all markup exists; loads Chart.js before them when any of them calls `new Chart(`
- inserts `quiz.js` and `quickchecks.js` into the engine (bare entries, or a whole `[…]` / `{…}` literal)
- writes `<topic-slug>-course.html` beside the folder and runs verify.js on it

## Palette

| Variable | Value | Use |
|---|---|---|
| `--ink` / `--ink-soft` / `--ink-faint` | #1a1a2e / #55556d / #6b6b82 | text hierarchy (all ≥ 4.5:1 on every surface) |
| `--paper` / `--card` / `--line` | #fafaf7 / #ffffff / #e4e4ea | surfaces, hairlines |
| `--accent` / `--accent-soft` | #4f46e5 / #eef2ff | links, buttons, active nav, tints |
| `--good`, `--warn`, `--bad` (+ `-bg`) | green / amber / red | semantic callouts, quiz states |

Typography: body 16.5px/1.7 system-ui; h1 30 / h2 22 / h3 18, weight 600. Use these hex values directly inside SVG diagrams (SVG presentation attributes can't read CSS variables reliably): node fill `#eef2ff`, stroke `#4f46e5`, text `#1a1a2e`, good `#16803c`/`#ecfdf3`, bad `#b91c1c`/`#fef2f2`.

## Component classes for authored content

- `.card` — white bordered card, 24px padding
- `.callout` — accent-tinted box with an edge rule, for "Why this matters"; variants `.good` (key takeaways), `.warn` (misconceptions and pitfalls), `.bad`
- `.pill` — rounded label for module number + estimated time
- `.code` — dark `<pre>` block for code samples; inline `<code>` gets a light chip style. Both stay left-to-right in RTL courses
- `.viz` — `<figure>` wrapper for diagrams, with `figcaption` styling
- `.widget` — card variant for interactive widgets; styles `input[type=range]`, `.widget-read` (readout line), `.widget-controls` (button row) and `.widget-label` (flexible centred label inside that row)
- `.quickcheck` — empty div the engine fills with a quick-check question
- `.btn` / `.btn.ghost` — filled and outlined buttons
- `.lede` — large intro paragraph on the home section

## What the shipped engine already does

- Sidebar navigation with active-section highlighting; progress bar driven by the mark-done buttons
- Progress and best quiz score saved in localStorage, keyed by course title (degrades gracefully when storage is unavailable)
- Final quiz: shuffles questions and options on every attempt, warns once about unanswered questions, grades, then locks the attempt (answers are revealed) until the learner retakes; per-module evaluation with links back to weak modules; focus moves to the result
- Quick checks with instant feedback announced to screen readers
- Each part starts independently, so one malformed entry cannot blank the rest of the page
- Interface strings from `course.json` `ui`; RTL layout through logical CSS properties
- Responsive layout (sidebar collapses under 720px), visible keyboard focus, reduced-motion support, print styles

## Content contract (verify.js-enforced)

- Sections `home`, `m1`…`mN`, `quiz`; every module has an `<h2>`, a sidebar link, exactly one mark-done button, at least one `.widget` and at least one `.quickcheck` — build.js provides the section, button and link
- Element ids are unique across the page (ids that only appear inside escaped code samples don't count); prefix widget ids per widget (`w1Rate`, `w2Prev`, …) and SVG ids per module (`m1Arrow`)
- Every `getElementById('…')` in a widget script names an element that exists, or one the script creates
- Nothing loads from the network except Chart.js from cdnjs; plain links (`<a href>`) are fine
- No `{{…}}` placeholder text outside `<pre>`/`<code>` (template syntax inside code samples is fine)
