# Localization

Read this when the course language is not English.

1. **Set `"lang"` in course.json.** Right-to-left languages — Arabic (`ar`), Hebrew (`he`), Persian (`fa`), Urdu (`ur`), Pashto (`ps`), Sindhi (`sd`), Central Kurdish (`ckb`), Uyghur (`ug`), Yiddish (`yi`), Dhivehi (`dv`) and a few more — get `dir="rtl"` automatically: the sidebar, callouts, lists and quiz mirror, while code blocks, inline `<code>` and SVG diagrams stay left-to-right.
2. **Translate every interface string** below into `"ui"` in course.json. Keep each `{placeholder}` exactly as written — the engine fills it in. verify.js warns about untranslated keys, unknown keys (typos) and dropped placeholders.
3. **Write the lessons natively** in that language (`references/writing-lessons.md`). Keep code, API names and official technical terms in their original form inside `<code>`.
4. **In RTL courses**, an SVG `<text>` that mixes directions — Arabic with Latin words, digits or punctuation — needs `direction="rtl"`, and an arrow meaning "next" points left.

```json
{
  "title": "المزخرفات في بايثون",
  "shortTitle": "المزخرفات",
  "lang": "ar",
  "ui": { "overview": "نظرة عامة", "finalQuiz": "الاختبار النهائي", "submit": "إرسال الإجابات", "…": "…" }
}
```

| Key | English default |
|---|---|
| `overview` | Overview |
| `finalQuiz` | Final quiz |
| `navLabel` | Course navigation |
| `progress` | {pct}% complete |
| `markDone` | Mark module complete |
| `completed` | Completed ✓ |
| `footer` | Built with the Teach Me plugin · your progress is saved in this browser |
| `quizIntro` | {n} questions · covers all modules · you can retake it |
| `best` | Your best score so far: {pct}% |
| `questionLabel` | Q{n}. |
| `answerPlaceholder` | Type your answer |
| `answerLabel` | Your answer to question {n} |
| `trueLabel` | True |
| `falseLabel` | False |
| `submit` | Submit answers |
| `unanswered` | {n} of {total} questions are unanswered. Answer them, or submit anyway. |
| `submitAnyway` | Submit anyway |
| `correct` | Correct. |
| `notQuite` | Not quite. |
| `correctAnswer` | Correct answer: |
| `retake` | Retake quiz (new order) |
| `mastered` | mastered |
| `review` | review |
| `quickCheck` | Quick check: |
| `right` | Right. |
| `verdictExcellent` | Excellent |
| `verdictExcellentMsg` | You have mastered this material. |
| `verdictGood` | Good |
| `verdictGoodMsg` | Solid understanding — review the topics below to reach mastery. |
| `verdictFair` | Getting there |
| `verdictFairMsg` | You have the basics. Revisit the weaker modules before moving on. |
| `verdictLow` | Needs review |
| `verdictLowMsg` | Work back through the modules below, then retake the quiz. |
