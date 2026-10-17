#!/usr/bin/env node
'use strict';
// Browser tests for the course engine (assets/template.html), run in headless Chromium.
//   npm install --no-save playwright && npx playwright install chromium && node tests/browser.js
// Skips (exit 0) when Playwright is unavailable, unless REQUIRE_BROWSER=1 is set.

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var url = require('url');

var SCRIPTS = path.join(__dirname, '..', 'skills', 'build-course', 'scripts');
var builder = require(path.join(SCRIPTS, 'build.js'));
var verifier = require(path.join(SCRIPTS, 'verify.js'));
var docsCourse = require('./docs-course.js');
var FIXTURE = path.join(__dirname, 'fixtures', 'sample-course');
var UI_AR = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ui-ar.json'), 'utf8'));
var CDN = /cdnjs\.cloudflare\.com/;

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-me-browser-'));
var copies = 0;
function buildCourse(patch) {
  var dir = path.join(tmp, 'course' + (++copies) + '-course');
  fs.mkdirSync(dir);
  fs.readdirSync(FIXTURE).forEach(function (f) { fs.copyFileSync(path.join(FIXTURE, f), path.join(dir, f)); });
  if (patch) patch(dir);
  return builder.build(dir).file;
}
function rewrite(file, find, replace) {
  var html = fs.readFileSync(file, 'utf8');
  assert.ok(html.indexOf(find) !== -1, 'anchor not found: ' + find);
  var out = file.replace(/\.html$/, '-edited.html');
  fs.writeFileSync(out, html.replace(find, function () { return replace; }));
  return out;
}

var browser;
// Opens a course in a fresh context (fresh localStorage); CDN requests are blocked unless `online` stubs them.
async function open(file, opts) {
  opts = opts || {};
  var context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  var page = await context.newPage();
  page.errors = [];
  page.on('pageerror', function (e) { page.errors.push(e.message); });
  page.on('console', function (m) { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  await page.route(CDN, function (route) {
    return opts.online ? route.fulfill({ contentType: 'text/javascript', body: opts.online }) : route.abort();
  });
  await page.goto(url.pathToFileURL(file).href);
  return page;
}

// Fills in every question correctly by matching rendered questions back to QUIZ_QUESTIONS.
function answerAllCorrectly() {
  var text = function (h) { var d = document.createElement('div'); d.innerHTML = h; return d.textContent.trim(); };
  Array.prototype.forEach.call(document.querySelectorAll('#quizRoot [data-qi]'), function (box) {
    var q = QUIZ_QUESTIONS.filter(function (c) { return box.textContent.indexOf(text(c.q)) !== -1; })[0];
    if (q.type === 'fill') { box.querySelector('.quiz-fill').value = q.answer[0]; return; }
    Array.prototype.forEach.call(box.querySelectorAll('.quiz-opt'), function (label) {
      var want = q.type === 'tf' ? (label.querySelector('input').value === String(q.answer)) :
        label.textContent.trim() === text(q.options[q.answer]);
      if (want) label.querySelector('input').checked = true;
    });
  });
}

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }
var sample;

test('the sample course passes the verifier\'s browser check', async function () {
  var r = await verifier.browserCheck(sample, { questions: 6 });
  assert.ok(!r.skipped, r.skipped);
  assert.deepStrictEqual(r.fails, []);
  assert.deepStrictEqual(r.warns, []);
});

test('every documented widget example runs without errors when clicked through', async function () {
  var file = builder.build(docsCourse.writeDocsCourse(path.join(tmp, 'docs-examples-course'))).file;
  var r = await verifier.browserCheck(file, { questions: 6 });
  assert.ok(!r.skipped, r.skipped);
  assert.deepStrictEqual(r.fails, []);
  assert.deepStrictEqual(r.warns, []);
});

test('submitting with blanks asks first; grading then locks the quiz', async function () {
  var page = await open(sample);
  await page.click('#quizSubmit');
  assert.ok(/6 of 6 questions are unanswered/.test(await page.textContent('#quizNote')));
  assert.strictEqual(await page.textContent('#quizSubmit'), 'Submit anyway');
  assert.strictEqual(await page.isHidden('#quizResult'), true);
  await page.click('#quizSubmit');
  assert.strictEqual(await page.isVisible('#quizResult'), true);
  assert.strictEqual(await page.isHidden('#quizSubmit'), true);
  assert.strictEqual(await page.$$eval('#quizRoot input', function (els) { return els.every(function (e) { return e.disabled; }); }), true);
  assert.strictEqual(await page.evaluate(function () { return document.activeElement.id; }), 'quizResultTitle');
  assert.deepStrictEqual(page.errors, []);
});

test('graded multiple-choice and true/false questions show red/green borders', async function () {
  var page = await open(sample);
  await page.click('#quizSubmit');
  await page.click('#quizSubmit');
  var borders = await page.$$eval('fieldset.quiz-q', function (els) {
    return els.map(function (e) { return getComputedStyle(e).borderTopColor; });
  });
  assert.ok(borders.length >= 3);
  borders.forEach(function (b) { assert.strictEqual(b, 'rgb(185, 28, 28)'); });
});

test('a perfect run scores 100%, marks the right options and keeps the best score', async function () {
  var page = await open(sample);
  await page.evaluate(answerAllCorrectly);
  await page.click('#quizSubmit');
  assert.ok(/\(100%\)/.test(await page.textContent('#quizResultTitle')));
  assert.strictEqual(await page.$$eval('.opt-wrong', function (e) { return e.length; }), 0);
  assert.strictEqual(await page.$$eval('.opt-correct', function (e) { return e.length; }), 3);
  await page.reload();
  assert.strictEqual(await page.textContent('#quizBest'), 'Your best score so far: 100%');
});

test('retake renders a fresh, unlocked quiz', async function () {
  var page = await open(sample);
  await page.click('#quizSubmit');
  await page.click('#quizSubmit');
  await page.click('#quizRetake');
  assert.strictEqual(await page.$$eval('#quizRoot input:disabled', function (e) { return e.length; }), 0);
  assert.strictEqual(await page.$$eval('.q-right, .q-wrong', function (e) { return e.length; }), 0);
  assert.strictEqual(await page.isHidden('#quizResult'), true);
  assert.strictEqual(await page.textContent('#quizSubmit'), 'Submit answers');
});

test('fill-in answers are shown as text, never as live HTML', async function () {
  var page = await open(sample);
  await page.click('#quizSubmit');
  await page.click('#quizSubmit');
  var shown = await page.$$eval('.quiz-feedback em', function (els) { return els.map(function (e) { return e.textContent; }); });
  assert.ok(shown.indexOf('<input>') !== -1, 'expected the literal text <input> in: ' + shown.join(' | '));
  assert.strictEqual(await page.$$eval('.quiz-feedback input', function (e) { return e.length; }), 0);
});

test('a malformed quick check no longer takes the final quiz down with it', async function () {
  var page = await open(rewrite(sample, "qc1: { type: 'tf'", "qc1: { type: 'fill'"));
  assert.strictEqual(await page.$$eval('#quizRoot [data-qi]', function (e) { return e.length; }), 6);
  assert.strictEqual(await page.$$eval('#qc2 .qc-opt', function (e) { return e.length; }), 3);
  assert.ok(page.errors.some(function (e) { return e.indexOf('Quick check "qc1"') !== -1; }), 'the failure should still be logged');
});

test('quick checks give feedback in a live region', async function () {
  var page = await open(sample);
  await page.click('#qc2 .qc-opt[data-i="1"]');
  assert.strictEqual(await page.getAttribute('#qc2 .qc-fb', 'role'), 'status');
  assert.ok(/^Right\./.test(await page.textContent('#qc2 .qc-fb')));
});

test('progress counts only modules that exist', async function () {
  var page = await open(sample);
  await page.click('.mark-done[data-module="m1"]');
  assert.strictEqual(await page.textContent('#progressLabel'), '50% complete');
  assert.strictEqual(await page.textContent('.mark-done[data-module="m1"]'), 'Completed ✓');
  await page.evaluate(function () {
    localStorage.setItem('teachme:' + document.title, JSON.stringify({ done: { m1: true, m7: true, m9: true } }));
  });
  await page.reload();
  assert.strictEqual(await page.textContent('#progressLabel'), '50% complete');
});

test('Arabic courses lay out right-to-left with translated chrome and LTR code', async function () {
  var file = buildCourse(function (dir) {
    fs.writeFileSync(path.join(dir, 'course.json'), JSON.stringify({ title: 'نماذج HTML', lang: 'ar', ui: UI_AR }));
  });
  var page = await open(file);
  var layout = await page.evaluate(function () {
    return {
      dir: getComputedStyle(document.body).direction,
      sidebarOnRight: document.querySelector('.sidebar').getBoundingClientRect().left > document.querySelector('main').getBoundingClientRect().left,
      code: getComputedStyle(document.querySelector('.code')).direction,
      overview: document.querySelector('[data-nav="home"]').textContent,
      submit: document.getElementById('quizSubmit').textContent,
      intro: document.getElementById('quizIntro').textContent
    };
  });
  assert.deepStrictEqual(layout, {
    dir: 'rtl', sidebarOnRight: true, code: 'ltr', overview: 'نظرة عامة', submit: 'إرسال الإجابات',
    intro: 'عدد الأسئلة: 6 · تغطي جميع الوحدات · يمكنك إعادة المحاولة'
  });
  assert.deepStrictEqual(page.errors, []);
});

test('charts render online and fall back cleanly offline', async function () {
  var online = await open(sample, { online: 'window.Chart = function () { window.__charts = (window.__charts || 0) + 1; };' });
  assert.strictEqual(await online.evaluate(function () { return window.__charts; }), 1);
  assert.strictEqual(await online.isHidden('#w3Fallback'), true);
  var offline = await open(sample);
  assert.strictEqual(await offline.isVisible('#w3Fallback'), true);
  assert.deepStrictEqual(offline.errors, []);
});

(async function main() {
  var pw = verifier.loadPlaywright();
  try {
    if (!pw) throw new Error('Playwright is not installed');
    browser = await pw.chromium.launch();
  } catch (e) {
    console.log('SKIPPED browser tests: ' + String(e.message).split('\n')[0]);
    process.exit(process.env.REQUIRE_BROWSER ? 1 : 0);
  }
  sample = buildCourse();
  var failed = 0;
  for (var i = 0; i < tests.length; i++) {
    try {
      await tests[i].fn();
      console.log('  ok    ' + tests[i].name);
    } catch (e) {
      failed++;
      console.log('  FAIL  ' + tests[i].name + '\n        ' + String(e.message).split('\n').join('\n        '));
    }
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n' + (tests.length - failed) + '/' + tests.length + ' passed');
  process.exit(failed ? 1 : 0);
})();
