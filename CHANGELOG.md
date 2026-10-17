# Changelog

## 0.6.0

### Fixed

- The final quiz could be gamed: answers stayed editable after grading, so resubmitting with the revealed answers scored 100% and saved it as the best score. A graded attempt now locks until "Retake".
- Graded multiple-choice and true/false questions never showed their red/green border (a CSS specificity bug); only fill-in questions did.
- One malformed quick check (for example `type: 'fill'`) threw during start-up and blanked the entire final quiz — while verify.js reported `ALL CHECKS PASSED`.
- Quiz text naming a tag (`'<input>'`) rendered a live, empty element instead of the text. Fill-in answers are now displayed escaped, and verify.js rejects raw tags in quiz strings.
- Following the Chart.js instructions in `visualizations.md` produced a chart that could never render: its script ran before Chart.js had loaded.
- `--ink-faint` (captions, footer, progress label) failed the skill's own 4.5:1 contrast rule at 3.2:1; it is now at least 4.6:1 on every surface.
- verify.js false positives: escaped code samples that repeat an `id` failed as duplicate ids; Angular/Vue/Jinja `{{ }}` in code samples failed as unreplaced placeholders; required Sources links and SVG `xmlns` raised offline warnings.
- Progress could exceed 100% after a module was removed from a course.
- Documentation contradictions: widget examples broke the id-prefix rule and relied on CSS the template didn't ship; "EXACTLY ONE OR MORE" drawings; "the verifier" meant both verify.js and the `course-verifier` agent.

### Added

- `scripts/build.js`: courses are written as small source files (one per module) and assembled into the template. Long curricula never need one giant write, the engine can't drift, sidebar links and mark-done buttons are generated, Chart.js is loaded in the right place, and the build runs verification.
- Courses in any language: `lang` sets `dir="rtl"` for right-to-left languages (logical CSS properties throughout; code and SVG stay left-to-right), and every interface string can be translated through `course.json` `ui`.
- Quiz experience: a one-time warning about unanswered questions, correct and chosen-wrong options highlighted after grading, focus moved to the result, quick-check feedback in a live region, a highlight on the selected option, visible keyboard focus, reduced-motion support.
- verify.js now enforces what the docs already promised (a mark-done button and sidebar link per module, ≥2 questions per module, all three question types) and adds: a strict quick-check schema, HTML-safe quiz strings, no network resources but Chart.js, Chart.js load order and offline guard, widget ids that exist, engine/CSS integrity against the template, and translation coverage. When Playwright is installed it also opens the course in headless Chromium and clicks through every widget.
- `references/writing-lessons.md` (module arc, level calibration, misconceptions, style) and question-writing rules in `references/quiz-engine.md`; `references/localization.md`.
- The skill can revise courses it built (edit the source folder, rebuild), and `allowed-tools` pre-approves the build and verify scripts.
- Regression tests (`tests/run.js`, `tests/browser.js`), including tests that build a course from the examples in the reference docs, and a GitHub Actions workflow.

### Changed

- Research reports live in the course's source folder (`<topic>-course/research/`), so two courses built side by side keep separate reports.
- The `{{QUIZ_COUNT_LINE}}` placeholder is gone; the engine writes the quiz intro from the actual question count.

## 0.5.4

- The research-engine question is always asked and never silently decided; substituting direct research for the documented agents or deep-research path is ruled out; fallbacks are documented for a failed engine and missing Agent tooling.

## 0.5.3

- Agent frontmatter descriptions use block scalars so multi-line examples parse correctly.

## 0.5.2

- First release: interactive HTML courses with verified multi-agent research.
