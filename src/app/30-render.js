// Weergave: omgevingsbanen, releasetabel en logboek.
const SERIES = {};
ORDER.forEach(function (k) {
  const b = OMG[k].base;
  SERIES[k] = Array.from({ length: 28 }, function (_, i) { return b + Math.round(Math.sin(i * .7 + b) * 14 + (Math.random() - .5) * 18); });
});

function envVar(k) { return 'var(--' + k.toLowerCase() + ')'; }

function spark(k) {
  const s = SERIES[k], min = Math.min.apply(null, s) - 10, max = Math.max.apply(null, s) + 10, w = 100, h = 26;
  const pts = s.map(function (y, i) { return [i / (s.length - 1) * w, h - (y - min) / (max - min) * h]; });
  const line = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
  const last = pts[pts.length - 1];
  return '<svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="M0,' + h + ' L' + line.replace(/ /g, ' L') + ' L' + w + ',' + h + ' Z" fill="var(--env)" fill-opacity=".12" stroke="none"/>' +
    '<polyline points="' + line + '" fill="none" stroke="var(--env)" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
    '<circle cx="' + last[0] + '" cy="' + last[1].toFixed(1) + '" r="2.6" fill="var(--env)" vector-effect="non-scaling-stroke"/></svg>';
}

function status(k) {
  const r = RUN[k];
  if (r) {
    if (r.fail) return '<span class="pill" style="--c:var(--bad)">Rooktest faalt</span>';
    return '<span class="pill busy" style="--c:var(--env)">' + (r.kind === 'build' ? 'Bouwen…' : r.kind === 'rollback' ? 'Terugdraaien…' : 'Uitrollen…') + '</span>';
  }
  if (S.envs[k].status === 'failed') return '<span class="pill" style="--c:var(--bad)">Uitrol mislukt</span>';
  return '<span class="pill" style="--c:var(--ok)">Gezond</span>';
}

function lane(k) {
  const E = OMG[k], e = S.envs[k], v = cur(k), r = RUN[k], R = rel(v);
  let h = '<article class="lane' + (k === 'P' ? ' is-prod' : '') + '" data-env="' + k + '" style="--env:' + envVar(k) + '">';
  h += '<div class="lane-head"><div class="glyph" aria-hidden="true">' + k + '</div><div class="lane-title"><h2>' + E.name + '</h2><div class="host">' + E.host + '</div></div>' + status(k) + '</div>';
  h += '<div class="lane-body"><div class="ver"><button class="ver-btn' + (S.selected === v ? ' sel' : '') + '" data-a="sel" data-k="' + v + '" title="Toon wijzigingen">' + v + '</button>';
  h += '<div class="ver-meta"><span class="mono">' + (R ? R.commit : '') + '</span> · ' + e.by + ' · ' + e.at + '</div></div>';
  if (r) {
    h += '<ol class="steps"><li class="hd">' + (r.kind === 'rollback' ? 'Terug naar ' : 'Nieuw: ') + '<span class="mono">' + r.v + '</span></li>';
    r.steps.forEach(function (s, i) {
      const c = i < r.i ? 'done' : i === r.i ? (r.fail ? 'fail' : 'now') : '';
      h += '<li class="' + c + '"><i>' + (i < r.i ? '✓' : i === r.i ? (r.fail ? '✕' : '●') : '○') + '</i>' + s + '</li>';
    });
    h += '</ol>';
  } else if (e.status === 'failed') {
    h += '<div class="note"><b>Uitrol teruggezet.</b> De rooktest faalde; gebruikers merkten niets. Productie draait nog <span class="mono">' + v + '</span>.</div>';
  }
  h += '<div class="metric"><span class="num" data-p95="' + k + '">' + SERIES[k][SERIES[k].length - 1] + ' <small>ms p95</small></span><div class="spark" data-spark="' + k + '">' + spark(k) + '</div></div>';
  h += '<dl class="facts"><dt>Data</dt><dd>' + E.data + '</dd><dt>Capaciteit</dt><dd>' + E.inst + '</dd><dt>Database</dt><dd class="mono">' + E.db + '</dd></dl></div>';

  h += '<div class="gate">';
  if (k !== 'P') {
    const G = gate(k), tgt = NEXT[k];
    h += '<div class="gate-hd"><span>Poort naar ' + OMG[tgt].name + '</span><em>' + G.g.filter(function (c) { return c.ok; }).length + '/' + G.g.length + '</em></div><ul class="checks">';
    G.g.forEach(function (c) {
      h += '<li class="' + (c.run ? 'run' : c.ok ? 'ok' : 'no') + '"><span class="ic">' + (c.run ? '…' : c.ok ? '✓' : '!') + '</span><span class="lbl">' + c.l + '</span>' +
        (c.act && !busy() ? '<button class="mini" data-a="' + c.act + '">' + c.al + '</button>' : '') + '</li>';
    });
    h += '</ul>';
    if (k === 'O') h += '<button class="btn ghost" data-a="build"' + (RUN.O ? ' disabled' : '') + '>Nieuwe build van main</button>';
    h += '<button class="btn' + (tgt === 'P' ? ' prod' : '') + '" data-a="promote" data-k="' + k + '"' + (G.ok ? '' : ' disabled') + '>Promoveer ' + v + ' naar ' + OMG[tgt].name + ' →</button>';
    if (G.why) h += '<p class="why">' + G.why + '</p>';
  } else {
    const p = prev('P');
    h += '<div class="gate-hd"><span>Noodprocedure</span><em>geen venster nodig</em></div>';
    h += '<p class="why" style="margin:0">Terugdraaien schakelt het verkeer terug naar de vorige blauwe omgeving.</p>';
    h += '<button class="btn ghost" data-a="rollback"' + (p && !RUN.P ? '' : ' disabled') + '>' + (p ? 'Terugdraaien naar ' + p : 'Geen vorige versie beschikbaar') + '</button>';
  }
  return h + '</div></article>';
}

function render() {
  document.getElementById('controls').innerHTML =
    '<button class="toggle" data-a="win" aria-pressed="' + S.windowOpen + '"><span class="sw"></span>Wijzigingsvenster ' + (S.windowOpen ? 'open' : 'gesloten') + '</button>' +
    '<button class="toggle" data-a="freeze" aria-pressed="' + S.freeze + '" style="--tc:var(--warn)"><span class="sw"></span>Release freeze</button>' +
    '<button class="toggle" data-a="fail" aria-pressed="' + S.failSmoke + '" style="--tc:var(--bad)"><span class="sw"></span>Scenario: rooktest faalt</button>' +
    '<button class="linkbtn" data-a="reset"' + (busy() ? ' disabled' : '') + '>Demo resetten</button>';

  const ahead = S.releases.filter(function (r) { return r.reached.indexOf('P') < 0 && r.reached.length; }).length;
  document.getElementById('summary').innerHTML =
    '<span>Productie draait <b class="mono">' + cur('P') + '</b></span>' +
    '<span><b>' + ahead + '</b> ' + (ahead === 1 ? 'release' : 'releases') + ' onderweg naar productie</span>' +
    '<span>Wijzigingsvenster: <b>' + (S.windowOpen ? 'open tot 20:00' : 'vandaag 18:00–20:00') + '</b></span>' +
    '<span>Ingelogd als <b>' + OPERATOR + '</b> · release manager</span>';

  document.getElementById('lanes').innerHTML = ORDER.map(lane).join('');

  document.getElementById('rels').innerHTML = S.releases.map(function (r) {
    const pips = ORDER.map(function (k) {
      const here = cur(k) === r.v || (RUN[k] && RUN[k].v === r.v && RUN[k].kind !== 'rollback');
      return '<span class="pip' + (here ? ' here' : r.reached.indexOf(k) >= 0 ? ' on' : '') + '" style="--env:' + envVar(k) + '" title="' + OMG[k].name + (here ? ' (nu)' : '') + '">' + k + '</span>';
    }).join('');
    return '<tr class="' + (S.selected === r.v ? 'sel' : '') + '" data-a="sel" data-k="' + r.v + '" tabindex="0"><td class="v">' + r.v + '</td><td class="mono">' + r.commit +
      '</td><td class="mono">' + r.branch + '</td><td>' + r.built + '</td><td><span class="pips">' + pips + '</span></td></tr>';
  }).join('');

  const s = rel(S.selected) || S.releases[0];
  document.getElementById('detail').innerHTML = '<h3>Wijzigingen in <span class="mono">' + s.v + '</span></h3><ul>' +
    s.changes.map(function (c) { return '<li><span class="mono">' + c[0] + '</span>' + c[1] + '</li>'; }).join('') + '</ul>';

  document.getElementById('logcount').textContent = S.log.length + ' gebeurtenissen';
  document.getElementById('log').innerHTML = S.log.map(function (l, i) {
    const sys = l.e === 'sys';
    return '<li class="' + l.lv + (i < freshLog ? ' new' : '') + '"><time>' + l.t + '</time><span class="e" style="--env:' + (sys ? 'var(--ink-3)' : envVar(l.e)) + '">' +
      (sys ? '·' : l.e) + '</span><span class="txt">' + l.x + '</span></li>';
  }).join('');
  freshLog = 0;
}

function tikMetrieken() {
  ORDER.forEach(function (k) {
    const b = OMG[k].base, s = SERIES[k];
    s.push(Math.round(b + (Math.random() - .5) * 26 + (RUN[k] ? 60 + Math.random() * 50 : 0)));
    s.shift();
    const sp = document.querySelector('[data-spark="' + k + '"]'), n = document.querySelector('[data-p95="' + k + '"]');
    if (sp) sp.innerHTML = spark(k);
    if (n) n.innerHTML = s[s.length - 1] + ' <small>ms p95</small>';
  });
}
