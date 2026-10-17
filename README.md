# Teach Me

Turn any topic into a complete, beautifully designed HTML course — in any language.

## Install

In Claude Code:

```
/plugin install teach-me --marketplace Arigatouz/teach-me
```

On Claude Code versions before 2.1.275, add the marketplace first:

```
/plugin marketplace add Arigatouz/teach-me
/plugin install teach-me@teach-me-marketplace
```

## Use

Say something like:

- "Teach me Python decorators"
- "Build me a course on personal finance for beginners"
- "Create a curriculum about machine learning, deep level"
- "Teach me Git basics, in Arabic"

Claude will ask a couple of quick questions (level, course size, how to research), research the topic on the web when it's fast-changing, design a curriculum, and produce a single self-contained HTML file you can open in any browser — no internet needed after it's built. The course's source files stay next to it, so you can come back later with "add a module on X" or "make the quiz harder" and get a rebuilt, re-verified course.

## What every course includes

- A course home page with learning objectives and a module overview
- Sidebar navigation with per-module progress tracking
- Lesson content written for your chosen level, with worked examples, analogies, and the common misconceptions called out
- Concept visualizations: diagrams, comparison panels, and annotated figures
- An interactive drawing in every module (sliders, toggles, step-through demos)
- Quick checks inside each module for instant retrieval practice
- A final quiz (multiple choice, true/false, fill-in) that is auto-scored, warns about unanswered questions, and locks once graded so the score means something
- An evaluation screen with your score, per-module breakdown, and study recommendations
- Any language: the interface is translated, and right-to-left languages such as Arabic and Hebrew get a mirrored layout
- Accessibility: keyboard focus styles, screen-reader-announced feedback, WCAG AA contrast

## Skills

| Skill | What it does |
|-------|--------------|
| `build-course` | The full workflow: clarify → verified research → curriculum → source files → build → verify |

## Agents (research pipeline)

When a topic needs research, the skill always asks how to research it — a deep-research skill if one is installed, or its own four-agent pipeline:

| Agent | Model | Strategy |
|-------|-------|----------|
| `course-researcher-docs` | Sonnet | Official documentation only — definitions, APIs, versions |
| `course-researcher-pedagogy` | Sonnet | Teaching craft — tutorials, analogies, misconceptions, learning order |
| `course-researcher-ecosystem` | Sonnet | Currency — latest releases, deprecations, real-world FAQs |
| `course-verifier` | Opus | Checks technical claims against official docs (docs MCP first, official-site fetch otherwise); only verified facts reach the course |

Researchers run on Sonnet (fast, cheap, excellent at search-and-extract; three run in parallel). The verifier runs on Opus because it is the quality gate — its judgment is the last line between a wrong claim and the learner. The pipeline scales with course size: quick lessons use lightweight inline research instead of agents.

Courses built from research embed a sources list and the verified version ("covers Angular 20.1, verified July 2026").

## How a course is built

1. Claude writes small source files into `<topic>-course/`: `course.json`, `home.html`, one file per module, `quiz.js` and `quickchecks.js`. Long curricula never need one giant write.
2. `skills/build-course/scripts/build.js` assembles them into the shipped, tested template and writes `<topic>-course.html`.
3. `skills/build-course/scripts/verify.js` checks the result before it is delivered: the engine and CSS are untouched, every script parses, every module has a widget, a quick check and a sidebar link, the quiz schema and coverage are complete, quiz text is HTML-safe, nothing loads from the network except Chart.js, and the scoring and shuffle math holds. When Playwright is installed, it also opens the course in headless Chromium and clicks through every widget.

## Notes

- Courses are fully self-contained (inline CSS/JS/SVG). Chart.js is used from a CDN only when a real chart adds value, with an offline fallback; everything else works offline.
- Learner progress and the best quiz score are saved in the browser (localStorage).

## Development

```bash
node tests/run.js       # build + verifier regression tests, no dependencies
node tests/browser.js   # engine tests in headless Chromium (needs Playwright)
claude plugin validate .
```

CI runs both test suites on every push to `master` and on every pull request. See [CHANGELOG.md](CHANGELOG.md) for what changed in each version.
