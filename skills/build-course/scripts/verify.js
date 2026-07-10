#!/usr/bin/env node
'use strict';
// Usage: node verify.js <course.html>
// Exits 0 with "ALL CHECKS PASSED" or 1 with a list of failures.

var fs = require('fs');
var vm = require('vm');

var file = process.argv[2];
if (!file) { console.error('Usage: node verify.js <course.html>'); process.exit(1); }
var html = fs.readFileSync(file, 'utf8');
var fails = [];
var warns = [];

// 1. No leftover template placeholders (any case — human-readable leftovers count too)
var leftovers = html.match(/\{\{[^{}]+\}\}/g);
if (leftovers) fails.push('Unreplaced placeholders: ' + Array.from(new Set(leftovers)).join(', '));

// 2. Every inline script must parse
var scripts = [];
var re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
var m;
while ((m = re.exec(html)) !== null) scripts.push(m[1]);
if (scripts.length === 0) fails.push('No inline <script> blocks found');
scripts.forEach(function (src, i) {
  try { new vm.Script(src); }
  catch (e) { fails.push('Script block ' + (i + 1) + ' has a syntax error: ' + e.message); }
});

// Structural scans run on HTML with script bodies stripped, so markup built
// inside JS strings (the quiz engine renders ids like "quizSubmit") can't
// pollute id/section/nav counting.
var staticHtml = html.replace(/(<script(?![^>]*\bsrc=)[^>]*>)[\s\S]*?(<\/script>)/g, '$1$2');

// 3. Nav targets must exist as section ids
var navs = (staticHtml.match(/data-nav="([^"]+)"/g) || [])
  .map(function (s) { return s.slice(10, -1); });
var ids = (staticHtml.match(/<section[^>]*\bid="([^"]+)"/g) || [])
  .map(function (s) { return s.match(/\bid="([^"]+)"/)[1]; });
navs.forEach(function (n) {
  if (ids.indexOf(n) === -1) fails.push('Nav link points to missing section: #' + n);
});

// 4. Structure sanity
if ((staticHtml.match(/<main[\s>]/g) || []).length !== 1) fails.push('Expected exactly one <main>');
var so = (staticHtml.match(/<section[\s>]/g) || []).length;
var sc = (staticHtml.match(/<\/section>/g) || []).length;
if (so !== sc) fails.push('Unbalanced <section> tags: ' + so + ' open vs ' + sc + ' close');
var staticIds = (staticHtml.match(/ id="([^"]+)"/g) || [])
  .map(function (s) { return s.slice(5, -1); });
var seen = {};
staticIds.forEach(function (id) {
  if (seen[id]) fails.push('Duplicate element id: ' + id);
  seen[id] = true;
});
if (ids.filter(function (i) { return i !== 'home' && i !== 'quiz'; }).length === 0) {
  fails.push('No module sections found');
}

// 4b. Every module must contain an interactive drawing (a .widget block,
// not merely a .widget-read/-controls fragment)
var moduleBlocks = staticHtml.split(/<section[\s>]/).slice(1);
moduleBlocks.forEach(function (block) {
  if (block.indexOf('class="module"') === -1) return;
  var idm = block.match(/\bid="([^"]+)"/);
  var mid = idm ? idm[1] : '(unknown)';
  var end = block.indexOf('</section>');
  var content = end === -1 ? block : block.slice(0, end);
  if (!/class="widget[\s"]/.test(content)) {
    fails.push('Module ' + mid + ' has no interactive drawing (expected a <div class="widget card"> block)');
  }
});

// 5. Offline safety: only cdnjs.cloudflare.com allowed as external resource
(html.match(/https?:\/\/[^"'\s>)]+/g) || []).forEach(function (url) {
  if (url.indexOf('cdnjs.cloudflare.com') === -1) warns.push('External URL (course may not work offline): ' + url);
});

// 6. Quiz core smoke test
var core = html.match(/\/\* QUIZ-CORE-START \*\/([\s\S]*?)\/\* QUIZ-CORE-END \*\//);
if (!core) {
  fails.push('QUIZ-CORE markers missing — quiz cannot be verified');
} else {
  var ctx = {};
  try {
    vm.runInNewContext(core[1], ctx);
    var Q = ctx.QUIZ_QUESTIONS;
    if (!Array.isArray(Q) || Q.length < 3) fails.push('QUIZ_QUESTIONS must have at least 3 questions');
    else {
      Q.forEach(function (q, i) {
        var tag = 'Question ' + (i + 1);
        if (['mc', 'tf', 'fill'].indexOf(q.type) === -1) fails.push(tag + ': bad type "' + q.type + '"');
        if (!q.q) fails.push(tag + ': missing question text');
        if (!q.explain) fails.push(tag + ': missing explain');
        if (!q.topic || !q.topicName) fails.push(tag + ': missing topic/topicName');
        if (q.topic && ids.indexOf(q.topic) === -1) fails.push(tag + ': topic "' + q.topic + '" is not a section id');
        if (q.type === 'mc') {
          if (!Array.isArray(q.options) || q.options.length < 3) fails.push(tag + ': mc needs >=3 options');
          else if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length) {
            fails.push(tag + ': mc answer index out of range');
          }
        }
        if (q.type === 'tf' && typeof q.answer !== 'boolean') fails.push(tag + ': tf answer must be boolean');
        if (q.type === 'fill' && (!Array.isArray(q.answer) || q.answer.length === 0)) {
          fails.push(tag + ': fill answer must be a non-empty array of accepted strings');
        }
      });
      var all = Q.map(function (q) { return q.type === 'mc' ? q.answer : q.type === 'tf' ? String(q.answer) : q.answer[0]; });
      var none = Q.map(function () { return null; });
      var p = ctx.scoreQuiz(Q, all);
      var z = ctx.scoreQuiz(Q, none);
      if (p.pct !== 100) fails.push('Scoring bug: perfect answers scored ' + p.pct + '%');
      if (z.pct !== 0) fails.push('Scoring bug: empty answers scored ' + z.pct + '%');
      var prepared = ctx.prepareQuiz(Q);
      var pAll = prepared.map(function (q) { return q.type === 'mc' ? q.answer : q.type === 'tf' ? String(q.answer) : q.answer[0]; });
      if (ctx.scoreQuiz(prepared, pAll).pct !== 100) fails.push('Shuffle bug: prepared quiz does not score 100% on correct answers');
      // Quick checks
      var qc = ctx.QUICK_CHECKS || {};
      var qcDom = (html.match(/class="quickcheck"[^>]*id="([^"]+)"/g) || [])
        .concat(html.match(/id="([^"]+)"[^>]*class="quickcheck"/g) || [])
        .map(function (s) { return (s.match(/id="([^"]+)"/) || [])[1]; });
      Object.keys(qc).forEach(function (k) {
        if (qcDom.indexOf(k) === -1) fails.push('QUICK_CHECKS["' + k + '"] has no matching <div class="quickcheck" id="' + k + '">');
        var q = qc[k];
        if (!q.q || !q.explain) fails.push('Quick check "' + k + '": missing q/explain');
        if (q.type === 'mc' && (!Array.isArray(q.options) || typeof q.answer !== 'number')) {
          fails.push('Quick check "' + k + '": malformed mc');
        }
      });
      qcDom.forEach(function (k) {
        if (!qc[k]) fails.push('quickcheck div "' + k + '" has no QUICK_CHECKS entry');
      });
      if (!fails.length) {
        console.log('Quiz: ' + Q.length + ' questions, ' + Object.keys(qc).length +
          ' quick checks, scoring + shuffle verified');
      }
    }
  } catch (e) {
    fails.push('Quiz core failed to execute: ' + e.message);
  }
}

warns.forEach(function (w) { console.log('WARN: ' + w); });
if (fails.length) {
  fails.forEach(function (f) { console.error('FAIL: ' + f); });
  process.exit(1);
}
console.log('ALL CHECKS PASSED (' + ids.length + ' sections, ' + scripts.length + ' script blocks)');
