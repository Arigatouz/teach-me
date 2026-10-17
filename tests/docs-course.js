'use strict';
// Builds a course source folder out of the examples in the skill's reference docs, so the
// tests fail whenever a documented example stops passing the verifier (or throws in a browser).

var fs = require('fs');
var path = require('path');

var REFS = path.join(__dirname, '..', 'skills', 'build-course', 'references');

function blocks(file, lang) {
  var md = fs.readFileSync(path.join(REFS, file), 'utf8');
  var re = new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g');
  var out = [];
  var m;
  while ((m = re.exec(md)) !== null) out.push(m[1].replace(/…/g, ''));
  return out;
}

function moduleFile(n, title, body) {
  return '<span class="pill">Module ' + n + ' · 5 min</span>\n<h2>' + title + '</h2>\n' +
    '<div class="callout">Why this matters.</div>\n' + body + '\n<div class="quickcheck" id="qc' + n + '"></div>\n';
}

function writeDocsCourse(dir) {
  var html = blocks('visualizations.md', 'html');
  var widgets = html.filter(function (b) { return b.indexOf('class="widget card"') !== -1; });
  var chart = html.filter(function (b) { return b.indexOf('new Chart(') !== -1; })[0];
  if (widgets.length !== 3 || !chart) throw new Error('visualizations.md should hold 3 widget examples and a Chart.js example');
  var js = blocks('quiz-engine.md', 'js');
  var quiz = js.filter(function (b) { return b.indexOf("type: 'fill'") !== -1; })[0];
  var checks = js.filter(function (b) { return /^qc1:/.test(b.trim()); })[0];
  if (!quiz || !checks) throw new Error('quiz-engine.md should hold a quiz example and a quick-check example');

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'course.json'), JSON.stringify({ title: 'Documented examples', lang: 'en' }));
  fs.writeFileSync(path.join(dir, 'home.html'), '<h1>Documented examples</h1>\n<p class="lede">Built from the reference docs.</p>');
  fs.writeFileSync(path.join(dir, 'm1.html'), moduleFile(1, 'Module 1 name', widgets[0]));
  fs.writeFileSync(path.join(dir, 'm2.html'), moduleFile(2, 'Module 2 name', widgets[1] + '\n' + chart));
  fs.writeFileSync(path.join(dir, 'm3.html'), moduleFile(3, 'Module 3 name', widgets[2]));
  fs.writeFileSync(path.join(dir, 'quiz.js'), quiz.trim() + ',\n' + [
    "{ type: 'tf', topic: 'm1', topicName: 'Module 1 name', q: 'Rates compound.', answer: true, explain: 'They do.' }",
    "{ type: 'mc', topic: 'm3', topicName: 'Module 3 name', q: 'Which grows faster?', options: ['Simple', 'Compound', 'Neither'], answer: 1, explain: 'Compound.' }",
    "{ type: 'tf', topic: 'm3', topicName: 'Module 3 name', q: 'Simple interest is linear.', answer: true, explain: 'It is.' }"
  ].join(',\n'));
  fs.writeFileSync(path.join(dir, 'quickchecks.js'), checks.trim() + ",\nqc3: { type: 'tf', q: 'Compounding curves upward.', answer: true, explain: 'It does.' }");
  return dir;
}

module.exports = { writeDocsCourse: writeDocsCourse, REFS: REFS };
