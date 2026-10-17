#!/usr/bin/env node
'use strict';
// Usage: node verify.js <course.html> [--no-browser]
// Exits 0 with "ALL CHECKS PASSED" or 1 with a list of failures.
// When Playwright is installed, also loads the course in headless Chromium and exercises
// every widget and quick check; otherwise that step is skipped with a note.
// Also usable as a module: require('./verify.js').verifyFile(file, { browser: false }).

var fs = require('fs');
var path = require('path');
var url = require('url');
var vm = require('vm');

var TEMPLATE = path.join(__dirname, '..', 'assets', 'template.html');
var CHART_JS = /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/Chart\.js\/[\w.-]+\/chart(\.umd)?(\.min)?\.js$/;
var RTL_LANGS = ['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'iw', 'ks', 'nqo', 'ps', 'sd', 'syr', 'ug', 'ur', 'yi'];
// Formatting tags allowed inside quiz and quick-check strings. Anything else (<input>, <div>, …)
// is almost always a tag *name* the author meant as text, and would render as a live element.
var INLINE_TAGS = ['code', 'em', 'strong', 'b', 'i', 'u', 's', 'sub', 'sup', 'kbd', 'mark', 'small',
  'var', 'samp', 'abbr', 'q', 'bdi', 'bdo', 'span', 'br'];
// Attributes through which an element loads something when the page opens.
var RESOURCE_ATTRS = {
  script: ['src'], img: ['src', 'srcset'], iframe: ['src'], frame: ['src'], embed: ['src'],
  object: ['data'], video: ['src', 'poster'], audio: ['src'], source: ['src', 'srcset'],
  track: ['src'], input: ['src'], link: ['href'], image: ['href', 'xlink:href'],
  use: ['href', 'xlink:href'], feimage: ['href', 'xlink:href']
};

function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
function clip(s, n) { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > (n || 60) ? s.slice(0, (n || 60) - 1) + '…' : s; }
function lineOf(text, index) { return text.slice(0, index).split('\n').length; }
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripTags(s) { return String(s).replace(/<[^>]*>/g, ''); }
function isExternal(u) { return /^\s*(https?:)?\/\//i.test(u); }

function attr(attrs, name) {
  var m = new RegExp('(?:^|\\s)' + escRe(name) + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'=<>`]+))', 'i').exec(attrs);
  return m ? (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]) : null;
}

// Start tags of real elements. Callers pass markup with script/style bodies and comments
// removed, so markup built inside JS strings and escaped code samples (&lt;input id="x"&gt;)
// are never mistaken for elements.
function startTags(markup) {
  var out = [];
  var re = /<([a-zA-Z][\w-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
  var m;
  while ((m = re.exec(markup)) !== null) {
    out.push({ name: m[1].toLowerCase(), attrs: m[2] || '', index: m.index, end: re.lastIndex });
  }
  return out;
}

function hasClass(t, c) { return (attr(t.attrs, 'class') || '').split(/\s+/).indexOf(c) !== -1; }

function scriptBlocks(html) {
  var out = [];
  var re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  var m;
  while ((m = re.exec(html)) !== null) out.push({ attrs: m[1], body: m[2], start: m.index, src: attr(m[1], 'src') });
  return out;
}

// Problems with a string the engine will insert as HTML (question text, options, explanations).
function htmlProblem(value) {
  if (typeof value !== 'string' || !value.trim()) return 'is missing';
  var open = {};
  var re = /<(\/?)([a-zA-Z][\w-]*)([^<>]*)(>?)/g;
  var m;
  while ((m = re.exec(value)) !== null) {
    var name = m[2].toLowerCase();
    if (INLINE_TAGS.indexOf(name) === -1) {
      return 'contains a raw <' + name + '> tag, which renders as a live element — write it as &lt;' + name + '&gt; (inside <code> if you like)';
    }
    if (!m[4]) return 'has an unterminated <' + name + ' tag — escape a literal "<" as &lt;';
    if (name === 'br') continue;
    open[name] = (open[name] || 0) + (m[1] ? -1 : 1);
  }
  for (var t in open) {
    if (open[t] !== 0) return 'has an unclosed or stray <' + t + '> — if you meant the text "<' + t + '>", write &lt;' + t + '&gt;';
  }
  if (!stripTags(value).trim()) return 'renders as empty text';
  return null;
}

function checkIntegrity(html, fail, warn) {
  var tpl;
  try { tpl = fs.readFileSync(TEMPLATE, 'utf8').replace(/\r\n?/g, '\n'); } catch (e) {
    warn('assets/template.html not found next to this script — engine integrity not checked');
    return;
  }
  // The course must contain every literal stretch of the template, in order: only placeholders may change.
  var parts = tpl.split(/(\{\{[A-Z][A-Z0-9_]*\}\})/);
  var pos = 0;
  var offset = 0;
  for (var i = 0; i < parts.length; offset += parts[i].length, i++) {
    if (i % 2 === 1 || !parts[i]) continue;
    var at = html.indexOf(parts[i], pos);
    if (at !== -1) { pos = at + parts[i].length; continue; }
    var lines = parts[i].split('\n');
    var p = pos;
    for (var j = 0; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      var k = html.indexOf(lines[j], p);
      if (k === -1) {
        fail('Course engine/CSS differs from assets/template.html at template line ' + (lineOf(tpl, offset) + j) +
          ': "' + clip(lines[j], 90) + '" — only placeholders may change; rebuild with build.js');
        return;
      }
      p = k + lines[j].length;
    }
    fail('Course engine/CSS differs from assets/template.html (lines reordered near template line ' +
      lineOf(tpl, offset) + ') — rebuild with build.js');
    return;
  }
}

function checkQuiz(core, page, fail, warn, stats) {
  var ctx = {};
  try { vm.runInNewContext(core, ctx, { filename: 'quiz core', timeout: 2000 }); } catch (e) {
    fail('Quiz core failed to execute: ' + e.message);
    return;
  }

  // UI strings (localization)
  var defaults = ctx.UI_DEFAULTS;
  var custom = ctx.UI_CUSTOM;
  if (!defaults || !custom || typeof custom !== 'object' || Array.isArray(custom)) {
    fail('UI strings are malformed — {{UI_STRINGS}} must be replaced with an object literal ({} for English)');
  } else {
    Object.keys(custom).forEach(function (k) {
      if (!has(defaults, k)) { warn('UI string "' + k + '" is not a known key, so it has no effect (typo?)'); return; }
      if (typeof custom[k] !== 'string') { fail('UI string "' + k + '" must be a string'); return; }
      (defaults[k].match(/\{\w+\}/g) || []).forEach(function (tok) {
        if (custom[k].indexOf(tok) === -1) warn('UI string "' + k + '" dropped ' + tok + ', so that value will not show');
      });
    });
    var primary = (page.lang || '').toLowerCase().split('-')[0];
    if (primary && primary !== 'en') {
      var missing = Object.keys(defaults).filter(function (k) { return !has(custom, k); });
      if (missing.length === Object.keys(defaults).length) {
        warn('Course language is "' + page.lang + '" but no UI strings are translated — navigation, buttons and verdicts will show in English (set "ui" in course.json)');
      } else if (missing.length) {
        warn('UI strings not yet translated (will show in English): ' + missing.join(', '));
      }
    }
  }

  var Q = ctx.QUIZ_QUESTIONS;
  var QC = ctx.QUICK_CHECKS || {};
  var before = page.failCount();
  if (!Array.isArray(Q) || Q.length < 3) {
    fail('QUIZ_QUESTIONS must have at least 3 questions');
    return;
  }
  var perTopic = {};
  var topicNames = {};
  var types = {};
  Q.forEach(function (q, i) {
    var tag = 'Question ' + (i + 1) + (q && typeof q.q === 'string' ? ' ("' + clip(stripTags(q.q), 50) + '")' : '');
    if (!q || typeof q !== 'object') { fail(tag + ': not an object'); return; }
    if (['mc', 'tf', 'fill'].indexOf(q.type) === -1) { fail(tag + ': bad type "' + q.type + '" (use mc, tf or fill)'); return; }
    types[q.type] = true;
    var problem;
    if ((problem = htmlProblem(q.q))) fail(tag + ': question text ' + problem);
    if ((problem = htmlProblem(q.explain))) fail(tag + ': explain ' + problem);
    if (!q.topic || !q.topicName) {
      fail(tag + ': missing topic/topicName');
    } else {
      if (page.moduleIds.indexOf(q.topic) === -1) fail(tag + ': topic "' + q.topic + '" is not a module section id');
      perTopic[q.topic] = (perTopic[q.topic] || 0) + 1;
      if (has(topicNames, q.topic) && topicNames[q.topic] !== q.topicName) {
        warn(tag + ': topicName "' + q.topicName + '" differs from "' + topicNames[q.topic] + '" used for the same module');
      }
      if (!has(topicNames, q.topic)) topicNames[q.topic] = q.topicName;
      if ((problem = htmlProblem(q.topicName))) fail(tag + ': topicName ' + problem);
    }
    if (q.type === 'mc') {
      if (!Array.isArray(q.options) || q.options.length < 3) {
        fail(tag + ': mc needs at least 3 options');
      } else {
        var seen = {};
        q.options.forEach(function (o, oi) {
          if ((problem = htmlProblem(o))) fail(tag + ': option ' + (oi + 1) + ' ' + problem);
          var key = stripTags(String(o)).replace(/\s+/g, ' ').trim().toLowerCase();
          if (has(seen, key)) fail(tag + ': duplicate option "' + clip(key, 40) + '"');
          seen[key] = true;
        });
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
          fail(tag + ': mc answer must be an integer index into options (0–' + (q.options.length - 1) + ')');
        }
      }
    }
    if (q.type === 'tf' && typeof q.answer !== 'boolean') fail(tag + ': tf answer must be true or false (a boolean, not a string)');
    if (q.type === 'fill') {
      if (!Array.isArray(q.answer) || !q.answer.length || q.answer.some(function (a) { return typeof a !== 'string'; })) {
        fail(tag + ': fill answer must be a non-empty array of accepted strings');
      } else {
        q.answer.forEach(function (a) {
          if (!ctx.normalizeFill(a)) fail(tag + ': fill answer "' + a + '" is empty once punctuation is ignored, so it would match blank-ish input');
        });
      }
    }
  });
  page.moduleIds.forEach(function (m) {
    if ((perTopic[m] || 0) < 2) fail('Module ' + m + ' has ' + (perTopic[m] || 0) + ' final-quiz question(s); it needs at least 2');
  });
  ['mc', 'tf', 'fill'].forEach(function (t) {
    if (!types[t]) fail('The final quiz has no "' + t + '" question; all three types (mc, tf, fill) must appear');
  });

  if (page.failCount() === before) {
    var key = function (q) { return q.type === 'mc' ? q.answer : q.type === 'tf' ? String(q.answer) : q.answer[0]; };
    var perfect = ctx.scoreQuiz(Q, Q.map(key));
    var empty = ctx.scoreQuiz(Q, Q.map(function () { return null; }));
    if (perfect.pct !== 100) fail('Scoring bug: perfect answers scored ' + perfect.pct + '%');
    if (empty.pct !== 0) fail('Scoring bug: empty answers scored ' + empty.pct + '%');
    for (var r = 0; r < 5; r++) {
      var prepared = ctx.prepareQuiz(Q);
      if (ctx.scoreQuiz(prepared, prepared.map(key)).pct !== 100) {
        fail('Shuffle bug: prepared quiz does not score 100% on correct answers');
        break;
      }
    }
  }

  Object.keys(QC).forEach(function (k) {
    var q = QC[k];
    var tag = 'Quick check "' + k + '"';
    if (page.quickcheckIds.indexOf(k) === -1) fail('QUICK_CHECKS["' + k + '"] has no matching <div class="quickcheck" id="' + k + '">');
    if (!q || typeof q !== 'object') { fail(tag + ': not an object'); return; }
    if (q.type !== 'mc' && q.type !== 'tf') {
      fail(tag + ': type must be "mc" or "tf" (got "' + q.type + '") — quick checks have no fill-in variant');
      return;
    }
    var problem;
    if ((problem = htmlProblem(q.q))) fail(tag + ': question text ' + problem);
    if ((problem = htmlProblem(q.explain))) fail(tag + ': explain ' + problem);
    if (q.type === 'mc') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        fail(tag + ': mc needs at least 2 options');
      } else {
        q.options.forEach(function (o, oi) {
          if ((problem = htmlProblem(o))) fail(tag + ': option ' + (oi + 1) + ' ' + problem);
        });
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
          fail(tag + ': mc answer must be an integer index into options (0–' + (q.options.length - 1) + ')');
        }
      }
    }
    if (q.type === 'tf' && typeof q.answer !== 'boolean') fail(tag + ': tf answer must be true or false (a boolean, not a string)');
  });
  page.quickcheckIds.forEach(function (k) {
    if (!has(QC, k)) fail('quickcheck div "' + k + '" has no QUICK_CHECKS entry');
  });

  stats.questions = Q.length;
  stats.quickChecks = Object.keys(QC).length;
}

function verifyHtml(raw) {
  var html = String(raw).replace(/\r\n?/g, '\n');
  var fails = [];
  var warns = [];
  var notes = [];
  var stats = { modules: 0, questions: 0, quickChecks: 0, scripts: 0, widgets: 0 };
  function fail(m) { if (fails.indexOf(m) === -1) fails.push(m); }
  function warn(m) { if (warns.indexOf(m) === -1) warns.push(m); }

  // 1. No leftover placeholders. Template holes are {{UPPER_CASE}}; any other {{…}} counts too,
  // except inside code, where it is usually real syntax (Angular, Vue, Jinja, Handlebars).
  var holes = html.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g);
  if (holes) fail('Unreplaced template placeholders: ' + uniq(holes).join(', '));
  var prose = html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|pre|code|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  var leftovers = (prose.match(/\{\{[^{}]+\}\}/g) || []).filter(function (h) { return !/^\{\{[A-Z][A-Z0-9_]*\}\}$/.test(h); });
  if (leftovers.length) fail('Leftover placeholder text: ' + uniq(leftovers).join(', ') + ' (code inside <pre>/<code> is exempt)');

  // 2. Scripts: classic scripts only, and every inline one must parse
  var scripts = scriptBlocks(html);
  var inline = [];
  scripts.forEach(function (s, i) {
    var type = (attr(s.attrs, 'type') || '').toLowerCase();
    if (type === 'module') {
      fail('Script block ' + (i + 1) + ' is an ES module, which breaks from file:// — use a classic <script> with an IIFE');
      return;
    }
    if (type && !/^(text|application)\/(java|ecma)script$/.test(type)) return;
    if (s.src !== null) return;
    inline.push(s);
    try { new vm.Script(s.body, { filename: 'script block ' + (i + 1) }); } catch (e) {
      fail('Script block ' + (i + 1) + ' (line ' + lineOf(html, s.start) + ') has a syntax error: ' + e.message);
    }
  });
  if (!inline.length) fail('No inline <script> blocks found');
  stats.scripts = scripts.length;

  var markup = html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script\s*>)/gi, '$1$2')
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style\s*>)/gi, '$1$2');
  var tags = startTags(markup);

  // 3. Language and direction
  var htmlTag = tags.filter(function (t) { return t.name === 'html'; })[0];
  var lang = htmlTag ? attr(htmlTag.attrs, 'lang') : null;
  var dir = htmlTag ? attr(htmlTag.attrs, 'dir') : null;
  if (!lang || !/^[a-z]{2,3}(-[a-z0-9]{1,8})*$/i.test(lang)) fail('<html lang> must be a language code like "en" or "ar" (got "' + lang + '")');
  if (dir !== null && ['ltr', 'rtl', 'auto'].indexOf(dir) === -1) fail('<html dir> must be "ltr" or "rtl" (got "' + dir + '")');
  if (lang && RTL_LANGS.indexOf(lang.toLowerCase().split('-')[0]) !== -1 && dir !== 'rtl') {
    warn('"' + lang + '" is written right-to-left but <html dir> is "' + dir + '" — set "dir": "rtl" in course.json');
  }

  // 4. Ids are unique
  var idCount = {};
  tags.forEach(function (t) {
    var id = attr(t.attrs, 'id');
    if (id !== null) idCount[id] = (idCount[id] || 0) + 1;
  });
  Object.keys(idCount).forEach(function (id) {
    if (idCount[id] > 1) fail('Duplicate element id: ' + id + ' (used ' + idCount[id] + ' times)');
  });

  // 5. Page structure: home, modules, quiz, nav
  var mains = tags.filter(function (t) { return t.name === 'main'; }).length;
  if (mains !== 1) fail('Expected exactly one <main> (found ' + mains + ')');
  var sections = tags.filter(function (t) { return t.name === 'section'; });
  var closes = (markup.match(/<\/section\s*>/gi) || []).length;
  if (sections.length !== closes) fail('Unbalanced <section> tags: ' + sections.length + ' open vs ' + closes + ' close');
  var sectionIds = sections.map(function (t) { return attr(t.attrs, 'id'); }).filter(function (id) { return id !== null; });
  ['home', 'quiz'].forEach(function (id) {
    if (sectionIds.indexOf(id) === -1) fail('Missing <section id="' + id + '">');
  });
  var navTargets = tags.map(function (t) { return attr(t.attrs, 'data-nav'); }).filter(function (v) { return v !== null; });
  navTargets.forEach(function (n) {
    if (sectionIds.indexOf(n) === -1) fail('Nav link points to missing section: #' + n);
  });
  var markDone = tags.filter(function (t) { return hasClass(t, 'mark-done'); });
  var modules = sections.filter(function (t) { return hasClass(t, 'module'); });
  if (!modules.length) fail('No module sections found (<section id="m1" class="module">)');
  var moduleIds = [];
  modules.forEach(function (t) {
    var id = attr(t.attrs, 'id');
    if (!id) { fail('A module section has no id'); return; }
    moduleIds.push(id);
    var rel = markup.slice(t.end).search(/<\/section\s*>/i);
    var close = rel === -1 ? markup.length : t.end + rel;
    var inner = tags.filter(function (x) { return x.index > t.index && x.index < close; });
    var name = 'Module ' + id;
    if (!inner.some(function (x) { return x.name === 'h2'; })) fail(name + ' has no <h2> title');
    var widgets = inner.filter(function (x) { return hasClass(x, 'widget'); }).length;
    stats.widgets += widgets;
    if (!widgets) fail(name + ' has no interactive drawing (expected a <div class="widget card"> block)');
    if (!inner.some(function (x) { return hasClass(x, 'quickcheck'); })) fail(name + ' has no quick check (<div class="quickcheck" id="qcN"></div>)');
    var own = markDone.filter(function (x) { return x.index > t.index && x.index < close; });
    if (own.length !== 1) {
      fail(name + ' needs exactly one mark-done button (found ' + own.length + ')');
    } else if (attr(own[0].attrs, 'data-module') !== id) {
      fail(name + "'s mark-done button has data-module=\"" + attr(own[0].attrs, 'data-module') + '"; expected "' + id + '"');
    }
    if (navTargets.indexOf(id) === -1) fail(name + ' has no sidebar link (data-nav="' + id + '")');
  });
  stats.modules = moduleIds.length;
  var quickcheckIds = tags.filter(function (t) { return hasClass(t, 'quickcheck'); })
    .map(function (t) { return attr(t.attrs, 'id'); });
  if (quickcheckIds.indexOf(null) !== -1) fail('A quickcheck div has no id');
  quickcheckIds = quickcheckIds.filter(function (id) { return id !== null; });

  // 6. Offline safety: nothing loads from the network except Chart.js from cdnjs. Links (<a href>)
  // and SVG xmlns are fine — they load nothing.
  tags.forEach(function (t) {
    var names = RESOURCE_ATTRS[t.name];
    if (!names) return;
    if (t.name === 'link' && /\b(canonical|alternate|author|license|help)\b/i.test(attr(t.attrs, 'rel') || '')) return;
    names.forEach(function (a) {
      var v = attr(t.attrs, a);
      if (v === null) return;
      var urls = a === 'srcset' ? v.split(',').map(function (c) { return c.trim().split(/\s+/)[0]; }) : [v];
      urls.forEach(function (u) {
        if (!isExternal(u) || (t.name === 'script' && CHART_JS.test(u))) return;
        fail('External resource breaks offline use: <' + t.name + ' ' + a + '="' + u + '"> — inline it as SVG or remove it');
      });
    });
  });
  var css = (html.match(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi) || []).join('\n') + '\n' +
    tags.map(function (t) { return attr(t.attrs, 'style') || ''; }).join('\n');
  var cssRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/gi;
  var cm;
  while ((cm = cssRe.exec(css)) !== null) {
    var cu = cm[2] || cm[4];
    if (isExternal(cu)) fail('External resource in CSS breaks offline use: ' + cu);
  }

  // 7. Chart.js: loaded before any script that uses it, and every use guarded for offline
  var chartTag = scripts.filter(function (s) { return s.src !== null && CHART_JS.test(s.src); })[0];
  var engine = inline.filter(function (s) { return s.body.indexOf('/* QUIZ-CORE-START */') !== -1; })[0];
  var widgetScripts = inline.filter(function (s) { return s !== engine; });
  widgetScripts.forEach(function (s) {
    var where = 'Script at line ' + lineOf(html, s.start);
    if (/\bnew\s+Chart\s*\(/.test(s.body)) {
      if (!chartTag) fail(where + ' uses Chart.js but the page never loads it (build.js adds it automatically)');
      else if (s.start < chartTag.start) fail(where + ' uses Chart.js before the Chart.js <script src> has loaded — the chart can never render');
      if (!/\bwindow\.Chart\b|typeof\s+Chart\b/.test(s.body)) {
        fail(where + ' calls new Chart(...) without an `if (window.Chart)` guard — offline it throws instead of showing the fallback');
      }
    }
    if (/\bfetch\s*\(|\bXMLHttpRequest\b|\bimport\s*\(/.test(s.body)) {
      warn(where + ' makes a network request (fetch/XHR/import) — that fails when the course is opened from a file');
    }
  });

  // 8. Widget scripts must look up elements that exist (statically, or created by a script)
  var allScriptText = inline.map(function (s) { return s.body; }).join('\n');
  widgetScripts.forEach(function (s) {
    var re = /getElementById\(\s*(['"])([^'"\\]+)\1\s*\)/g;
    var m;
    while ((m = re.exec(s.body)) !== null) {
      var id = m[2];
      if (has(idCount, id)) continue;
      var made = new RegExp('id\\s*=\\s*\\\\?["\']' + escRe(id) + '\\\\?["\']|\\.id\\s*=\\s*["\']' + escRe(id) +
        '["\']|setAttribute\\(\\s*["\']id["\']\\s*,\\s*["\']' + escRe(id) + '["\']');
      if (!made.test(allScriptText)) {
        fail('Script at line ' + lineOf(html, s.start) + ' looks up #' + id + ', which does not exist on the page');
      }
    }
  });

  // 9. Engine integrity: the shipped CSS and engine must be untouched
  checkIntegrity(html, fail, warn);

  // 10. Quiz and quick checks: schema, HTML safety, coverage, scoring and shuffle
  var core = html.match(/\/\* QUIZ-CORE-START \*\/([\s\S]*?)\/\* QUIZ-CORE-END \*\//);
  if (!core) {
    fail('QUIZ-CORE markers missing — quiz cannot be verified');
  } else {
    checkQuiz(core[1], {
      lang: lang, moduleIds: moduleIds, quickcheckIds: quickcheckIds,
      failCount: function () { return fails.length; }
    }, fail, warn, stats);
    if (stats.questions) {
      notes.push('Quiz: ' + stats.questions + ' questions, ' + stats.quickChecks + ' quick checks, scoring + shuffle verified');
    }
  }

  return { fails: fails, warns: warns, notes: notes, stats: stats };
}

function loadPlaywright() {
  var names = ['playwright', 'playwright-core', '@playwright/test'];
  function attempt(base) {
    for (var i = 0; i < names.length; i++) {
      try {
        var mod = require(base ? path.join(base, names[i]) : names[i]);
        if (mod && mod.chromium) return mod;
      } catch (e) { /* try the next one */ }
    }
    return null;
  }
  var found = attempt(null);
  if (found) return found;
  try {
    var root = require('child_process').execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 })
      .toString().trim();
    return root ? attempt(root) : null;
  } catch (e) {
    return null;
  }
}

// Runs inside the page: exercise every widget control and quick check, report what rendered.
function exercisePage() {
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var out = { questions: document.querySelectorAll('#quizRoot [data-qi]').length, emptyChecks: [], widgets: 0 };
  each(document.querySelectorAll('.quickcheck'), function (el) {
    if (!el.querySelector('.qc-opt')) out.emptyChecks.push(el.id);
  });
  each(document.querySelectorAll('.widget'), function (w) {
    out.widgets++;
    each(w.querySelectorAll('input[type=range]'), function (r) {
      [r.min || '0', r.max || '100', r.defaultValue].forEach(function (v) {
        r.value = v;
        r.dispatchEvent(new Event('input', { bubbles: true }));
        r.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    each(w.querySelectorAll('select'), function (s) {
      each(s.options, function (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); });
    });
    // Press each control repeatedly so step-throughs walk to the end and back.
    each(w.querySelectorAll('button, input[type=checkbox], input[type=radio]'), function (b) {
      for (var n = 0; n < 8 && !b.disabled; n++) b.click();
    });
  });
  each(document.querySelectorAll('.quickcheck .qc-opt'), function (b) { b.click(); });
  return out;
}

async function browserCheck(file, stats) {
  var pw = loadPlaywright();
  if (!pw) return { skipped: 'Playwright not installed; open the file in a browser and click through it yourself' };
  var browser;
  try { browser = await pw.chromium.launch(); } catch (e) {
    return { skipped: 'Chromium could not start (' + String(e.message).split('\n')[0] + ')' };
  }
  var result = { fails: [], warns: [], notes: [] };
  var errors = [];
  try {
    var page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', function (e) { errors.push(e.message); });
    page.on('console', function (m) {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR_/i.test(m.text())) errors.push(m.text());
    });
    // Offline on purpose: CDN requests fail fast, so the documented fallbacks get exercised.
    await page.route(/^https?:\/\//, function (route) { return route.abort(); });
    await page.goto(url.pathToFileURL(path.resolve(file)).href, { waitUntil: 'load', timeout: 20000 });
    var state = await page.evaluate(exercisePage);
    uniq(errors).forEach(function (e) { result.fails.push('Runtime error in the browser: ' + e); });
    if (state.questions !== stats.questions) {
      result.fails.push('Final quiz rendered ' + state.questions + ' of ' + stats.questions + ' questions in the browser');
    }
    state.emptyChecks.forEach(function (id) { result.fails.push('Quick check "' + id + '" did not render in the browser'); });
    result.notes.push('Browser: loaded offline in Chromium; exercised ' + state.widgets + ' widgets and every quick check' +
      (errors.length ? '' : ' — no runtime errors'));
    await page.setViewportSize({ width: 390, height: 844 });
    var overflow = await page.evaluate(function () {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    if (overflow > 1) {
      result.warns.push('The page scrolls sideways on a 390px phone (' + overflow + 'px too wide) — check wide SVGs, tables or long unbroken strings');
    }
  } catch (e) {
    result.fails.push('Browser check crashed: ' + String(e.message || e).split('\n')[0]);
  } finally {
    await browser.close();
  }
  return result;
}

async function verifyFile(file, opts) {
  opts = opts || {};
  var res = verifyHtml(fs.readFileSync(file, 'utf8'));
  if (opts.browser === false || res.fails.length) return res;
  var b = await browserCheck(file, res.stats);
  if (b.skipped) {
    res.notes.push('Browser check skipped: ' + b.skipped);
  } else {
    res.fails = res.fails.concat(b.fails);
    res.warns = res.warns.concat(b.warns);
    res.notes = res.notes.concat(b.notes);
  }
  return res;
}

// Prints a verification result; returns the process exit code.
function report(res) {
  res.notes.forEach(function (n) { console.log(n); });
  res.warns.forEach(function (w) { console.log('WARN: ' + w); });
  if (res.fails.length) {
    res.fails.forEach(function (f) { console.error('FAIL: ' + f); });
    console.error(res.fails.length + ' check(s) failed — fix the source files and rebuild.');
    return 1;
  }
  var s = res.stats;
  console.log('ALL CHECKS PASSED (' + s.modules + ' modules, ' + s.widgets + ' widgets, ' + s.questions + ' quiz questions, ' +
    s.quickChecks + ' quick checks, ' + s.scripts + ' script blocks)');
  return 0;
}

module.exports = {
  verifyHtml: verifyHtml, verifyFile: verifyFile, browserCheck: browserCheck,
  loadPlaywright: loadPlaywright, report: report, RTL_LANGS: RTL_LANGS
};

if (require.main === module) {
  var args = process.argv.slice(2);
  var file = args.filter(function (a) { return a.indexOf('--') !== 0; })[0];
  if (!file) { console.error('Usage: node verify.js <course.html> [--no-browser]'); process.exit(1); }
  verifyFile(file, { browser: args.indexOf('--no-browser') === -1 }).then(function (res) {
    process.exit(report(res));
  }, function (e) {
    console.error('FAIL: could not verify ' + file + ': ' + e.message);
    process.exit(1);
  });
}
