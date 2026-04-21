(function () {
  'use strict';

  const DASHBOARD_URL = '/dashboard.json';
  const charts = {};

  // ---------------------------------------------------------------
  // Plain-language assessment mapping
  //
  // Reviewer verdicts (ACCEPT/REJECT/INCONCLUSIVE/KEEP/DISCARD/
  // KEEP_WITH_CONCERNS) are never shown raw. Every combination maps
  // to a user-visible assessment string. Non-DONE experiment statuses
  // map too so the results table never shows raw status codes.
  // ---------------------------------------------------------------
  function plainAssessment(exp) {
    const s = exp.status || '';
    if (s === 'BLOCKED_TAMPER') return { text: 'tamper detected', cls: 'flag' };
    if (s === 'BLOCKED_BUILD')  return { text: 'build failed', cls: 'flag' };
    if (s === 'BLOCKED_PREFLIGHT') return { text: 'pre-flight failed', cls: 'flag' };
    if (s === 'CRASHED_TIMEOUT') return { text: 'timed out', cls: 'flag' };
    if (s === 'CRASHED_OOM') return { text: 'out of memory', cls: 'flag' };
    if (s === 'CRASHED_NO_METRICS') return { text: 'no metrics emitted', cls: 'flag' };
    if (s === 'CRASHED') return { text: 'crashed', cls: 'flag' };

    const m = exp.metric_reviewer_verdict;
    const g = exp.strategy_reviewer_verdict;

    if (m === 'REJECT') return { text: 'failed integrity check', cls: 'flag' };
    if (m === 'BLOCKED') return { text: 'metric reviewer blocked', cls: 'flag' };
    if (m === 'INCONCLUSIVE') return { text: 'too close to baseline', cls: '' };

    if (m === 'ACCEPT' && g === 'KEEP') return { text: 'honest winner', cls: 'win' };
    if (m === 'ACCEPT' && g === 'KEEP_WITH_CONCERNS') return { text: 'overfit · flagged', cls: 'flag' };
    if (m === 'ACCEPT' && g === 'DISCARD') return { text: 'dominated', cls: '' };
    if (m === 'ACCEPT' && g === 'BLOCKED') return { text: 'strategy reviewer blocked', cls: 'flag' };

    if (m === 'ACCEPT' && !g) return { text: 'accepted', cls: '' };

    return { text: '—', cls: '' };
  }

  // ---------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------
  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDuration(seconds) {
    if (seconds == null) return '—';
    if (seconds < 60) return seconds + 's';
    if (seconds < 3600) return Math.round(seconds / 60) + 'm';
    return (seconds / 3600).toFixed(1) + 'h';
  }

  function showError(message) {
    const mount = document.getElementById('error-banner-mount');
    if (!mount) return;
    mount.innerHTML = '<div class="error-banner">' + message + '</div>';
  }

  function clearError() {
    const mount = document.getElementById('error-banner-mount');
    if (mount) mount.innerHTML = '';
  }

  async function fetchSpec() {
    try {
      const res = await fetch(DASHBOARD_URL, { cache: 'no-store' });
      if (!res.ok) { showError('Failed to fetch dashboard spec: HTTP ' + res.status); return null; }
      return await res.json();
    } catch (err) {
      showError('Failed to fetch dashboard spec: ' + err.message);
      return null;
    }
  }

  // Panel renderers (filled in by subsequent tasks)
  function renderStrip(spec) {
    const el = document.getElementById('strip');
    if (!el) return;
    const h = spec.header || {};
    const integ = h.integrity_summary || { verified: 0, advisory: 0, blocked: 0 };
    const dotCls = integ.blocked > 0 || integ.advisory > 0 ? 'dot flag' : 'dot';
    const advisoryText = integ.advisory > 0
      ? '<span><span class="' + dotCls + '"></span><span class="v flag">' + integ.advisory + ' advisory</span></span>'
      : integ.blocked > 0
        ? '<span><span class="dot flag"></span><span class="v flag">' + integ.blocked + ' blocked</span></span>'
        : '<span><span class="dot"></span><span class="v">clean</span></span>';
    const wall = formatDuration(h.total_wall_clock_seconds);
    const batches = h.total_batches || 1;
    const experiments = h.total_experiments || 0;
    const planName = h.plan_name || spec.plan_id || '';
    const branch = spec.branch || '';
    el.innerHTML = [
      '<span><span class="dot"></span><span class="v">batch-' + String(batches).padStart(2, '0') + '</span></span>',
      '<span class="sep">·</span>',
      '<span>' + escapeHtml(planName) + '</span>',
      '<span class="sep">·</span>',
      '<span>' + experiments + ' experiments</span>',
      '<span class="sep">·</span>',
      '<span>' + wall + '</span>',
      '<span class="sep">·</span>',
      advisoryText,
      '<span class="right">branch ' + escapeHtml(branch) + '</span>'
    ].join('');
  }
  function buildHeadline(spec) {
    if (spec.header && spec.header.recommendation_headline) {
      return escapeHtml(spec.header.recommendation_headline);
    }
    const exps = (spec.experiments || []).filter(function (e) { return e.status === 'DONE'; });
    if (exps.length === 0) return 'No experiment completed this batch.';

    const assessed = exps.map(function (e) { return { e: e, a: plainAssessment(e) }; });
    const winner = assessed.find(function (x) { return x.a.text === 'honest winner'; });
    const overfit = assessed.find(function (x) { return x.a.text === 'overfit · flagged'; });

    if (winner && overfit) {
      return 'Experiment <span class="win">' + escapeHtml(winner.e.id) + '</span> is the honest winner. <span class="flag">' + escapeHtml(overfit.e.id) + '</span> scored better but overfit the training data — flagged and discarded.';
    }
    if (winner) {
      return 'Experiment <span class="win">' + escapeHtml(winner.e.id) + '</span> is the honest winner.';
    }
    if (overfit) {
      return '<span class="flag">' + escapeHtml(overfit.e.id) + '</span> scored best but violated the training-vs-test gap bound.';
    }
    return 'No experiment cleared the baseline by a meaningful margin this batch.';
  }

  function buildHeroParagraphs(spec) {
    const exps = spec.experiments || [];
    const count = exps.length;
    const done = exps.filter(function (e) { return e.status === 'DONE'; });
    const winner = done.map(function (e) { return { e: e, a: plainAssessment(e) }; })
                      .find(function (x) { return x.a.text === 'honest winner'; });
    const lines = [];
    lines.push('<p>This batch ran <strong>' + count + ' experiments</strong>. ' + (done.length === count ? 'All completed.' : done.length + ' of ' + count + ' completed cleanly.') + '</p>');
    if (winner) {
      const m = winner.e.metrics || {};
      const firstKey = Object.keys(m)[0];
      if (firstKey !== undefined) {
        const primary = m[firstKey];
        const primaryFmt = typeof primary === 'number' ? primary.toFixed(4) : escapeHtml(primary);
        lines.push('<p>The honest winner is <strong>' + escapeHtml(winner.e.id) + '</strong>, with error <span class="mono">' + primaryFmt + '</span> on held-out data. Train-vs-test gap stayed inside the locked bound.</p>');
      } else {
        lines.push('<p>The honest winner is <strong>' + escapeHtml(winner.e.id) + '</strong>. Train-vs-test gap stayed inside the locked bound. (Metrics blob was empty — check the experiment output.)</p>');
      }
    }
    const flags = (spec.trust && spec.trust.per_experiment_flags) || [];
    if (flags.length > 0) {
      const f = flags[0];
      lines.push('<p>Experiment <strong>' + escapeHtml(f.exp_id) + '</strong> violated the integrity rule: ' + escapeHtml(f.detail || f.reason) + ' The integrity check caught it automatically.</p>');
    }
    return lines.join('');
  }

  function renderHero(spec) {
    const el = document.getElementById('hero');
    if (!el) return;
    const headline = buildHeadline(spec);
    const paragraphs = buildHeroParagraphs(spec);
    el.innerHTML = '<div class="eyebrow">Verdict</div><h1>' + headline + '</h1>' + paragraphs;
  }
  function getOrInitChart(elId) {
    if (charts[elId]) return charts[elId];
    const el = document.getElementById(elId);
    if (!el) return null;
    const c = echarts.init(el);
    charts[elId] = c;
    return c;
  }

  function echartsBase() {
    // Themed to the palette. Never rely on the built-in 'dark' theme.
    return {
      backgroundColor: 'transparent',
      textStyle: { color: '#ddd4c4', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      title: { textStyle: { color: '#f5ecd8', fontFamily: 'IBM Plex Serif, Georgia, serif', fontSize: 14, fontWeight: 500 } },
      axisPointer: { lineStyle: { color: '#3e3425' } },
      tooltip: {
        backgroundColor: '#211c15',
        borderColor: '#3e3425',
        textStyle: { color: '#f5ecd8', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }
      }
    };
  }

  function axisStyle() {
    return {
      axisLine: { lineStyle: { color: '#3e3425' } },
      axisTick: { lineStyle: { color: '#3e3425' } },
      axisLabel: { color: '#a89a82', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
      splitLine: { lineStyle: { color: '#2e2820', type: 'dashed' } },
      nameTextStyle: { color: '#6a5e48', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }
    };
  }

  function renderEvidence(spec) {
    const mount = document.getElementById('evidence');
    if (!mount) return;
    // Dispose stale chart instances whose DOM containers are about to be destroyed.
    Object.keys(charts).forEach(function (k) {
      if (charts[k] && typeof charts[k].dispose === 'function') charts[k].dispose();
      delete charts[k];
    });
    mount.innerHTML = '';
    let n = 0;

    const panels = [
      { cond: hasLearningCurves(spec), make: function () { n++; return learningCurvesSection(spec, n); } },
      { cond: hasPareto(spec),         make: function () { n++; return paretoSection(spec, n); } },
      { cond: hasTrust(spec),          make: function () { n++; return trustSection(spec, n); } },
      { cond: hasResults(spec),        make: function () { n++; return resultsSection(spec, n); } },
      { cond: hasDiminishing(spec),    make: function () { n++; return diminishingSection(spec, n); } },
      { cond: hasAttribution(spec),    make: function () { n++; return attributionSection(spec, n); } }
    ];

    panels.forEach(function (p) {
      if (!p.cond) return;
      const built = p.make();
      mount.appendChild(built.wrapper);
      if (built.afterMount) built.afterMount();
    });
  }

  function hasLearningCurves(spec) {
    const exps = spec.experiments || [];
    return exps.some(function (e) { return e.history && Array.isArray(e.history.points) && e.history.points.length > 0; });
  }
  function hasPareto(spec)        { return spec.pareto && (spec.pareto.points || []).length >= 2; }
  function hasTrust(spec)         { return spec.trust && (((spec.trust.per_experiment_flags || []).length > 0) || spec.trust.summary_counts); }
  function hasResults(spec)       { return (spec.experiments || []).length > 0; }
  function hasDiminishing(spec)   { return spec.next && (spec.next.diminishing_returns_points || []).length >= 2 && ((spec.header && spec.header.total_batches) || 1) >= 2; }
  function hasAttribution(spec)   { return spec.next && spec.next.attribution && typeof spec.next.attribution.architecture === 'number'; }

  // Section builders — filled in by tasks 9–11 (stubs now).
  function learningCurvesSection(spec, n) {
    const inner = '<div class="chart-wrap"><div id="panel-learning-curves" class="echarts-container"></div><div class="legend" id="learning-legend"></div><p class="chart-note" id="learning-note"></p></div>';
    const wrapper = sectionShell('Evidence · ' + pad(n), 'Learning curves', 'How each model\'s error changed during training. Training error falling while test error rises is the signature of overfitting.', inner);
    return {
      wrapper: wrapper,
      afterMount: function () {
        const chart = getOrInitChart('panel-learning-curves');
        if (!chart) return;
        const exps = (spec.experiments || []).filter(function (e) { return e.history && (e.history.points || []).length > 0; });
        if (exps.length === 0) return;
        const series = [];
        const legendParts = [];
        exps.forEach(function (e) {
          const a = plainAssessment(e);
          const color = a.cls === 'win' ? '#c98c3c' : a.cls === 'flag' ? '#c47b4a' : '#8a6540';
          const train = e.history.points.map(function (p) { return [p.iteration, p.train_metric]; });
          const val = e.history.points.map(function (p) { return [p.iteration, p.val_metric]; });
          series.push({ name: e.id + ' train', type: 'line', data: train, showSymbol: false, lineStyle: { color: color, width: 2 } });
          series.push({ name: e.id + ' test',  type: 'line', data: val,   showSymbol: false, lineStyle: { color: color, width: 2, type: 'dashed' } });
          legendParts.push('<span style="color:' + color + ';"><span class="swatch"></span>' + escapeHtml(e.id) + ' train</span>');
          legendParts.push('<span style="color:' + color + ';"><span class="swatch dash"></span>' + escapeHtml(e.id) + ' test</span>');
        });
        const opt = Object.assign({}, echartsBase(), {
          grid: { left: 60, right: 30, top: 20, bottom: 40, containLabel: true },
          xAxis: Object.assign({ type: 'value', name: ((exps[0].history.x_axis) || 'iteration') + ' →' }, axisStyle()),
          yAxis: Object.assign({ type: 'value', name: 'error (lower is better) ↓' }, axisStyle()),
          series: series
        });
        chart.setOption(opt);
        document.getElementById('learning-legend').innerHTML = legendParts.join('');
        document.getElementById('learning-note').textContent = 'Curves are drawn from each experiment\'s recorded per-iteration history. Experiments with missing history do not appear.';
      }
    };
  }

  function paretoSection(spec, n) {
    const inner = '<div class="chart-wrap"><div id="panel-pareto" class="echarts-container"></div></div>';
    const wrapper = sectionShell('Evidence · ' + pad(n), 'Accuracy vs model size', 'Each dot is one experiment. Further left = smaller model. Further down = more accurate. Integrity-flagged experiments are outlined in the flag colour.', inner);
    return {
      wrapper: wrapper,
      afterMount: function () {
        const chart = getOrInitChart('panel-pareto');
        if (!chart) return;
        const exps = spec.experiments || [];
        const flaggedSet = new Set(((spec.trust && spec.trust.per_experiment_flags) || []).map(function (f) { return f.exp_id; }));
        const paretoById = {};
        ((spec.pareto && spec.pareto.points) || []).forEach(function (p) { paretoById[p.exp_id] = p; });

        const data = exps
          .filter(function (e) { return paretoById[e.id]; })
          .map(function (e) {
            const p = paretoById[e.id];
            const isFlagged = flaggedSet.has(e.id);
            const onFront = (p.dominated_by || []).length === 0;
            const fill = isFlagged ? '#c47b4a' : onFront ? '#c98c3c' : '#6a5e48';
            const stroke = isFlagged ? '#c98c3c' : 'transparent';
            return {
              value: [p.x, p.y],
              name: e.id,
              itemStyle: { color: fill, borderColor: stroke, borderWidth: isFlagged ? 2 : 0 },
              symbolSize: onFront || isFlagged ? 14 : 8,
              label: { show: true, position: 'right', formatter: e.id, color: '#a89a82', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }
            };
          });

        const opt = Object.assign({}, echartsBase(), {
          grid: { left: 60, right: 120, top: 20, bottom: 40, containLabel: true },
          xAxis: Object.assign({ type: 'value', name: 'parameters (bigger model) →' }, axisStyle()),
          yAxis: Object.assign({ type: 'value', name: 'error ↓ (more accurate)' }, axisStyle()),
          series: [{ type: 'scatter', data: data }]
        });
        chart.setOption(opt);
      }
    };
  }
  function trustSection(spec, n) {
    const flags = (spec.trust && spec.trust.per_experiment_flags) || [];
    const summary = (spec.trust && spec.trust.summary_counts) || {};
    const verified = summary.verified || 0;
    const total = (verified + (summary.advisory || 0) + (summary.blocked || 0)) || (spec.experiments || []).length;

    const cards = flags.map(function (f) {
      const severity = (f.severity || 'advisory').toUpperCase();
      return '<div class="advisory">'
        + '<div class="head">' + escapeHtml(severity) + ' · ' + escapeHtml(f.exp_id) + '</div>'
        + '<div class="body">' + escapeHtml(plainReason(f)) + '</div>'
        + '<div class="tech">' + escapeHtml(techFor(f, spec)) + '</div>'
        + '</div>';
    }).join('');

    const cleanLine = '<div class="clean">' + verified + ' of ' + total + ' experiments cleared every rule. No tampering detected in any training script between build and execution.</div>';

    const wrapper = sectionShell('Evidence · ' + pad(n), 'Integrity check', 'Rules locked in before training. Automated check against every experiment.', cards + cleanLine);
    return { wrapper: wrapper, afterMount: function () {} };
  }

  function plainReason(f) {
    if (f.reason === 'generalization_gap_bound_violation') {
      return 'Training-vs-test gap exceeded the bound locked in the hypothesis. The model overfit the training data — it will not generalise well to unseen examples.';
    }
    if (f.reason === 'tamper_detected') {
      return 'A file in the experiment worktree changed between build review and run. The integrity chain is broken.';
    }
    if (f.reason === 'parameter_bound_violation') {
      return 'Trainable parameter count exceeded the architecture bound locked in the hypothesis.';
    }
    return f.detail || f.reason || 'Integrity rule violated.';
  }

  function techFor(f, spec) {
    const bits = [];
    if (f.detail) bits.push(f.detail);
    const hyp = spec.hypothesis_integrity_hash || '';
    if (hyp) {
      const display = hyp.length >= 14
        ? hyp.slice(0, 8) + '…' + hyp.slice(-6)
        : hyp;
      bits.push('hypothesis hash ' + display);
    }
    return bits.join(' · ');
  }
  function resultsSection(spec, n) {
    const exps = spec.experiments || [];
    const flaggedSet = new Set(((spec.trust && spec.trust.per_experiment_flags) || []).map(function (f) { return f.exp_id; }));

    const rows = exps.map(function (e) {
      const a = plainAssessment(e);
      const metrics = e.metrics || {};
      const keys = Object.keys(metrics);
      const valKey = keys.find(function (k) { return k.startsWith('val_') || k === 'val'; });
      const testKey = keys.find(function (k) { return k.startsWith('test_') || k === 'test'; });
      const primary = valKey ? metrics[valKey] : (keys[0] ? metrics[keys[0]] : null);
      const testVal = testKey ? metrics[testKey] : null;
      const gap = metrics.gen_gap != null ? metrics.gen_gap : null;
      const isWinner = a.text === 'honest winner';
      const isConcern = flaggedSet.has(e.id) || a.cls === 'flag';
      const rowCls = isWinner ? 'winner' : isConcern ? 'concern' : '';
      const model = humanModelName(e);
      const params = e.params_trainable != null ? e.params_trainable.toLocaleString() : '—';

      return '<tr' + (rowCls ? ' class="' + rowCls + '"' : '') + '>'
        + '<td>' + escapeHtml(e.id) + (isWinner ? ' ★' : '') + '</td>'
        + '<td class="dim">' + escapeHtml(model) + '</td>'
        + '<td class="num">' + fmt(primary) + '</td>'
        + '<td class="num">' + fmt(testVal) + '</td>'
        + '<td class="num"' + (gap != null && Math.abs(gap) > 0.10 ? ' style="color: var(--flag);"' : '') + '>' + fmtPct(gap) + '</td>'
        + '<td class="num">' + params + '</td>'
        + '<td><span class="assess' + (a.cls ? ' ' + a.cls : '') + '">' + escapeHtml(a.text) + '</span></td>'
        + '</tr>';
    }).join('');

    const html =
      '<table class="results">'
      + '<thead><tr>'
      + '<th>exp</th><th>model family</th>'
      + '<th class="num">error (val)</th><th class="num">error (test)</th>'
      + '<th class="num">train-vs-test gap</th>'
      + '<th class="num">params</th>'
      + '<th>assessment</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table>';

    const wrapper = sectionShell('Evidence · ' + pad(n), 'Full results', 'Raw numbers for every experiment. For cross-reference or further analysis.', html);
    return { wrapper: wrapper, afterMount: function () {} };
  }

  function humanModelName(e) {
    const c = e.config || {};
    if (c.model_family === 'linear') {
      const l = c.lambda_l2;
      if (l == null || l === 0) return 'linear (OLS)';
      return 'linear (Ridge λ=' + l + ')';
    }
    if (c.model_family === 'gbdt') {
      const parts = [];
      if (c.gbdt_learning_rate != null) parts.push('η=' + c.gbdt_learning_rate);
      if (c.gbdt_max_depth != null) parts.push('depth=' + c.gbdt_max_depth);
      return 'boosted trees' + (parts.length ? ' (' + parts.join(', ') + ')' : '');
    }
    return c.model_family || 'unknown';
  }

  function fmt(n) { return n == null ? '—' : (typeof n === 'number' ? n.toFixed(4) : escapeHtml(n)); }
  function fmtPct(n) { return n == null ? '—' : (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%'; }

  function diminishingSection(spec, n) {
    const inner = '<div class="chart-wrap"><div id="panel-diminishing-chart" class="echarts-container"></div><p class="chart-note">Each step is one experiment. The line drops only when a new experiment beats every prior one on the primary metric.</p></div>';
    const wrapper = sectionShell('Evidence · ' + pad(n), 'Best metric over time', 'Best primary-metric value so far, across batches. Diminishing returns show up as a flattening curve.', inner);
    return {
      wrapper: wrapper,
      afterMount: function () {
        const chart = getOrInitChart('panel-diminishing-chart');
        if (!chart) return;
        const points = (spec.next && spec.next.diminishing_returns_points) || [];
        if (points.length === 0) return;
        const data = points.map(function (p) { return [p.cumulative_experiment_count, p.best_metric_so_far]; });
        const opt = Object.assign({}, echartsBase(), {
          grid: { left: 60, right: 30, top: 20, bottom: 40, containLabel: true },
          xAxis: Object.assign({ type: 'value', name: 'cumulative experiments →' }, axisStyle()),
          yAxis: Object.assign({ type: 'value', name: 'best primary metric ↓' }, axisStyle()),
          series: [{ type: 'line', step: 'end', symbol: 'circle', symbolSize: 6, lineStyle: { color: '#c98c3c', width: 2 }, itemStyle: { color: '#c98c3c' }, data: data }]
        });
        chart.setOption(opt);
      }
    };
  }
  function attributionSection(spec, n) {
    const inner = '<div class="chart-wrap"><div id="panel-attribution-chart" class="echarts-container"></div><p class="chart-note">Most performance variance in well-studied regimes comes from architecture, not hyperparameter tuning. If hyperparameters dominate, the simplest architecture may already be near its ceiling.</p></div>';
    const wrapper = sectionShell('Evidence · ' + pad(n), 'What drove the variance', 'Share of variance attributable to architecture changes versus hyperparameter tuning, across all experiments in the plan.', inner);
    return {
      wrapper: wrapper,
      afterMount: function () {
        const chart = getOrInitChart('panel-attribution-chart');
        if (!chart) return;
        const attr = (spec.next && spec.next.attribution) || {};
        const arch = typeof attr.architecture === 'number' ? attr.architecture : 0;
        const hp = typeof attr.hyperparameters === 'number' ? attr.hyperparameters : 0;
        const opt = Object.assign({}, echartsBase(), {
          grid: { left: 60, right: 30, top: 20, bottom: 40, containLabel: true },
          xAxis: Object.assign({ type: 'category', data: ['architecture', 'hyperparameters'] }, axisStyle()),
          yAxis: Object.assign({ type: 'value', max: 1, name: 'share of variance' }, axisStyle()),
          series: [{
            type: 'bar',
            barWidth: '40%',
            data: [
              { value: arch, itemStyle: { color: '#c98c3c' } },
              { value: hp,   itemStyle: { color: '#8a6540' } }
            ]
          }]
        });
        chart.setOption(opt);
      }
    };
  }

  function sectionShell(eyebrow, title, sub, innerHtml) {
    const d = document.createElement('div');
    d.className = 'section';
    d.innerHTML = '<div class="eyebrow">' + escapeHtml(eyebrow) + '</div><h2>' + escapeHtml(title) + '</h2><p class="sub">' + escapeHtml(sub) + '</p>' + innerHtml;
    return d;
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function renderNext(spec) {
    const el = document.getElementById('next');
    if (!el) return;
    const suggestions = (spec.next && spec.next.suggestions) || [];
    if (suggestions.length === 0) { el.innerHTML = ''; return; }

    const items = suggestions.map(function (s, i) {
      const parsed = parseSuggestion(s);
      const paramsHtml = parsed.params.length
        ? '<div class="params">' + parsed.params.map(function (p, j) {
            return (j > 0 ? '<span class="sep">·</span>' : '') + (p.label ? escapeHtml(p.label) + ' ' : '') + '<span class="k">' + escapeHtml(p.name) + '</span>' + (p.value ? ' ' + escapeHtml(p.value) : '');
          }).join('') + '</div>'
        : '';
      return '<div class="item">'
        + '<div class="head"><span class="idx">' + pad(i + 1) + '</span><span class="title">' + escapeHtml(parsed.title) + '</span></div>'
        + '<div class="body">' + escapeHtml(parsed.body) + '</div>'
        + paramsHtml
        + '</div>';
    }).join('');

    el.innerHTML =
      '<div class="eyebrow">Next</div>'
      + '<h2>What to try next</h2>'
      + '<p class="sub">' + suggestions.length + ' follow-up experiment' + (suggestions.length === 1 ? '' : 's') + ' suggested by this batch.</p>'
      + items;
  }

  function parseSuggestion(raw) {
    // Suggestions may be plain strings today; parse a leading "Title: body" or split on first ".".
    // Params are detected as key=value or key\u2208{...} tokens. Falls back to the raw string as body.
    const sentenceMatch = raw.match(/^(.*?)\.\s+(.*)$/s);
    const title = sentenceMatch ? sentenceMatch[1] : 'Follow-up';
    const body = sentenceMatch ? sentenceMatch[2].trim() : raw;
    const paramRegex = /([a-z_][a-z0-9_]*)\s*(?:=|\u2208)\s*(\{[^}]*\}|'[^']*'|"[^"]*"|[A-Za-z_]\w*|[0-9.]+)/gi;
    const params = [];
    let m;
    while ((m = paramRegex.exec(raw)) !== null) {
      params.push({ label: '', name: m[1], value: m[2] });
    }
    return { title: title, body: body, params: params };
  }

  // Expose for tests (future) and debugging
  window.__modelTrainerRender = { plainAssessment, formatDuration, fetchSpec, escapeHtml };

  async function load() {
    clearError();
    const spec = await fetchSpec();
    if (!spec) return;
    renderStrip(spec);
    renderHero(spec);
    renderEvidence(spec);
    renderNext(spec);
  }

  window.addEventListener('load', load);
  window.addEventListener('resize', function () {
    Object.keys(charts).forEach(function (k) { charts[k].resize(); });
  });
})();
