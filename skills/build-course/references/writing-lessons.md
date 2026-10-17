# Writing lessons that teach

The template guarantees a course *works*; this guide is about whether it *teaches*. Read it before drafting the curriculum (Step 3) and apply it to every module.

## The arc of a module

Each part of the module structure in SKILL.md exists for a reason — fill it with that purpose in mind:

1. **Hook** (`.callout`): open with a concrete problem, question or surprise the module resolves — never a definition. "Why does this list change when I didn't touch it?" beats "Mutability is…".
2. **Concrete before abstract**: show one specific example first, then name the general rule it illustrates. Learners attach rules to examples, not the other way round.
3. **Explain the mechanism**: say *why* it works, not only *what* it does. A learner who knows why can rebuild a forgotten detail; one who memorized can't.
4. **Worked example**: walk through one realistic problem step by step, saying the reasoning out loud, before asking the learner to do anything. Beginners learn more from studying a solved problem than from struggling with an unsolved one.
5. **Interactive drawing**: put the module's central "what happens if…" in the learner's hands. Its caption or readout must say what to notice.
6. **Quick check** right after the idea it tests: retrieving an idea moments after reading it strengthens memory far more than rereading does.
7. **Misconception** (`.callout.warn`): name the wrong belief, say why it is tempting, then correct it. Stating the misconception explicitly works better than only teaching the right idea — learners otherwise keep both. Use the misconception map from the research when it exists.
8. **Takeaways** (`.callout.good`): three complete claims ("Lists are mutable; strings are not"), not topic labels ("Mutability").

## Calibrate to the learner's level

| | Beginner | Intermediate | Advanced |
|---|---|---|---|
| Assumes | nothing; define every term on first use | the fundamentals; define only new terms | the field's vocabulary |
| Pace | one new idea per section | a few related ideas per section | dense; spend the words on edge cases and trade-offs |
| Examples | everyday analogies, then a tiny real case | realistic tasks | production-grade cases and failure modes |
| Quiz emphasis | recognize and explain | apply to new cases | analyze, compare, debug |

When unsure, write for the level below — experts skim easy material, but novices can't skip hard material.

## Style

- Paragraphs of at most four sentences, one idea each; short sentences, active voice, addressed to "you".
- Use the field's official terms (from the docs research) consistently — never invent synonyms, and never use two names for one thing.
- One analogy per abstract concept, and say where it breaks down; an analogy pushed too far teaches something false.
- Code samples: minimal, runnable, and focused on the line that matters; show the output when it makes the point.
- Bold only the term being defined. Break long modules with `<h3>` subheadings every few paragraphs.
- Pair every diagram or widget with text that interprets it — and never make the text depend on colour alone.

## Sequence across modules

- Order modules by dependency: nothing is used before it is taught.
- End each module with what the next one needs, and reuse earlier ideas in later examples — meeting an idea again after a gap is what makes it stick.
- The final quiz interleaves questions from all modules (the engine shuffles them), which trains learners to recognize *which* idea applies — keep the per-module questions varied enough for that to matter.

## Non-English courses

Write natively in the target language rather than translating English sentence structure. Keep code, API names and official technical terms in their original form, inside `<code>`; add the established local term in parentheses on first use if one exists. Translate the interface strings too (`references/localization.md`).
