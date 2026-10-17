# Research pipeline

How to research a course topic. Two paths, tried in order. Either way the outcome is the same artifact: a verified research file the course is written from, and a sources list embedded in the course HTML.

## When research is required

Run research when the topic is fast-changing (technology, tools, APIs, laws, prices, current events) OR has official documentation OR the user asked for a deep curriculum. Skip only for stable, timeless topics (arithmetic, classical history basics, core physics) at quick-lesson depth — and even then, never invent statistics or dates.

## Scale the pipeline to the course size

Four agents for a 30-minute lesson is overkill; no research for a 12-module curriculum is malpractice.

| Course size | Research mode |
|---|---|
| Quick lesson (1 module) | Lightweight: do the research yourself inline — a few searches prioritizing the official docs, minimum 5 sourced facts, cite the version. No agents. |
| Standard course (4–8 modules) | Full pipeline (Path A or B below) |
| Deep curriculum (10+ modules) | Full pipeline; consider splitting the docs lane's scope across the curriculum's halves if the topic is very large |

## Choosing the research engine — always ask

Check the available skills list for a deep-research capability: names like `deep-research`, `research`, or similar multi-source research skills.

Whenever the full pipeline is warranted (see table above), ask this every time as one question in the Step 1 clarification round (one AskUserQuestion total, this as one of its questions) — regardless of whether a deep-research skill is installed:

> "How should I research this topic?"
> 1. **Research swarm (Recommended)** — this plugin's 3 specialized researchers + a verifier that checks every claim against the official docs
> 2. **Your deep-research skill** — uses `<detected skill name>`; often faster, and its output still gets gated before use

Omit option 2 if no such skill is installed — but still ask. Default on skip: the swarm — it is purpose-built for courses and verification is integral to it. Honor the user's choice for the rest of the session unless they say otherwise.

Whatever gets chosen, execute it exactly as documented below (Path A or Path B). Doing the research or verification yourself instead — via a documentation MCP tool, web fetch, or built-in knowledge — is not a substitute, no matter how confident you are that it's equally reliable. The only exception is the quick-lesson lightweight mode in the table above; it does not extend to standard or deep courses.

## Path A — deep-research skill (when the user picks it)

Invoke the detected skill with a research brief:

```
Research <topic> for a <level> course of <N> modules. Needed:
1. Core concepts with official definitions and current version (official docs only, cite exact URLs)
2. How the best tutorials teach it — order, analogies, common misconceptions
3. What is current: latest version, deprecations, real-world best practices, top learner questions
Every claim needs a source URL. Flag anything uncertain.
```

Then gate the output: if the report's technical claims cite official documentation, proceed. If they lean on blogs/community sources, run the `course-verifier` agent (Path B, step 3) on the report before writing the course.

## Path B — the research swarm (default)

### 1. Set up the workspace

Create `research/` inside the course source folder (`<topic-slug>-course/research/`, see SKILL.md Step 4) so each course keeps its own reports; build.js ignores the folder. Reports:

- `research/docs.md` — official documentation lane
- `research/pedagogy.md` — teaching craft lane
- `research/ecosystem.md` — currency and practice lane
- `research/verified.md` — verifier output

### 2. Spawn the three researchers IN PARALLEL — one turn, three Agent calls

Use the plugin's agent types `course-researcher-docs`, `course-researcher-pedagogy`, `course-researcher-ecosystem`. If plugin agent types are unavailable in this environment, spawn `general-purpose` agents and paste the corresponding `course-researcher-*.md` body into the prompt instead — those files live in the plugin's `agents/` folder, two levels above this skill's directory. The strategy separation is what matters, not the agent name.

Task prompt template (fill per lane):

```
<lane agent's own instructions apply>
Topic: <topic>
Learner level: <level>
Course scope: <N> modules covering <objectives draft>
Write your report to: <abs path>/research/<lane>.md
Today's date: <date> (use it for recency-scoped searches)
```

The three lanes deliberately search differently — docs restricts itself to official domains, pedagogy hunts tutorials and misconceptions, ecosystem chases recency and community FAQs. Do not merge or reassign lanes; the diversity of strategy is the point. Never give two agents the same lane.

### 3. Spawn the verifier (after all three complete)

Spawn `course-verifier` (or `general-purpose` + the `agents/course-verifier.md` body):

```
Verify the research for a course on <topic>.
Reports: <abs paths of the three reports>
Write verified output to: <abs path>/research/verified.md
Docs MCP tools that may be available to you: <list any doc-serving MCP tools you can see, e.g. Context7, Microsoft Learn — or "none known, use official-site fetch">
```

### 4. Consume the result

- Write course content ONLY from the "Course facts" and "Teaching guidance" sections of `verified.md`. UNVERIFIED claims do not enter the course in any form.
- Take module ordering and interactive-drawing ideas from the teaching guidance.
- Mine "Top real-user questions" for quiz questions.
- State the verified version prominently in the course home section ("This course covers Angular 20.1, verified July 2026").

## Sources section in the course HTML

When the pipeline ran, end `home.html` with a collapsible sources block:

```html
<details class="card"><summary><strong>Sources</strong> — verified against <official domain>, <date></summary>
<ul>
  <li><a href="URL">Page title — domain</a></li>
</ul>
</details>
```

List official sources first, from the verifier's "Sources for the course HTML" section. This is the learner's proof that the course wasn't hallucinated.

## Failure handling

- A researcher returns thin/empty results → proceed with the other two lanes; note the gap in the curriculum plan shown to the user.
- Verifier marks many claims UNVERIFIED → narrow the course scope to what survived, and tell the user what was cut and why.
- The chosen engine (Path A or Path B) errors out mid-run → fall back to the other path once, telling the user you're switching and why. If that also fails, drop to the next rule below.
- The Agent/Task tool is unavailable in this environment (so Path B's agents cannot be spawned at all) and no deep-research skill is installed either → do the lightweight inline research described in the quick-lesson row above, even for a standard/deep course, and tell the user plainly this is a degraded fallback, not the full pipeline.
- No web access at all → fall back to built-in knowledge, cap the course at fundamentals, and label it clearly as unverified against current docs.
