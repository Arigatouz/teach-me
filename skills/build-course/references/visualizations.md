# Visualizations

Every module MUST contain at least one interactive drawing (Type 2 below) — a visual the learner manipulates, not just looks at. verify.js fails modules without one. Static SVG diagrams (Type 1) and charts (Type 3) are supplements. A visual that just decorates is worse than none. Every visual gets a one-line caption or readout that says what to notice.

```html
<figure class="viz">
  <!-- svg here -->
  <figcaption>One-line caption explaining what to look at.</figcaption>
</figure>
```

## Type 1 — Static SVG diagram (supplement)

For structures, flows, hierarchies, comparisons, timelines. Hand-write inline SVG. Rules that keep them clean and readable:

- `viewBox="0 0 640 H"`, no fixed width/height attributes
- Font: `font-family="system-ui"` on a group; labels 14px, captions 12px
- Palette: node fills `#eef2ff` (accent tint), strokes `#4f46e5`, text `#1a1a2e`; use `#ecfdf3`/`#16803c` and `#fef2f2`/`#b91c1c` only for good/bad semantics
- Boxes: `rx="8"`, stroke-width 1.5; arrows via one shared `<defs><marker>` whose id carries the module prefix, because ids must be unique across the whole page:

```html
<defs><marker id="m1Arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#4f46e5"/></marker></defs>
```

- Max 6 boxes per diagram; label text ≤4 words per box; split bigger ideas into two diagrams
- Center text: `text-anchor="middle"` with x at box center, y at box center + 5
- SVGs stay left-to-right in RTL courses (coordinates don't mirror). A `<text>` that mixes directions — Arabic with Latin, digits or punctuation — needs `direction="rtl"`

## Type 2 — Interactive drawing (mandatory, at least one per module)

Pick the pattern that fits the module's central concept: a parameter to vary → slider; a sequence to step through → step-through; discrete cases to compare → toggle. Wrap the widget in `<div class="widget card">` — verify.js looks for it in each module.

Put the widget's `<script>` at the end of its module file; build.js moves it to the end of the page, where every element already exists. Wrap each script in an IIFE and give every id one prefix per widget (`w1…`, `w2…`) so widgets never collide. verify.js checks that each `getElementById` names an element that exists and, when Playwright is installed, presses every control in a real browser — so a widget that throws fails the build.

### Slider → live update

```html
<div class="widget card" role="group" aria-label="Compound interest explorer">
  <label for="w1Rate">Interest rate: <strong id="w1RateOut">5%</strong></label>
  <input type="range" id="w1Rate" min="1" max="15" value="5" step="1">
  <svg viewBox="0 0 640 200" id="w1Chart" aria-hidden="true"></svg>
  <p class="widget-read" id="w1Summary"></p>
</div>
<script>
(function () {
  var rate = document.getElementById('w1Rate');
  function draw() {
    var r = Number(rate.value) / 100;
    document.getElementById('w1RateOut').textContent = rate.value + '%';
    var pts = [];
    for (var yr = 0; yr <= 20; yr++) {
      var v = 1000 * Math.pow(1 + r, yr);
      pts.push((20 + yr * 30) + ',' + (190 - Math.min(180, v / 60)));
    }
    document.getElementById('w1Chart').innerHTML =
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#4f46e5" stroke-width="2.5"/>' +
      '<line x1="20" y1="190" x2="620" y2="190" stroke="#e4e4ea"/>';
    document.getElementById('w1Summary').textContent =
      '$1,000 becomes $' + Math.round(1000 * Math.pow(1 + r, 20)).toLocaleString() + ' after 20 years.';
  }
  rate.addEventListener('input', draw);
  draw();
})();
</script>
```

Adapt the math and drawing to the concept; keep the shape: one control, immediate redraw, a one-sentence readout in words. The readout matters — it translates the picture into meaning.

### Step-through sequence

For algorithms, protocols, multi-stage processes. Render N states of an SVG; back/next buttons swap them:

```html
<div class="widget card" role="group" aria-label="How a request is handled">
  <div id="w2Stage"></div>
  <div class="widget-controls">
    <button type="button" class="btn ghost" id="w2Prev" aria-label="Previous step">‹ Back</button>
    <span class="widget-label" id="w2Label"></span>
    <button type="button" class="btn" id="w2Next" aria-label="Next step">Next ›</button>
  </div>
</div>
<script>
(function () {
  var steps = [
    { svg: '<svg viewBox="0 0 640 160">…state 1…</svg>', text: 'Step 1: what happens first.' },
    { svg: '<svg viewBox="0 0 640 160">…state 2…</svg>', text: 'Step 2: what happens next.' }
  ];
  var i = 0;
  function show() {
    document.getElementById('w2Stage').innerHTML = steps[i].svg;
    document.getElementById('w2Label').textContent = (i + 1) + '/' + steps.length + ' — ' + steps[i].text;
    document.getElementById('w2Prev').disabled = i === 0;
    document.getElementById('w2Next').disabled = i === steps.length - 1;
  }
  document.getElementById('w2Prev').addEventListener('click', function () { i--; show(); });
  document.getElementById('w2Next').addEventListener('click', function () { i++; show(); });
  show();
})();
</script>
```

### Toggle / click-to-explore

For discrete cases the learner compares (before/after, with/without, scenario A vs B). A row of buttons swaps the drawing and readout — same skeleton as step-through, with named cases instead of back/next:

```html
<div class="widget card" role="group" aria-label="Simple vs compound interest">
  <div class="widget-controls" id="w3Cases"></div>
  <div id="w3Stage"></div>
  <p class="widget-read" id="w3Read"></p>
</div>
<script>
(function () {
  var cases = [
    { name: 'Simple interest', svg: '<svg viewBox="0 0 640 160">…</svg>', text: 'Grows in a straight line.' },
    { name: 'Compound interest', svg: '<svg viewBox="0 0 640 160">…</svg>', text: 'The curve bends upward.' }
  ];
  var bar = document.getElementById('w3Cases');
  var buttons = cases.map(function (c, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ghost';
    b.textContent = c.name;
    b.addEventListener('click', function () { show(i); });
    bar.appendChild(b);
    return b;
  });
  function show(i) {
    buttons.forEach(function (b, j) { b.setAttribute('aria-pressed', String(i === j)); });
    document.getElementById('w3Stage').innerHTML = cases[i].svg;
    document.getElementById('w3Read').textContent = cases[i].text;
  }
  show(0);
})();
</script>
```

## Type 3 — Chart.js (use sparingly)

Only for real data comparisons where a proper chart beats hand-drawn SVG (research-sourced statistics, multi-series data). build.js loads Chart.js from cdnjs, ahead of your scripts, whenever one of them calls `new Chart(` — don't add the `<script src>` yourself. Guard every use so the course still works offline; verify.js fails an unguarded `new Chart(`:

```html
<figure class="viz">
  <canvas id="w4Chart" height="220" role="img" aria-label="Chart: …"></canvas>
  <p class="chart-fallback" id="w4Fallback" hidden>This chart needs an internet connection the first time the course is opened.</p>
  <figcaption>What the chart shows.</figcaption>
</figure>
<script>
(function () {
  if (window.Chart) {
    new Chart(document.getElementById('w4Chart'), { type: 'bar', data: { … },
      options: { plugins: { legend: { display: false } }, responsive: true } });
  } else {
    document.getElementById('w4Fallback').hidden = false;
  }
})();
</script>
```

If the same information can be shown with a hand-drawn SVG bar/line, prefer the SVG — zero dependencies.

## Choosing per concept

| Concept smells like… | Use |
|---|---|
| "As X increases, Y changes" | Slider widget |
| "First this, then that, then…" | Step-through widget |
| "Compare case A with case B" | Toggle widget |
| "X is made of / flows into / comes before Y" | Static SVG diagram (as supplement) |
| "Here are the actual numbers across categories" | SVG bars; Chart.js only if multi-series |

If a module seems to have no interactive angle, find one: turn its central definition into a compare-cases toggle, or its example into a step-through. Every concept has a "what happens if…" — that's the widget.
