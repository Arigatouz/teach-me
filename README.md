# Teach Me

Turn any topic into a complete, beautifully designed HTML course.

Say something like:

- "Teach me Python decorators"
- "Build me a course on personal finance for beginners"
- "Create a curriculum about machine learning, deep level"

Claude will ask a couple of quick questions (level, course size), research the topic on the web when it's fast-changing, design a curriculum, and produce a single self-contained HTML file you can open in any browser — no internet needed after it's built.

## What every course includes

- A course home page with learning objectives and a module overview
- Sidebar navigation with per-module progress tracking
- Lesson content written for your chosen level, with examples and analogies
- Concept visualizations: diagrams, comparison panels, and annotated figures
- Interactive widgets where the topic benefits (sliders, toggles, step-through demos)
- A final quiz (multiple choice, true/false, fill-in) that is auto-scored
- An evaluation screen with your score, per-topic breakdown, and study recommendations

## Skills

| Skill | What it does |
|-------|--------------|
| `build-course` | The full workflow: clarify → verified research → curriculum → HTML build → verify |

## Agents (research pipeline)

When a topic needs research, the skill prefers a deep-research skill if one is installed; otherwise it runs a four-agent pipeline:

| Agent | Model | Strategy |
|-------|-------|----------|
| `course-researcher-docs` | Sonnet | Official documentation only — definitions, APIs, versions |
| `course-researcher-pedagogy` | Sonnet | Teaching craft — tutorials, analogies, misconceptions, learning order |
| `course-researcher-ecosystem` | Sonnet | Currency — latest releases, deprecations, real-world FAQs |
| `course-verifier` | Opus | Checks technical claims against official docs (docs MCP first, official-site fetch otherwise); only verified facts reach the course |

Researchers run on Sonnet (fast, cheap, excellent at search-and-extract; three run in parallel). The verifier runs on Opus because it is the quality gate — its judgment is the last line between a wrong claim and the learner. The pipeline scales with course size: quick lessons use lightweight inline research instead of agents.

Courses built from research embed a sources list and the verified version ("covers Angular 20.1, verified July 2026").

## Notes

- Courses are fully self-contained (inline CSS/JS/SVG). Chart.js is used from a CDN only when a real chart adds value; everything else works offline.
- Every generated course is verified before delivery: the JavaScript is syntax-checked and the quiz scoring logic is executed in a test run.
