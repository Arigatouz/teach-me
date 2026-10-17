#!/usr/bin/env node
'use strict';
// Usage: node build.js <course-dir> [--out <file.html>] [--no-verify] [--no-browser]
// Assembles a course from its source folder into one self-contained HTML file, then runs verify.js.
//
// <course-dir>/
//   course.json        {"title": "…", "shortTitle": "…", "lang": "en", "ui": {…}}  (dir is derived from lang)
//   home.html          inner HTML of the home section
//   m1.html … mN.html  one module each; <script> blocks inside are moved to the end of the page
//   quiz.js            final-quiz question objects, comma-separated
//   quickchecks.js     quick-check entries keyed by div id, comma-separated
// Output defaults to <course-dir>.html beside the folder.

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var verifier = require('./verify.js');

var TEMPLATE = path.join(__dirname, '..', 'assets', 'template.html');
var CHART_JS_TAG = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>';

function BuildError(message) { this.name = 'BuildError'; this.message = message; }
BuildError.prototype = Object.create(Error.prototype);

function read(dir, name, required) {
  var file = path.join(dir, name);
  if (!fs.existsSync(file)) {
    if (required) throw new BuildError('missing ' + name + ' in ' + dir);
    return null;
  }
  return fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
}

function escHtml(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}

// Accept either bare entries or a whole literal ("[…]", "{…}", "var X = …;") and return the entries.
function entries(name, src, open, close) {
  var s = src.trim().replace(/^(?:var|let|const)\s+[A-Za-z_$][\w$]*\s*=\s*/, '').replace(/;\s*$/, '').trim();
  if (s.charAt(0) === open && s.charAt(s.length - 1) === close) {
    try { new vm.Script('(' + s + ')'); s = s.slice(1, -1).trim(); } catch (e) { s = src.trim(); }
  } else {
    s = src.trim();
  }
  if (/<\/script/i.test(s)) {
    throw new BuildError(name + ' contains "</script", which would end the page\'s script early — write it as "<\\/script" or "&lt;/script&gt;"');
  }
  try {
    // Parenthesised so "{ qc1: … }" parses as an object literal, not a block with a label.
    new vm.Script('(' + open + '\n' + s + '\n' + close + ')', { filename: name, lineOffset: -1 });
  } catch (e) {
    var where = String(e.stack || '').split('\n')[0];
    throw new BuildError(name + ' has a syntax error: ' + e.message + (/:\d+$/.test(where) ? ' (at ' + where + ')' : ''));
  }
  return s;
}

function build(dir, opts) {
  opts = opts || {};
  dir = path.resolve(dir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new BuildError(dir + ' is not a folder');

  var cfg;
  try { cfg = JSON.parse(read(dir, 'course.json', true)); } catch (e) {
    if (e instanceof BuildError) throw e;
    throw new BuildError('course.json is not valid JSON: ' + e.message);
  }
  if (typeof cfg.title !== 'string' || !cfg.title.trim()) throw new BuildError('course.json needs a "title"');
  var lang = cfg.lang || 'en';
  if (!/^[a-z]{2,3}(-[a-z0-9]{1,8})*$/i.test(lang)) throw new BuildError('course.json "lang" must be a language code like "en" or "ar"');
  var dirAttr = cfg.dir || (verifier.RTL_LANGS.indexOf(lang.toLowerCase().split('-')[0]) !== -1 ? 'rtl' : 'ltr');
  if (dirAttr !== 'ltr' && dirAttr !== 'rtl') throw new BuildError('course.json "dir" must be "ltr" or "rtl"');
  var ui = cfg.ui || {};
  if (typeof ui !== 'object' || Array.isArray(ui)) throw new BuildError('course.json "ui" must be an object of translated strings');
  Object.keys(ui).forEach(function (k) {
    if (typeof ui[k] !== 'string') throw new BuildError('course.json ui.' + k + ' must be a string');
  });

  var home = read(dir, 'home.html', true);
  var names = fs.readdirSync(dir);
  var warnings = names.filter(function (f) {
    return /\.html?$/i.test(f) && f !== 'home.html' && !/^m\d+\.html$/.test(f);
  }).map(function (f) { return 'Ignored ' + f + ' — module files must be named m1.html, m2.html, …'; });
  var files = names.filter(function (f) { return /^m\d+\.html$/.test(f); })
    .sort(function (a, b) { return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10); });
  if (!files.length) throw new BuildError('no module files — write m1.html, m2.html, … in ' + dir);
  files.forEach(function (f, i) {
    if (parseInt(f.slice(1), 10) !== i + 1) {
      throw new BuildError('module files must be numbered m1…mN without gaps (found ' + f + ' where m' + (i + 1) + '.html was expected)');
    }
  });

  var nav = [];
  var sections = [];
  var scripts = [];
  files.forEach(function (f, i) {
    var id = 'm' + (i + 1);
    var body = read(dir, f, true)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, function (s) { scripts.push(s); return ''; })
      .trim();
    var h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2\s*>/i.exec(body);
    if (!h2) throw new BuildError(f + ' has no <h2> title — its sidebar link is made from it');
    var title = h2[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    nav.push('<a href="#' + id + '" class="nav-link" data-nav="' + id + '"><span class="nav-num">' + (i + 1) + '</span> ' + title + '</a>');
    if (/^<section\b/i.test(body)) {
      sections.push(body); // a hand-written <section>; verify.js checks its id, button and contents
    } else {
      var button = /class\s*=\s*["'][^"']*\bmark-done\b/.test(body) ? '' :
        '\n<button type="button" class="btn ghost mark-done" data-module="' + id + '" data-ui="markDone">Mark module complete</button>';
      sections.push('<section id="' + id + '" class="module">\n' + body + button + '\n</section>');
    }
  });

  // Chart.js must load before the scripts that use it, so it always goes first.
  var isChartTag = function (s) { return /<script\b[^>]*\bsrc\s*=\s*["'][^"']*chart(\.umd)?(\.min)?\.js["']/i.test(s); };
  var widgetScripts = scripts.filter(function (s) { return !isChartTag(s); });
  var usesChart = widgetScripts.some(function (s) { return /\bnew\s+Chart\s*\(/.test(s); });
  if (usesChart) widgetScripts.unshift(scripts.filter(isChartTag)[0] || CHART_JS_TAG);

  var values = {
    LANG: lang,
    DIR: dirAttr,
    COURSE_TITLE: escHtml(cfg.title.trim()),
    SHORT_TITLE: escHtml(String(cfg.shortTitle || cfg.title).trim()),
    NAV_LINKS: nav.join('\n    '),
    HOME_SECTION: home.trim(),
    MODULE_SECTIONS: sections.join('\n\n    '),
    UI_STRINGS: JSON.stringify(ui, null, 2).replace(/</g, '\\u003c'),
    QUIZ_QUESTIONS: entries('quiz.js', read(dir, 'quiz.js', true), '[', ']'),
    QUICK_CHECKS: entries('quickchecks.js', read(dir, 'quickchecks.js', false) || '', '{', '}'),
    WIDGET_SCRIPTS: widgetScripts.join('\n')
  };
  var template = fs.readFileSync(TEMPLATE, 'utf8').replace(/\r\n?/g, '\n');
  // One pass with a replacer function: inserted content is never re-scanned for placeholders,
  // and "$&", "$1"… in course text stay literal (string replacements would expand them).
  var html = template.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, function (m, name) {
    if (!Object.prototype.hasOwnProperty.call(values, name)) {
      throw new BuildError('template placeholder ' + m + ' has no value — build.js and assets/template.html are out of sync');
    }
    return values[name];
  });

  var out = opts.out ? path.resolve(opts.out) : dir + '.html';
  fs.writeFileSync(out, html);
  return { file: out, modules: files.length, warnings: warnings };
}

module.exports = { build: build, BuildError: BuildError };

if (require.main === module) {
  var args = process.argv.slice(2);
  var outAt = args.indexOf('--out');
  var out = outAt !== -1 ? args[outAt + 1] : null;
  var src = args.filter(function (a, i) { return a.indexOf('--') !== 0 && (outAt === -1 || i !== outAt + 1); })[0];
  if (!src || (outAt !== -1 && !out)) {
    console.error('Usage: node build.js <course-dir> [--out <file.html>] [--no-verify] [--no-browser]');
    process.exit(1);
  }
  var result;
  try { result = build(src, { out: out }); } catch (e) {
    if (!(e instanceof BuildError)) throw e;
    console.error('BUILD FAILED: ' + e.message);
    process.exit(1);
  }
  result.warnings.forEach(function (w) { console.log('WARN: ' + w); });
  console.log('Built ' + result.file + ' (' + result.modules + ' modules)');
  if (args.indexOf('--no-verify') !== -1) process.exit(0);
  verifier.verifyFile(result.file, { browser: args.indexOf('--no-browser') === -1 }).then(function (res) {
    process.exit(verifier.report(res));
  }, function (e) {
    console.error('FAIL: could not verify ' + result.file + ': ' + e.message);
    process.exit(1);
  });
}
