---
name: build-course
description: Build a complete interactive HTML course on any topic — curriculum, lessons, interactive drawings per module, mid-module quick checks, and an auto-scored final quiz with evaluation. Use whenever the user wants to learn or be taught something substantial, even if they never say "course" — "teach me X", "help me learn X", "explain X properly", "I want to understand X", "build a course/curriculum/lesson on X", "make study material for X", or any request for educational content as HTML. Do not use for a quick factual answer with no course requested, for reviewing or editing an existing course file, or for non-HTML educational content like a blog post or slide deck — use a content or review skill for those.
---

# Build Course

Produce a single self-contained HTML file that teaches the requested topic end-to-end: curriculum → lessons → visualizations → quick checks → final quiz → evaluation. The file skeleton and engine are shipped as tested assets — fill in content, never rebuild the machinery.

## Workflow

### Step 1 — Clarify (only what's missing)

Determine from the request; ask via AskUserQuestion only for what's genuinely unknown:

- **Topic and scope** — what exactly to teach
- **Learner level** — beginner / intermediate / advanced
- **Course size** — quick lesson (1 module, ~30 min) / standard (4–8 modules) / deep curriculum (10+ modules). Default: standard.
- **Language** — match the user's language unless told otherwise
- **Research approach** — whenever the course needs the full pipeline (standard or deep course, see `references/research-pipeline.md`): always ask, in this same round, how to research it — the plugin's research swarm (default) or the user's deep-research skill if one is installed. Never skip this question and never decide it yourself.

One round of questions maximum, and AskUserQuestion caps at 4 questions per round. If more than 4 of the above are genuinely unknown, ask topic/scope and research approach first — they change what gets built — and default the rest (learner level → intermediate, course size → standard, language → the user's message language) instead of exceeding the cap. Sensible defaults beat interrogation.

### Step 2 — Research (verified pipeline)

Read `references/research-pipeline.md` and follow it. In short: if the topic is fast-changing, has official documentation, or the user wants a deep curriculum, research is mandatory BEFORE writing content. Scale it to course size — quick lessons get lightweight inline research; standard and deep courses get the full pipeline, using whichever engine was chosen in Step 1 (always asked, never decided by you). If the swarm was chosen or defaulted to, spawn the plugin's three researcher agents in parallel (`course-researcher-docs`, `course-researcher-pedagogy`, `course-researcher-ecosystem` — each has a deliberately different search strategy), then the `course-verifier` agent, which checks technical claims against the official docs (docs MCP first, official-site fetch otherwise). Doing this research or verification yourself instead of spawning the agents is not a substitute, no matter how confident you are in a direct tool call — run the agents. Write the course only from the verifier's output, and embed the sources list in the course home section. Skip research only for stable, timeless topics at quick-lesson depth. Never invent statistics, version numbers, or dates — verify or omit.

### Step 3 — Design the curriculum

Before writing HTML, draft the curriculum and show it to the user in chat. When the research pipeline ran, build the plan from `research/verified.md` — its teaching guidance dictates module order, and its course facts bound what can be taught:

- 3–7 learning objectives ("After this course you can…")
- Module list: title, one-line summary, estimated time
- For EACH module: which concept gets its interactive drawing, and which pattern (slider or step-through)
- Quiz plan: 2 final-quiz questions per module minimum, mixed types, plus 1–2 quick checks inside each module

Proceed immediately after showing the plan unless the user asked to review first.

### Step 4 — Build from the template

Copy `assets/template.html` (in this skill's directory) to the outputs folder as `<topic-slug>-course.html`. Fill in every `{{PLACEHOLDER}}`:

| Placeholder | Content |
|---|---|
| `{{LANG}}` | Page language code (`en`, `ar`, …) |
| `{{COURSE_TITLE}}` / `{{SHORT_TITLE}}` | Full and sidebar titles |
| `{{NAV_LINKS}}` | One `<a href="#mN" class="nav-link" data-nav="mN"><span class="nav-num">N</span> Title</a>` per module |
| `{{HOME_SECTION}}` | h1, `.lede`, objectives card, module overview card |
| `{{MODULE_SECTIONS}}` | One `<section id="mN" class="module">` per module (structure below) |
| `{{QUIZ_COUNT_LINE}}` | e.g. "10 questions · covers all modules · you can retake it" |
| `{{QUIZ_QUESTIONS}}` | Question objects — format in `references/quiz-engine.md` |
| `{{QUICK_CHECKS}}` | Quick-check objects keyed by placeholder div id — format in `references/quiz-engine.md` |
| `{{WIDGET_SCRIPTS}}` | `<script>` blocks for interactive widgets (or empty) |

Do not modify the shipped CSS or engine scripts — only replace placeholders and add widget scripts. `references/html-template.md` documents the design system and available component classes.

Each module section contains, in order:

1. `.pill` with module number + estimated time, then h2 title
2. `.callout` — "Why this matters" hook (2–3 sentences)
3. Lesson content: short paragraphs, concrete examples, one analogy per abstract concept; code in `<pre class="code">`
4. EXACTLY ONE OR MORE interactive drawings — this is mandatory per module, not optional (`references/visualizations.md`): a slider widget when the concept has a variable parameter, a step-through widget for sequences/algorithms, or a toggle/click-to-explore widget otherwise. Static SVG diagrams and Chart.js charts are welcome additions, but they supplement the interactive drawing, never replace it. The verifier fails any module without one.
5. 1–2 `<div class="quickcheck" id="qcN"></div>` placed right after the concept they test
6. `.callout.good` with 3 key-takeaway bullets
7. `<button class="btn ghost mark-done" data-module="mN">Mark module complete</button>`

The engine already provides: sidebar progress bar, progress + best-score persistence via localStorage, quiz shuffling on every attempt, per-topic evaluation with study recommendations.

### Step 5 — Verify (mandatory, one command)

```bash
node <skill-dir>/scripts/verify.js <path-to-course.html>
```

It checks: no leftover placeholders, all scripts parse, nav links point at real sections, balanced/unique structure, offline safety, quiz schema, scoring math, shuffle correctness, quick-check wiring. Must print `ALL CHECKS PASSED`. If it fails, fix the reported issues and re-run. Never deliver a file that hasn't passed.

### Step 6 — Deliver

Present the file with a one-paragraph summary: module count, visual count, quiz size. Offer follow-ups: more depth on a module, a harder quiz, or a printable PDF version.

## Hard rules

- Single file. All CSS/JS inline, diagrams as inline SVG. No frameworks, no build step, no external images.
- Only permitted external resource: Chart.js from cdnjs.cloudflare.com, wrapped in an offline fallback.
- Works from `file://` — no fetch(), no ES modules.
- Every widget in its own IIFE with unique id prefix (`w1`, `w2`, …).
- Accessible: semantic headings, radio groups inside `<fieldset>`/`<legend>` (the engine does this), `aria-label` on controls, contrast ≥ 4.5:1.
- Quiz answers: 2+ per module, all three types represented, every question has `explain`. Fill-in answers list all reasonable phrasings.
- The research engine (Step 1) is always asked, never silently decided — and whatever gets chosen is executed exactly as documented, not swapped for your own direct research.
