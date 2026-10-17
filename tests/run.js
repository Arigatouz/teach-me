#!/usr/bin/env node
'use strict';
// Regression tests for build.js and verify.js. No dependencies:  node tests/run.js
// Engine behaviour in a real browser is covered by tests/browser.js.

var assert = require('assert');
var childProcess = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');
var vm = require('vm');

var SCRIPTS = path.join(__dirname, '..', 'skills', 'build-course', 'scripts');
var builder = require(path.join(SCRIPTS, 'build.js'));
var verifier = require(path.join(SCRIPTS, 'verify.js'));
var docsCourse = require('./docs-course.js');
var FIXTURE = path.join(__dirname, 'fixtures', 'sample-course');
var UI_AR = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ui-ar.json'), 'utf8'));

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-me-tests-'));
var tests = [];
var copies = 0;
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// Copies the fixture to a fresh folder; `patch(dir)` may edit files before building.
function fixture(patch) {
  var dir = path.join(tmp, 'course' + (++copies) + '-course');
  fs.mkdirSync(dir);
  fs.readdirSync(FIXTURE).forEach(function (f) { fs.copyFileSync(path.join(FIXTURE, f), path.join(dir, f)); });
  if (patch) patch(dir);
  return dir;
}
function edit(dir, file, find, replace) {
  var p = path.join(dir, file);
  var src = fs.readFileSync(p, 'utf8');
  assert.ok(src.indexOf(find) !== -1, 'fixture anchor not found in ' + file + ': ' + find);
  fs.writeFileSync(p, src.replace(find, function () { return replace; }));
}
function buildHtml(patch) { return fs.readFileSync(builder.build(fixture(patch)).file, 'utf8'); }

var sampleHtml;
function sample() { return sampleHtml || (sampleHtml = buildHtml()); }
function mutate(find, replace) {
  var html = sample();
  assert.ok(html.indexOf(find) !== -1, 'mutation anchor not found: ' + find);
  return html.replace(find, function () { return replace; });
}
function passes(html) {
  var r = verifier.verifyHtml(html);
  assert.deepStrictEqual(r.fails, [], 'expected no failures');
  return r;
}
function failsWith(html, needle) {
  var r = verifier.verifyHtml(html);
  assert.ok(r.fails.some(function (f) { return f.indexOf(needle) !== -1; }),
    'expected a failure containing "' + needle + '"; got:\n      ' + (r.fails.join('\n      ') || '(no failures)'));
}
function warnsWith(html, needle) {
  var r = verifier.verifyHtml(html);
  assert.deepStrictEqual(r.fails, [], 'expected no failures');
  assert.ok(r.warns.some(function (w) { return w.indexOf(needle) !== -1; }),
    'expected a warning containing "' + needle + '"; got:\n      ' + (r.warns.join('\n      ') || '(no warnings)'));
}
function buildFails(patch, needle) {
  assert.throws(function () { builder.build(fixture(patch)); }, function (e) {
    assert.ok(e instanceof builder.BuildError, 'expected a BuildError, got ' + e);
    assert.ok(e.message.indexOf(needle) !== -1, 'expected "' + needle + '" in: ' + e.message);
    return true;
  });
}

// ---------------------------------------------------------------- build.js

test('sample course builds and verifies with no warnings', function () {
  var r = passes(sample());
  assert.deepStrictEqual(r.warns, []);
  assert.strictEqual(r.stats.modules, 2);
  assert.strictEqual(r.stats.questions, 6);
  assert.strictEqual(r.stats.quickChecks, 2);
});

test('build generates nav links, module sections and mark-done buttons', function () {
  var html = sample();
  assert.ok(html.indexOf('<a href="#m2" class="nav-link" data-nav="m2"><span class="nav-num">2</span> Built-in validation</a>') !== -1);
  assert.ok(html.indexOf('<section id="m1" class="module">') !== -1);
  assert.ok(html.indexOf('class="btn ghost mark-done" data-module="m2"') !== -1);
  assert.ok(html.indexOf('<html lang="en" dir="ltr">') !== -1);
});

test('build keeps "$$" and "$&" in course text literally', function () {
  assert.ok(sample().indexOf('it costs $0, not $$ or $&.') !== -1);
});

test('build moves widget scripts to the end and loads Chart.js before them', function () {
  var html = sample();
  var chart = html.indexOf('<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/');
  assert.ok(chart > html.indexOf('/* QUIZ-CORE-END */'), 'Chart.js tag missing or before the engine');
  assert.ok(chart < html.indexOf('new Chart('), 'Chart.js must load before the script that uses it');
  assert.strictEqual(html.slice(html.indexOf('<section id="m1"'), html.indexOf('<section id="quiz"')).indexOf('<script'), -1);
});

test('build derives dir="rtl" for Arabic and applies translated UI strings', function () {
  var html = buildHtml(function (dir) {
    fs.writeFileSync(path.join(dir, 'course.json'), JSON.stringify({ title: 'نماذج HTML', lang: 'ar', ui: UI_AR }));
  });
  assert.ok(html.indexOf('<html lang="ar" dir="rtl">') !== -1);
  assert.ok(html.indexOf('"submit": "إرسال الإجابات"') !== -1);
  assert.deepStrictEqual(passes(html).warns, []);
});

test('build escapes the title and accepts wrapped quiz/quick-check literals', function () {
  var html = buildHtml(function (dir) {
    fs.writeFileSync(path.join(dir, 'course.json'), JSON.stringify({ title: 'Forms <&> "you"', lang: 'en' }));
    var quiz = fs.readFileSync(path.join(dir, 'quiz.js'), 'utf8');
    fs.writeFileSync(path.join(dir, 'quiz.js'), 'var QUIZ_QUESTIONS = [\n' + quiz + '\n];\n');
    var qc = fs.readFileSync(path.join(dir, 'quickchecks.js'), 'utf8');
    fs.writeFileSync(path.join(dir, 'quickchecks.js'), '{\n' + qc + '\n}');
  });
  assert.ok(html.indexOf('<title>Forms &lt;&amp;&gt; &quot;you&quot;</title>') !== -1);
  passes(html);
});

test('build warns about files it ignores', function () {
  var dir = fixture(function (d) { fs.writeFileSync(path.join(d, 'module3.html'), '<h2>Lost</h2>'); });
  var res = builder.build(dir);
  assert.ok(res.warnings.some(function (w) { return w.indexOf('Ignored module3.html') !== -1; }));
});

test('build rejects a missing course.json', function () {
  buildFails(function (d) { fs.unlinkSync(path.join(d, 'course.json')); }, 'missing course.json');
});

test('build rejects gaps in module numbering', function () {
  buildFails(function (d) { fs.renameSync(path.join(d, 'm2.html'), path.join(d, 'm3.html')); }, 'without gaps');
});

test('build rejects a module without an <h2>', function () {
  buildFails(function (d) { edit(d, 'm2.html', '<h2>Built-in validation</h2>', '<h3>Built-in validation</h3>'); }, 'm2.html has no <h2>');
});

test('build reports quiz.js syntax errors with the file and line', function () {
  buildFails(function (d) { edit(d, 'quiz.js', "answer: false,", "answer: false"); }, 'quiz.js has a syntax error');
  buildFails(function (d) { edit(d, 'quiz.js', "answer: false,", "answer: false"); }, '(at quiz.js:');
});

test('build rejects "</script" inside quiz.js', function () {
  buildFails(function (d) { edit(d, 'quiz.js', 'Give the tag.', 'Give the tag, e.g. </script>.'); }, 'contains "</script"');
});

// ------------------------------------------------- verify.js: no false positives

test('escaped code samples that repeat an id are not duplicate ids', function () {
  var html = sample();
  assert.ok(html.split('id="email"').length > 2, 'fixture should repeat id="email" inside escaped code');
  passes(html);
});

test('{{ }} inside <code> is not a leftover placeholder (Angular, Vue, Jinja)', function () {
  assert.ok(sample().indexOf('<code>{{ email }}</code>') !== -1);
  passes(sample());
});

test('source links and SVG xmlns are not offline problems', function () {
  var r = passes(sample());
  assert.ok(sample().indexOf('<a href="https://developer.mozilla.org') !== -1);
  assert.ok(sample().indexOf('xmlns="http://www.w3.org/2000/svg"') !== -1);
  assert.deepStrictEqual(r.warns, []);
});

// ------------------------------------------------------ verify.js: catches bugs

var CASES = [
  ['an unreplaced template placeholder', '<p class="lede">', '<p class="lede">{{HOME_SECTION}} ', 'Unreplaced template placeholders'],
  ['leftover placeholder prose', '<p class="lede">', '<p class="lede">{{insert a hook here}} ', 'Leftover placeholder text'],
  ['a fill-in quick check (engine has none; it used to blank the whole quiz)',
    "qc1: { type: 'tf'", "qc1: { type: 'fill'", 'quick checks have no fill-in variant'],
  ['a quick-check tf answer given as a string', 'answer: true,\n  explain: \'That is why', 'answer: \'true\',\n  explain: \'That is why',
    'tf answer must be true or false'],
  ['a quick-check mc answer out of range', 'answer: 1, explain: \'Constraint', 'answer: 3, explain: \'Constraint',
    'mc answer must be an integer index'],
  ['a quiz tf answer given as a string', 'answer: false,', "answer: 'false',", 'tf answer must be true or false'],
  ['a quiz mc answer out of range', "'<code>aria-hidden</code>'],\n  answer: 0,", "'<code>aria-hidden</code>'],\n  answer: 4,",
    'mc answer must be an integer index'],
  ['a non-integer mc answer', "'<code>aria-hidden</code>'],\n  answer: 0,", "'<code>aria-hidden</code>'],\n  answer: 0.5,",
    'mc answer must be an integer index'],
  ['a question without explain', "explain: 'Placeholder text disappears", "explanation: 'Placeholder text disappears", 'explain is missing'],
  ['a raw tag in an option', '\'<code>&lt;input type="search"&gt;</code>\'', '\'<input type="search">\'', 'contains a raw <input> tag'],
  ['an unclosed formatting tag', "'<code>href</code>'", "'Wrap it in <strong>'", 'unclosed or stray <strong>'],
  ['duplicate options', "'<code>href</code>'", "'<code>name</code>'", 'duplicate option'],
  ['a fill answer that is only punctuation', "answer: ['required'],", "answer: ['required', '?.'],", 'is empty once punctuation is ignored'],
  ['a module with fewer than 2 questions', "{ type: 'mc', topic: 'm2', topicName: 'Built-in validation',",
    "{ type: 'mc', topic: 'm1', topicName: 'Labels that work',", 'Module m2 has 1 final-quiz question(s)'],
  ['a quiz topic that is not a module', "{ type: 'mc', topic: 'm2', topicName: 'Built-in validation',",
    "{ type: 'mc', topic: 'mm2', topicName: 'Built-in validation',", 'is not a module section id'],
  ['a module without an interactive drawing', 'class="widget card" role="group" aria-label="Target size explorer"',
    'class="card" role="group" aria-label="Target size explorer"', 'Module m1 has no interactive drawing'],
  ['a module without a quick check', '<div class="quickcheck" id="qc2"></div>', '', 'Module m2 has no quick check'],
  ['a quick check without its div', '<div class="quickcheck" id="qc2"></div>', '', 'QUICK_CHECKS["qc2"] has no matching'],
  ['a quickcheck div without an entry', '<div class="quickcheck" id="qc2"></div>',
    '<div class="quickcheck" id="qc2"></div><div class="quickcheck" id="qc9"></div>', 'quickcheck div "qc9" has no QUICK_CHECKS entry'],
  ['a module without its mark-done button',
    '<button type="button" class="btn ghost mark-done" data-module="m1" data-ui="markDone">Mark module complete</button>', '',
    'Module m1 needs exactly one mark-done button (found 0)'],
  ['a mark-done button for the wrong module', 'data-module="m2"', 'data-module="m1"', 'expected "m2"'],
  ['a module missing from the sidebar', '<a href="#m2" class="nav-link" data-nav="m2"><span class="nav-num">2</span> Built-in validation</a>',
    '', 'Module m2 has no sidebar link'],
  ['a nav link to a missing section', 'data-nav="m2"', 'data-nav="m7"', 'Nav link points to missing section: #m7'],
  ['a real duplicate id', '<div class="quickcheck" id="qc2"></div>', '<div class="quickcheck" id="qc2"></div><p id="w1Read"></p>',
    'Duplicate element id: w1Read'],
  ['an external image', '<p class="lede">', '<p class="lede"><img src="https://example.com/x.png" alt="">', '<img src="https://example.com/x.png">'],
  ['an external stylesheet', '<p class="lede">', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"><p class="lede">',
    'External resource breaks offline use: <link href='],
  ['an external CSS url()', '<p class="lede">', '<p class="lede" style="background: url(https://example.com/bg.png)">',
    'External resource in CSS breaks offline use'],
  ['an external script', '<p class="lede">', '<p class="lede"><script src="https://unpkg.com/x.js"></script>', '<script src="https://unpkg.com/x.js">'],
  ['a chart whose Chart.js tag is missing',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>\n', '',
    'uses Chart.js but the page never loads it'],
  ['an unguarded Chart.js call', 'if (window.Chart) {', 'if (true) {', 'without an `if (window.Chart)` guard'],
  ['a widget looking up a missing id', "getElementById('w1Read')", "getElementById('w1Readout')", 'looks up #w1Readout'],
  ['a widget script syntax error', 'function draw() {', 'function draw( {', 'has a syntax error'],
  ['an ES module script', '<p class="lede">', '<p class="lede"><script type="module">console.log(1)</script>', 'is an ES module'],
  ['an edited engine', 'if (pct >= 90) return', 'if (pct >= 80) return', 'Course engine/CSS differs from assets/template.html'],
  ['edited template CSS', '--accent: #4f46e5;', '--accent: #ff0000;', 'differs from assets/template.html at template line 11'],
  ['an invalid lang', '<html lang="en"', '<html lang=""', '<html lang> must be a language code'],
  ['a malformed UI strings block', 'var UI_CUSTOM = {};', 'var UI_CUSTOM = [];', 'UI strings are malformed']
];
CASES.forEach(function (c) {
  test('verify fails on ' + c[0], function () { failsWith(mutate(c[1], c[2]), c[3]); });
});

test('verify fails when Chart.js loads after its first use', function () {
  var tag = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>\n';
  var html = sample().replace(tag, function () { return ''; }).replace('</body>', function () { return tag + '</body>'; });
  failsWith(html, 'before the Chart.js <script src> has loaded');
});

test('verify fails when a question type is missing from the quiz', function () {
  var html = buildHtml(function (d) {
    fs.writeFileSync(path.join(d, 'quiz.js'), [
      "{ type: 'mc', topic: 'm1', topicName: 'Labels', q: 'A?', options: ['a', 'b', 'c'], answer: 0, explain: 'x' },",
      "{ type: 'tf', topic: 'm1', topicName: 'Labels', q: 'B.', answer: true, explain: 'x' },",
      "{ type: 'mc', topic: 'm2', topicName: 'Validation', q: 'C?', options: ['a', 'b', 'c'], answer: 2, explain: 'x' },",
      "{ type: 'tf', topic: 'm2', topicName: 'Validation', q: 'D.', answer: false, explain: 'x' }"
    ].join('\n'));
  });
  failsWith(html, 'The final quiz has no "fill" question');
});

test('verify warns on inconsistent topicName, unknown UI keys and RTL without dir', function () {
  warnsWith(mutate("{ type: 'mc', topic: 'm2', topicName: 'Built-in validation',", "{ type: 'mc', topic: 'm2', topicName: 'Validation',"),
    'differs from "Built-in validation"');
  warnsWith(mutate('var UI_CUSTOM = {};', 'var UI_CUSTOM = {"submitt": "Go"};'), 'UI string "submitt" is not a known key');
  warnsWith(mutate('var UI_CUSTOM = {};', 'var UI_CUSTOM = {"progress": "{n} done"};'), 'dropped {pct}');
});

test('verify warns when a non-English course has untranslated UI strings', function () {
  var none = buildHtml(function (d) {
    fs.writeFileSync(path.join(d, 'course.json'), JSON.stringify({ title: 'نماذج HTML', lang: 'ar' }));
  });
  warnsWith(none, 'no UI strings are translated');
  var partial = buildHtml(function (d) {
    fs.writeFileSync(path.join(d, 'course.json'), JSON.stringify({ title: 'نماذج HTML', lang: 'ar', ui: { submit: 'إرسال' } }));
  });
  warnsWith(partial, 'UI strings not yet translated (will show in English): overview');
  warnsWith(mutate('<html lang="en" dir="ltr">', '<html lang="ar" dir="ltr">'), 'is written right-to-left');
});

// ------------------------------------------------- the docs match the code

test('every example in the reference docs builds and verifies cleanly', function () {
  var dir = docsCourse.writeDocsCourse(path.join(tmp, 'docs-examples-course'));
  var r = passes(fs.readFileSync(builder.build(dir).file, 'utf8'));
  assert.deepStrictEqual(r.warns, []);
  assert.strictEqual(r.stats.widgets, 3);
});

test('localization.md lists exactly the template\'s UI strings', function () {
  var tpl = fs.readFileSync(path.join(SCRIPTS, '..', 'assets', 'template.html'), 'utf8');
  var defaults = JSON.parse(JSON.stringify(vm.runInNewContext('(' + tpl.match(/var UI_DEFAULTS = (\{[\s\S]*?\n\});/)[1] + ')')));
  var documented = {};
  fs.readFileSync(path.join(docsCourse.REFS, 'localization.md'), 'utf8')
    .replace(/^\| `(\w+)` \| (.*) \|$/gm, function (m, key, value) { documented[key] = value; });
  assert.deepStrictEqual(documented, defaults);
});

// ------------------------------------------------------------------- CLIs

test('verify.js and build.js CLIs exit 0 on success and 1 on failure', function () {
  var ok = path.join(tmp, 'cli-ok.html');
  var bad = path.join(tmp, 'cli-bad.html');
  fs.writeFileSync(ok, sample());
  fs.writeFileSync(bad, mutate('if (pct >= 90) return', 'if (pct >= 80) return'));
  var run = function (args) { return childProcess.spawnSync(process.execPath, args, { encoding: 'utf8' }); };
  var r = run([path.join(SCRIPTS, 'verify.js'), ok, '--no-browser']);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(/ALL CHECKS PASSED/.test(r.stdout));
  r = run([path.join(SCRIPTS, 'verify.js'), bad, '--no-browser']);
  assert.strictEqual(r.status, 1);
  assert.ok(/FAIL: Course engine\/CSS differs/.test(r.stderr));
  var dir = fixture();
  var out = path.join(tmp, 'custom-name.html');
  r = run([path.join(SCRIPTS, 'build.js'), dir, '--out', out, '--no-browser']);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(out) && /ALL CHECKS PASSED/.test(r.stdout));
  r = run([path.join(SCRIPTS, 'build.js'), dir, '--no-browser']);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(dir + '.html'));
});

// ------------------------------------------------------------------ runner

var failed = 0;
tests.forEach(function (t) {
  try {
    t.fn();
    console.log('  ok    ' + t.name);
  } catch (e) {
    failed++;
    console.log('  FAIL  ' + t.name + '\n        ' + String(e.message).split('\n').join('\n        '));
  }
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log('\n' + (tests.length - failed) + '/' + tests.length + ' passed');
process.exit(failed ? 1 : 0);
