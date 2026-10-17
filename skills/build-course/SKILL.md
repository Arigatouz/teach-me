---
name: build-course
description: Build a complete interactive HTML course on any topic, in any language — curriculum, lessons, interactive drawings per module, mid-module quick checks, and an auto-scored final quiz with evaluation. Use whenever the user wants to learn or be taught something substantial, even if they never say "course" — "teach me X", "help me learn X", "explain X properly", "I want to understand X", "build a course/curriculum/lesson on X", "make study material for X", or any request for educational content as HTML. Also use to revise or extend a course this skill built (add a module, go deeper, make the quiz harder). Do not use for a quick factual answer with no course requested, for reviewing course files this skill did not build, or for non-HTML educational content like a blog post or slide deck.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/build.js *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/verify.js *)
---

# Build Course

Produce a single self-contained HTML file that teaches the requested topic end-to-end: curriculum → lessons → visualizations → quick checks → final quiz → evaluation. You write the content as small source files; `scripts/build.js` assembles them into the shipped, tested template and verifies the result. Never rebuild or hand-edit the machinery. (`${CLAUDE_SKILL_DIR}` below is this skill's directory.)

## Workflow

### Step 1 — Clarify (only what's missing)

Determine from the request; ask via AskUserQuestion only for what's genuinely unknown:

- **Topic and scope** — what exactly to teach
- **Learner level** — beginner / intermediate / advanced
- **Course size** — quick lesson (1 module, ~30 min) / standard (4–8 modules) / deep curriculum (10+ modules). Default: standard.
- **Language** — match the user's language unless told otherwise. Non-English courses also translate the interface strings (`references/localization.md`); right-to-left languages are laid out RTL automatically.
- **Research approach** — whenever the course needs the full pipeline (standard or deep course, see `references/research-pipeline.md`): always ask, in this same round, how to research it — the plugin's research swarm (default) or the user's deep-research skill if one is installed. Never skip this question and never decide it yourself.

One round of questions maximum, and AskUserQuestion caps at 4 questions per round. If more than 4 of the above are genuinely unknown, ask topic/scope and research approach first — they change what gets built — and default the rest (learner level → intermediate, course size → standard, language → the user's message language) instead of exceeding the cap. Sensible defaults beat interrogation.

### Step 2 — Research (verified pipeline)

Read `references/research-pipeline.md` and follow it. In short: if the topic is fast-changing, has official documentation, or the user wants a deep curriculum, research is mandatory BEFORE writing content. Scale it to course size — quick lessons get lightweight inline research; standard and deep courses get the full pipeline, using whichever engine was chosen in Step 1 (always asked, never decided by you). If the swarm was chosen or defaulted to, spawn the plugin's three researcher agents in parallel (`course-researcher-docs`, `course-researcher-pedagogy`, `course-researcher-ecosystem` — each has a deliberately different search strategy), then the `course-verifier` agent, which checks technical claims against the official docs (docs MCP first, official-site fetch otherwise). Doing this research or verification yourself instead of spawning the agents is not a substitute, no matter how confident you are in a direct tool call — run the agents. Write the course only from the verifier's output, and put the sources list at the end of `home.html`. Skip research only for stable, timeless topics at quick-lesson depth. Never invent statistics, version numbers, or dates — verify or omit.

### Step 3 — Design the curriculum

Read `references/writing-lessons.md`, then draft the curriculum and show it to the user in chat. When the research pipeline ran, build the plan from `research/verified.md` — its teaching guidance dictates module order, and its course facts bound what can be taught:

- 3–7 learning objectives ("After this course you can…")
- Module list: title, one-line summary, estimated time
- For EACH module: which concept gets its interactive drawing and which pattern (slider, step-through or toggle), and the misconception it will correct
- Quiz plan: 2 final-quiz questions per module minimum, mixed types, plus 1–2 quick checks inside each module

Proceed immediately after showing the plan unless the user asked to review first.

### Step 4 — Write the source files

Create the folder `<topic-slug>-course/` in the user's working directory (or the outputs folder your environment designates) and write these files one at a time — never the whole course in a single write:

| File | Content |
|---|---|
| `course.json` | `{"title": "…", "shortTitle": "…", "lang": "en"}` plus `"ui": {…}` for non-English courses — see `references/html-template.md` |
| `home.html` | h1, `.lede`, objectives card, module overview card, then the sources `<details>` when research ran |
| `m1.html` … `mN.html` | One module each, structured as below; its widget `<script>` goes at the end of the file |
| `quiz.js` | Final-quiz question objects — format and question-writing rules in `references/quiz-engine.md` |
| `quickchecks.js` | Quick-check entries keyed by their div id — `references/quiz-engine.md` |

Each module file contains, in order (component classes in `references/html-template.md`):

1. `.pill` with module number + estimated time, then the `<h2>` title — it becomes the sidebar link
2. `.callout` — "Why this matters" hook (2–3 sentences)
3. Lesson content: short paragraphs, a worked example, one analogy per abstract concept; code in `<pre class="code">`
4. AT LEAST ONE interactive drawing in a `<div class="widget card">` (`references/visualizations.md`): a slider when the concept has a variable parameter, a step-through for sequences/algorithms, a toggle for comparing cases. Static SVG diagrams and Chart.js charts supplement it, never replace it — verify.js fails any module without one.
5. 1–2 `<div class="quickcheck" id="qcN"></div>` placed right after the concept they test
6. `.callout.warn` — the misconception learners most often hold here, and its correction
7. `.callout.good` with 3 key-takeaway bullets

build.js wraps each module in its `<section>`, adds the "Mark module complete" button and the sidebar link, moves widget scripts to the end of the page, and loads Chart.js first when a widget uses it. The engine already provides progress tracking and persistence, quiz shuffling and grading, per-topic evaluation with study recommendations, and accessible feedback.

### Step 5 — Build and verify (mandatory, one command)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/build.js <path-to>/<topic-slug>-course
```

It writes `<topic-slug>-course.html` beside the folder, then verifies it: no leftover placeholders, engine and CSS untouched, every script parses, structure and navigation complete, each module with a widget, quick check and mark-done button, offline safety, quiz schema and coverage, HTML-safe quiz strings, scoring math, shuffle correctness — plus, when Playwright is installed, a real-browser run that clicks through every widget. It must print `ALL CHECKS PASSED`. If it fails, fix the source files and rerun. Never deliver a file that hasn't passed, and never patch the built HTML — the next build overwrites it.

### Step 6 — Deliver

Present the HTML file with a one-paragraph summary: module count, widget count, quiz size, and the verified version when research ran. Mention the source folder, which is what follow-ups edit. Offer follow-ups: more depth on a module, a harder quiz, another language, or a printable PDF version.

## Revising a course

For follow-ups on a course this skill built, edit the files in its source folder and rerun the Step 5 command — the build re-verifies everything. Keep module files numbered without gaps (renumber when inserting a module) and give every new module its widget, quick check and quiz questions. If the source folder is gone, recreate it from the built HTML (each module section's contents into `mN.html`, the question objects into `quiz.js`, …) and rebuild.

## Hard rules

- Single file. All CSS/JS inline, diagrams as inline SVG. No frameworks, no external images.
- Only permitted external resource: Chart.js from cdnjs.cloudflare.com, with an offline fallback (build.js adds the loader).
- Works from `file://` — no fetch(), no ES modules.
- Every widget in its own IIFE with a unique id prefix (`w1`, `w2`, …).
- Accessible: semantic headings, `aria-label` on controls, contrast ≥ 4.5:1 (the engine handles quiz semantics, focus and announced feedback).
- Quiz: 2+ questions per module, all three types represented, every question has `explain`. Fill-in answers list all reasonable phrasings.
- The research engine (Step 1) is always asked, never silently decided — and whatever gets chosen is executed exactly as documented, not swapped for your own direct research.
