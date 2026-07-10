# Visualizations

Every module MUST contain at least one interactive drawing (Type 2 below) — a visual the learner manipulates, not just looks at. The verifier fails modules without one. Static SVG diagrams (Type 1) and charts (Type 3) are supplements. A visual that just decorates is worse than none. All visuals live inside a `.viz` figure or `.widget` card with a one-line caption or readout.

```html
<figure class="viz">
  <!-- svg or widget here -->
  <figcaption>One-line caption explaining what to look at.</figcaption>
</figure>
```

```css
.viz { margin: 28px 0; text-align: center; }
.viz svg { max-width: 100%; height: auto; }
.viz figcaption { font-size: 13px; color: var(--ink-faint); margin-top: 8px; }
```

## Type 1 — Static SVG diagram (supplement)

For structures, flows, hierarchies, comparisons, timelines. Hand-write inline SVG. Rules that keep them clean and readable:

- `viewBox="0 0 640 H"`, no fixed width/height attributes
- Font: `font-family="system-ui"` on a group; labels 14px, captions 12px
- Palette: node fills `#eef2ff` (accent tint), strokes `#4f46e5`, text `#1a1a2e`; use `#ecfdf3`/`#16803c` and `#fef2f2`/`#b91c1c` only for good/bad semantics
- Boxes: `rx="8"`, stroke-width 1.5; arrows via one shared `<defs><marker>`:

```html
<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#4f46e5"/></marker></defs>
```

- Max 6 boxes per diagram; label text ≤4 words per box; split bigger ideas into two diagrams
- Center text: `text-anchor="middle"` with x at box center, y at box center + 5

## Type 2 — Interactive drawing (mandatory, one per module)

Every module gets one. Pick the pattern that fits the module's central concept: a parameter to vary → slider; a sequence to step through → step-through; discrete cases to compare → toggle. Wrap the widget in `<div class="widget card">` — the verifier looks for `class="widget` inside each module section. Three tested patterns:

### Slider → live update

```html
<div class="widget card" role="group" aria-label="Compound interest explorer">
  <label for="wRate">Interest rate: <strong id="wRateOut">5%</strong></label>
  <input type="range" id="wRate" min="1" max="15" value="5" step="1">
  <svg viewBox="0 0 640 200" id="wChart" aria-hidden="true"></svg>
  <p class="widget-read" id="wSummary"></p>
</div>
<script>
(function () {
  var rate = document.getElementById('wRate');
  function draw() {
    var r = Number(rate.value) / 100;
    document.getElementById('wRateOut').textContent = rate.value + '%';
    var pts = [];
    for (var yr = 0; yr <= 20; yr++) {
      var v = 1000 * Math.pow(1 + r, yr);
      pts.push((20 + yr * 30) + ',' + (190 - Math.min(180, v / 60)));
    }
    document.getElementById('wChart').innerHTML =
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#4f46e5" stroke-width="2.5"/>' +
      '<line x1="20" y1="190" x2="620" y2="190" stroke="#e4e4ea"/>';
    document.getElementById('wSummary').textContent =
      '$1,000 becomes $' + Math.round(1000 * Math.pow(1 + r, 20)).toLocaleString() + ' after 20 years.';
  }
  rate.addEventListener('input', draw);
  draw();
})();
</script>
```

Adapt the math and drawing to the concept; keep the shape: one control, immediate redraw, a one-sentence readout in words. The readout matters — it translates the picture into meaning.

### Step-through sequence

For algorithms, protocols, multi-stage processes. Render N states of an SVG; prev/next buttons swap them:

```html
<div class="widget card" role="group" aria-label="Step-through demo">
  <div id="stepStage"></div>
  <div class="widget-controls">
    <button class="btn ghost" id="stepPrev" aria-label="Previous step">‹ Back</button>
    <span id="stepLabel"></span>
    <button class="btn" id="stepNext" aria-label="Next step">Next ›</button>
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
    document.getElementById('stepStage').innerHTML = steps[i].svg;
    document.getElementById('stepLabel').textContent = (i + 1) + '/' + steps.length + ' — ' + steps[i].text;
    document.getElementById('stepPrev').disabled = i === 0;
    document.getElementById('stepNext').disabled = i === steps.length - 1;
  }
  document.getElementById('stepPrev').addEventListener('click', function () { i--; show(); });
  document.getElementById('stepNext').addEventListener('click', function () { i++; show(); });
  show();
})();
</script>
```

### Toggle / click-to-explore

For discrete cases the learner compares (before/after, with/without, scenario A vs B). Two or three `.qc-opt`-style buttons swap the drawing and readout — same skeleton as step-through but with named cases instead of prev/next:

```html
<div class="widget card" role="group" aria-label="Case explorer">
  <div class="widget-controls" id="w3Cases"></div>
  <div id="w3Stage"></div>
  <p class="widget-read" id="w3Read"></p>
</div>
<script>
(function () {
  var cases = [
    { name: 'Simple interest', svg: '<svg viewBox="0 0 640 160">…</svg>', text: 'Grows in a straight line.' },
    { name: 'Compound interest', svg: '<svg viewBox="0 0 640 160">…</svg>', text: 'Curve bends upward.' }
  ];
  var bar = document.getElementById('w3Cases');
  cases.forEach(function (c, i) {
    var b = document.createElement('button');
    b.className = 'btn ghost';
    b.textContent = c.name;
    b.addEventListener('click', function () { show(i); });
    bar.appendChild(b);
  });
  function show(i) {
    document.getElementById('w3Stage').innerHTML = cases[i].svg;
    document.getElementById('w3Read').textContent = cases[i].text;
  }
  show(0);
})();
</script>
```

Widget CSS:

```css
.widget { text-align: left; }
.widget input[type=range] { width: 100%; margin: 10px 0; accent-color: var(--accent); }
.widget-read { font-size: 15px; color: var(--ink-soft); margin-top: 8px; }
.widget-controls { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
#stepLabel { font-size: 14px; color: var(--ink-soft); flex: 1; text-align: center; }
```

Wrap every widget in its own IIFE with unique element ids (prefix per widget: `w1`, `w2`…) so multiple widgets never collide.

## Type 3 — Chart.js (use sparingly)

Only for real data comparisons where a proper chart beats hand-drawn SVG (research-sourced statistics, multi-series data). Load once before the closing `</body>`:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
```

Wrap usage defensively so the course still works offline:

```html
<div class="viz"><canvas id="c1" height="220" aria-label="Chart: …" role="img"></canvas>
<p class="chart-fallback" hidden>Chart requires an internet connection on first open.</p></div>
<script>
if (window.Chart) {
  new Chart(document.getElementById('c1'), { type: 'bar', data: {…},
    options: { plugins: { legend: { display: false } }, responsive: true } });
} else {
  document.querySelector('.chart-fallback').hidden = false;
}
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
