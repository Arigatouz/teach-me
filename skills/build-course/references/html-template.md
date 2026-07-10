# Design system and template reference

The authoritative skeleton is `assets/template.html` — copy it and fill placeholders (see SKILL.md Step 4). Never rebuild the CSS or engine from scratch. This doc explains what the template provides so authored content uses it correctly.

## Palette

| Variable | Value | Use |
|---|---|---|
| `--ink` / `--ink-soft` / `--ink-faint` | #1a1a2e / #55556d / #8a8aa3 | text hierarchy |
| `--paper` / `--card` / `--line` | #fafaf7 / #ffffff / #e4e4ea | surfaces, hairlines |
| `--accent` / `--accent-soft` | #4f46e5 / #eef2ff | links, buttons, active nav, tints |
| `--good`, `--warn`, `--bad` (+ `-bg`) | green / amber / red | semantic callouts, quiz states |

Typography: body 16.5px/1.7 system-ui; h1 30 / h2 22 / h3 18, weight 600. Use these SVG hex values directly inside diagrams (SVG can't read CSS variables reliably across contexts): node fill `#eef2ff`, stroke `#4f46e5`, text `#1a1a2e`, good `#16803c`/`#ecfdf3`, bad `#b91c1c`/`#fef2f2`.

## Component classes available in authored content

- `.card` — white bordered card, 24px padding
- `.callout` — accent-tinted box with left border, for "Why this matters"; variants `.good` (key takeaways), `.warn` (pitfalls), `.bad`
- `.pill` — rounded label for module number + estimated time
- `.code` — dark `<pre>` block for code samples
- `.viz` — figure wrapper for diagrams/widgets, with `figcaption` styling
- `.widget` — card variant for interactive widgets; styles `input[type=range]`, `.widget-read` (readout line), `.widget-controls` (button row)
- `.quickcheck` — empty div the engine fills with a quick-check question
- `.btn` / `.btn.ghost` — filled and outlined buttons
- `.lede` — large intro paragraph on the home section

## What the shipped engine already does

- Sidebar nav with active-section highlighting (IntersectionObserver)
- Progress bar counting `section.module` elements with `.mark-done` buttons
- Progress, completed modules, and quiz best score persisted in localStorage (guarded — degrades gracefully if storage is unavailable), keyed by course title
- Full quiz + quick-check rendering and scoring (see quiz-engine.md)
- Responsive layout (sidebar collapses under 720px) and print styles

## Content contract (verifier-enforced)

- Section ids: `home`, `m1`…`mN`, `quiz`; nav `data-nav` matches section ids exactly
- Every module: `class="module"` + exactly one `.mark-done` button with matching `data-module`
- Unique element ids everywhere; widget ids prefixed per widget (`w1Rate`, `w2Prev`, …)
- Widget `<script>` blocks go in `{{WIDGET_SCRIPTS}}` at the end of body, each in its own IIFE
- Give each course a distinct `<title>` — it is the localStorage key
