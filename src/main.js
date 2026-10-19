import './styles.css';
import { CROPS, CLIMATES, REGIONS, DEFAULTS, CROP_ICONS } from './data.js';
import { optimize, optimizeAllClimates, effectiveCrops, buildModel, regionById } from './model.js';
import { analyze, forecast } from './advisor.js';
import { renderCharts, renderCompareChart } from './charts.js';
import { FarmScene } from './scene/FarmScene.js';

/* ---------- күй ---------- */

const state = {
  ...DEFAULTS,
  crops: CROPS.map((c) => ({ ...c, enabled: true })),
};
let result = null;
let compare = null;
let analysis = null;
let busy = false;
const scenes = {};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const nf = new Intl.NumberFormat('ru-RU');
const fmt = (n, d = 0) => nf.format(+(+n).toFixed(d));
const fmtM = (n) => (n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' млн ₸';
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n) => String(n).replace(/\d/g, (d) => SUB[d]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const RANGES = [
  { key: 'land', label: 'Жер көлемі', unit: 'га', min: 10, max: 500, step: 1, icon: '🌱' },
  { key: 'water', label: 'Су қоры', unit: 'м³', min: 500, max: 30000, step: 100, icon: '💧' },
  { key: 'budget', label: 'Бюджет', unit: '₸', min: 1_000_000, max: 100_000_000, step: 250_000, icon: '💰' },
  {
    key: 'maxShare', label: 'Бір дақылдың максималды үлесі', unit: '%', min: 25, max: 100, step: 5, icon: '⚖️',
    hint: 'Әртараптандыру шектеуі: тәуекелді азайту үшін',
  },
];

const CLIMATE_ICONS = { dry: '☀️', normal: '🌤️', rainy: '🌧️' };

/* ---------- ресурстар ---------- */

function renderRanges() {
  $('#rangeCard').innerHTML =
    `<h3>Ресурстар</h3>` +
    RANGES.map(
      (r) => `
      <div class="range-row" data-key="${r.key}">
        <div class="range-top">
          <label for="num-${r.key}"><span class="r-ico">${r.icon}</span>${r.label}${r.hint ? `<small>${r.hint}</small>` : ''}</label>
          <div class="num">
            <input id="num-${r.key}" type="number" min="${r.min}" max="${r.max}" step="${r.step}" value="${state[r.key]}" />
            <span>${r.unit}</span>
          </div>
        </div>
        <input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${state[r.key]}" aria-label="${r.label}" />
        <div class="range-scale"><span>${fmt(r.min)}</span><span>${fmt(r.max)}</span></div>
      </div>`
    ).join('');

  $$('.range-row').forEach((row) => {
    const key = row.dataset.key;
    const num = $('input[type=number]', row);
    const range = $('input[type=range]', row);
    const r = RANGES.find((x) => x.key === key);
    const set = (v, src) => {
      v = Math.min(r.max, Math.max(r.min, +v || r.min));
      state[key] = v;
      if (src !== num) num.value = v;
      if (src !== range) range.value = v;
      paintRange(range);
      onInputsChanged();
    };
    range.addEventListener('input', () => set(range.value, range));
    num.addEventListener('change', () => set(num.value, num));
    paintRange(range);
  });
}

function paintRange(range) {
  const p = ((range.value - range.min) / (range.max - range.min)) * 100;
  range.style.setProperty('--p', p + '%');
}

function syncRanges() {
  RANGES.forEach((r) => {
    const row = $(`.range-row[data-key="${r.key}"]`);
    $('input[type=number]', row).value = state[r.key];
    const range = $('input[type=range]', row);
    range.value = state[r.key];
    paintRange(range);
  });
}

function renderRegionSelect() {
  const sel = $('#regionSelect');
  sel.innerHTML = REGIONS.map((r) => `<option value="${r.id}">${r.name}</option>`).join('');
  sel.value = state.region;
  sel.addEventListener('change', () => {
    state.region = sel.value;
    renderForecast();
    onInputsChanged();
  });
}

function renderProfile() {
  const reg = regionById(state.region);
  const cl = CLIMATES[state.climate];
  const waterEff = state.water * cl.waterAvail;
  $('#profile').innerHTML = `
    <div><small>Су / гектар</small><b>${fmt(waterEff / state.land, 1)} м³</b></div>
    <div><small>Бюджет / гектар</small><b>${fmt(state.budget / state.land)} ₸</b></div>
    <div><small>Тиімді су қоры</small><b>${fmt(waterEff)} м³</b></div>
    <div><small>Жауын-шашын нормасы</small><b>${reg.precip} мм</b></div>
    <div class="wide"><small>Топырақ</small><b>${reg.soil}</b></div>
    <div class="wide factors">${state.crops
      .map((c) => {
        const k = reg.factors[c.id];
        return `<span class="factor ${k >= 1.05 ? 'up' : k <= 0.9 ? 'down' : ''}" style="--c:${c.color}">${c.name} ×${k.toFixed(2)}</span>`;
      })
      .join('')}</div>`;
}

/* ---------- дақылдар ---------- */

const CROP_FIELDS = [
  { key: 'water', label: 'Су шығыны', unit: 'м³/га', step: 1 },
  { key: 'cost', label: 'Шығын', unit: '₸/га', step: 1000 },
  { key: 'yield', label: 'Өнімділік', unit: 'т/га', step: 0.1 },
  { key: 'price', label: 'Бағасы', unit: '₸/т', step: 1000 },
];

function renderCrops() {
  $('#cropGrid').innerHTML = state.crops
    .map(
      (c, i) => `
    <article class="crop-card glass" data-id="${c.id}" style="--c:${c.color}">
      <div class="crop-inner">
        <header>
          <div class="crop-ico">${CROP_ICONS[c.id]}</div>
          <div>
            <h3>${c.name} <small>x${sub(i + 1)}</small></h3>
            <em>${c.latin}</em>
          </div>
          <label class="switch" title="Модельге қосу">
            <input type="checkbox" ${c.enabled ? 'checked' : ''} />
            <i></i>
          </label>
        </header>
        <div class="crop-fields">
          ${CROP_FIELDS.map(
            (f) => `
            <label>
              <span>${f.label}, <i>${f.unit}</i></span>
              <div class="num sm"><input type="number" data-field="${f.key}" step="${f.step}" min="0" value="${c[f.key]}" /></div>
            </label>`
          ).join('')}
        </div>
        <div class="crop-metrics"></div>
      </div>
    </article>`
    )
    .join('');

  $$('.crop-card').forEach((card) => {
    const crop = state.crops.find((c) => c.id === card.dataset.id);
    $$('input[data-field]', card).forEach((inp) =>
      inp.addEventListener('change', () => {
        crop[inp.dataset.field] = Math.max(0, +inp.value || 0);
        onInputsChanged();
      })
    );
    $('.switch input', card).addEventListener('change', (e) => {
      crop.enabled = e.target.checked;
      card.classList.toggle('disabled', !crop.enabled);
      onInputsChanged();
    });
    // 3D tilt
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
      card.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
  updateCropMetrics();
}

function updateCropMetrics() {
  const eff = effectiveCrops(state.crops, state.climate, state.region);
  eff.forEach((c) => {
    const el = $(`.crop-card[data-id="${c.id}"] .crop-metrics`);
    el.innerHTML = `
      <div><small>Тиімді өнімділік</small><b>${fmt(c.yieldT, 2)} т/га</b></div>
      <div><small>Су (климатпен)</small><b>${fmt(c.water, 1)} м³/га</b></div>
      <div><small>Күтілетін табыс</small><b>${fmt(c.revenue)} ₸/га</b></div>
      <div class="profit ${c.profit < 0 ? 'neg' : ''}"><small>Таза пайда</small><b>${fmt(c.profit)} ₸/га</b></div>`;
  });
}

/* ---------- климат ---------- */

function renderClimateOptions() {
  $('#climateOptions').innerHTML = Object.values(CLIMATES)
    .map(
      (c) => `
    <button class="climate-opt glass ${c.id === state.climate ? 'active' : ''}" data-id="${c.id}">
      <span class="c-ico">${CLIMATE_ICONS[c.id]}</span>
      <b>${c.name}</b>
      <small>${c.desc}</small>
      <div class="c-k">
        <span>Су қоры ×${c.waterAvail}</span>
        <span>Су қажеттілігі ×${c.waterNeed}</span>
      </div>
    </button>`
    )
    .join('');
  $$('.climate-opt').forEach((b) => b.addEventListener('click', () => setClimate(b.dataset.id)));
}

function setClimate(id, { stale = true } = {}) {
  state.climate = id;
  document.body.dataset.climate = id;
  $$('.climate-opt').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  scenes.hero?.setClimate(id);
  scenes.climate?.setClimate(id);
  $('#chipClimate').textContent = CLIMATES[id].name;
  renderClimateBadge();
  if (stale) onInputsChanged();
}

function renderClimateBadge() {
  const cl = CLIMATES[state.climate];
  $('#climateBadge').innerHTML = `${CLIMATE_ICONS[cl.id]} <b>${cl.name}</b> · су қоры ${fmt(state.water * cl.waterAvail)} м³`;
}

function renderForecast() {
  const f = forecast(state.region);
  $('#forecast').innerHTML = `
    <div class="fc-head">
      <div class="ai-avatar sm"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 3 9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5z"/></svg></div>
      <div><b>AI климат болжамы</b><small>${f.region.name} · сенімділік ${Math.round(f.confidence * 100)}%</small></div>
    </div>
    <div class="fc-bars">
      ${Object.entries(f.probs)
        .map(
          ([id, p]) => `
        <div class="fc-bar ${id === f.top ? 'top' : ''}" data-c="${id}">
          <span>${CLIMATE_ICONS[id]} ${CLIMATES[id].short}</span>
          <div><i style="width:${p * 100}%"></i></div>
          <b>${Math.round(p * 100)}%</b>
        </div>`
        )
        .join('')}
    </div>
    <p>${f.text}</p>
    <button class="btn btn-soft btn-sm" id="applyForecast" ${f.top === state.climate ? 'disabled' : ''}>
      ${f.top === state.climate ? '✓ Ұсынылған сценарий таңдалған' : `Ұсынылған сценарийді қолдану: ${CLIMATES[f.top].short}`}
    </button>`;
  $('#applyForecast').addEventListener('click', () => {
    setClimate(f.top);
    renderForecast();
  });
}

/* ---------- модель ---------- */

function renderModel() {
  const eff = effectiveCrops(state.crops, state.climate, state.region);
  const model = buildModel(state, eff, state.climate);
  const idx = (k) => state.crops.findIndex((c) => c.id === k.id) + 1;
  const term = (coef, k, first) => {
    const sign = first ? '' : ' + ';
    return `${sign}<span class="coef">${fmt(coef, coef % 1 ? 1 : 0)}</span>x${sub(idx(k))}`;
  };
  const row = (coefs, sign, rhs, name, unit) =>
    `<div class="eq"><span>${coefs}</span><span class="op">${sign}</span><span class="rhs">${rhs}</span><em>${name}${unit ? `, ${unit}` : ''}</em></div>`;

  if (!model.active.length) {
    $('#modelMath').innerHTML = `<p class="muted">Кем дегенде бір дақылды модельге қосыңыз.</p>`;
    return;
  }

  const vars = model.active.map((k) => `x${sub(idx(k))} — ${k.name.toLowerCase()}`).join(', ');
  const obj = model.active.map((k, i) => term(Math.max(0, Math.round(k.profit)), k, i === 0)).join('');
  const land = model.active.map((k, i) => `${i ? ' + ' : ''}x${sub(idx(k))}`).join('');
  const water = model.active.map((k, i) => term(k.water, k, i === 0)).join('');
  const budget = model.active.map((k, i) => term(k.cost, k, i === 0)).join('');
  const cap = (state.land * state.maxShare) / 100;

  $('#modelMath').innerHTML = `
    <h3>Айнымалылар</h3>
    <p class="vars">${vars} <span class="muted">(га)</span></p>
    <h3>Мақсаттық функция</h3>
    <div class="eq obj"><span>max Z = ${obj}</span></div>
    <h3>Шектеулер</h3>
    ${row(land, '≤', fmt(state.land), 'жер', 'га')}
    ${row(water, '≤', fmt(model.waterAvail), 'су', 'м³')}
    ${row(budget, '≤', fmt(state.budget), 'бюджет', '₸')}
    ${state.maxShare < 100 ? row(`x<sub>i</sub>`, '≤', fmt(cap, 1), `әртараптандыру (${state.maxShare}%)`, 'га') : ''}
    ${row(model.active.map((k) => `x${sub(idx(k))}`).join(', '), '≥', '0', 'теріс емес шарт')}
    <h3>Канондық түрі</h3>
    <p class="muted small">Теңсіздіктер қосымша айнымалылар (s${sub(1)}…s${sub(model.b.length)}) арқылы теңдікке келтіріледі; бастапқы базис — {s${sub(1)}, …, s${sub(model.b.length)}}, бастапқы Z = 0.</p>`;
}

function renderSimplexLog() {
  const el = $('#simplexLog');
  if (!result) {
    el.innerHTML = '';
    return;
  }
  const { sol, model } = result;
  const n = model.active.length;
  const name = (j) =>
    j == null ? '—' : j < n ? `x${sub(state.crops.findIndex((c) => c.id === model.active[j].id) + 1)}` : `s${sub(j - n + 1)}`;
  el.innerHTML = `
    <div class="log-head"><b>Итерациялар</b><span>${sol.iterations.length - 1} қадам · статус: ${sol.status === 'optimal' ? 'оптималды' : sol.status}</span></div>
    <table>
      <thead><tr><th>#</th><th>Кіретін</th><th>Шығатын</th><th>Базис</th><th>Z</th></tr></thead>
      <tbody>
        ${sol.iterations
          .map(
            (it) => `<tr>
          <td>${it.iter}</td><td>${name(it.entering)}</td><td>${name(it.leaving)}</td>
          <td class="basis">{${it.basis.map(name).join(', ')}}</td>
          <td>${fmt(it.z)}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
    <div class="duals">
      <b>Көлеңкелі бағалар</b>
      ${model.rows
        .slice(0, 3)
        .map(
          (r, i) => `<span>${r.name}: <i>${sol.duals[i] > 1e-6 ? fmt(sol.duals[i], r.key === 'budget' ? 3 : 0) : '0'}</i></span>`
        )
        .join('')}
    </div>`;
}

/* ---------- нәтиже ---------- */

function renderResults(res, { label } = {}) {
  const r = res;
  const used = r.crops.filter((c) => c.ha > 0.05);
  const fallow = Math.max(0, r.limits.land - r.usage.land);

  $('#kpis').innerHTML = `
    <div class="kpi glass k-green"><small>Максималды пайда</small><b data-count="${r.profit}">${fmtM(r.profit)}</b><span>таза пайда, Z*</span></div>
    <div class="kpi glass k-blue"><small>Су шығыны</small><b>${fmt(r.usage.water)} м³</b><span>${fmt(r.limits.water)} м³ қордан</span></div>
    <div class="kpi glass k-yellow"><small>Бюджет шығыны</small><b>${fmtM(r.usage.budget)}</b><span>${fmtM(r.limits.budget)} бюджеттен</span></div>
    <div class="kpi glass k-teal"><small>Жердің қолданылуы</small><b>${fmt(r.usage.land, 1)} га</b><span>${fmt(r.limits.land)} га жерден</span></div>`;

  $('#allocList').innerHTML =
    r.crops
      .filter((c) => c.enabled !== false)
      .map(
        (c) => `
    <div class="alloc ${c.ha > 0.05 ? '' : 'zero'}" style="--c:${c.color}">
      <span class="sw"></span>
      <b>${c.name}</b>
      <span class="ha">${fmt(c.ha, 1)} га</span>
      <span class="share">${Math.round((c.ha / r.limits.land) * 100)}%</span>
      <div class="bar"><i style="width:${(c.ha / r.limits.land) * 100}%"></i></div>
    </div>`
      )
      .join('') +
    (fallow > 0.3
      ? `<div class="alloc fallow" style="--c:#CBBBA0"><span class="sw"></span><b>Бос жер</b><span class="ha">${fmt(fallow, 1)} га</span><span class="share">${Math.round((fallow / r.limits.land) * 100)}%</span></div>`
      : '');

  const bars = [
    { name: 'Жер', v: r.usage.land, max: r.limits.land, unit: 'га', cls: 'g' },
    { name: 'Су', v: r.usage.water, max: r.limits.water, unit: 'м³', cls: 'b' },
    { name: 'Бюджет', v: r.usage.budget, max: r.limits.budget, unit: '₸', cls: 'y' },
  ];
  $('#usageBars').innerHTML = bars
    .map((b) => {
      const p = Math.min(100, (b.v / b.max) * 100);
      return `<div class="u-row ${b.cls}">
        <div class="u-top"><span>${b.name}</span><b>${p.toFixed(1)}%</b></div>
        <div class="u-bar"><i style="width:0" data-w="${p}%"></i></div>
        <small>${fmt(b.v)} / ${fmt(b.max)} ${b.unit}${p > 99.5 ? ' · <em>шектеу белсенді</em>' : ''}</small>
      </div>`;
    })
    .join('');
  requestAnimationFrame(() => $$('#usageBars i').forEach((i) => (i.style.width = i.dataset.w)));

  $('#mapBadge').innerHTML = `${CLIMATE_ICONS[r.climate]} <b>${label || CLIMATES[r.climate].name}</b> · ${used.length} дақыл · ${fmt(r.usage.land, 1)} га`;
  $('#chipProfit').textContent = fmtM(r.profit);
}

function showMap(res, opts) {
  scenes.result?.setClimate(res.climate, { duration: 1 });
  scenes.result?.setAllocation(
    res.crops.map((c) => ({ ...c })),
    { land: res.limits.land, animate: true }
  );
  renderResults(res, opts);
}

function onHover(info, e) {
  const tip = $('#tooltip');
  if (!info || !e) {
    tip.hidden = true;
    return;
  }
  const box = $('#resultScene').getBoundingClientRect();
  if (info.id === 'fallow') {
    tip.innerHTML = `<b>Бос жер</b><div><span>Ауданы</span><i>${fmt(info.ha, 1)} га</i></div><p>Ресурс шектеулеріне байланысты егілмейді</p>`;
  } else {
    tip.innerHTML = `
      <b style="--c:${info.color}"><span class="sw"></span>${info.name}</b>
      <div><span>Ауданы</span><i>${fmt(info.ha, 1)} га</i></div>
      <div><span>Су шығыны</span><i>${fmt(info.waterUse)} м³</i></div>
      <div><span>Күтілетін табыс</span><i>${fmtM(info.revenueTotal)}</i></div>
      <div><span>Таза пайда</span><i class="pos">${fmtM(info.profitTotal)}</i></div>`;
  }
  tip.hidden = false;
  const x = e.clientX - box.left + 18;
  const y = e.clientY - box.top + 18;
  tip.style.transform = `translate(${Math.min(x, box.width - 240)}px, ${Math.min(y, box.height - 160)}px)`;
}

/* ---------- AI ---------- */

async function typeText(el, text, speed = 2) {
  el.textContent = '';
  const cursor = document.createElement('span');
  cursor.className = 'caret';
  for (let i = 0; i < text.length; i += speed) {
    el.textContent = text.slice(0, i + speed);
    el.appendChild(cursor);
    await wait(10);
  }
  cursor.remove();
}

async function thinking(el, ms = 700) {
  el.innerHTML = '<span class="thinking"><i></i><i></i><i></i> талдау жүріп жатыр</span>';
  await wait(ms);
}

async function renderAI(animated) {
  analysis = analyze(result, state.crops);
  const reg = regionById(state.region);
  $('#aiMeta').textContent = `${reg.name} · ${CLIMATES[state.climate].name} · ${result.sol.iterations.length - 1} симплекс итерациясы`;
  $('#aiConfidence').textContent = `Сенімділік ${Math.round(analysis.confidence * 100)}%`;
  const sum = $('#aiSummary');
  const thread = $('#aiThread');
  thread.innerHTML = '';
  $('#aiChips').innerHTML = analysis.qa
    .map((x, i) => `<button class="chip" data-i="${i}">${x.q}</button>`)
    .join('');
  $$('#aiChips .chip').forEach((b) => b.addEventListener('click', () => ask(+b.dataset.i, true)));

  if (animated) {
    await thinking(sum, 900);
    await typeText(sum, analysis.summary, 3);
    await ask(0, true);
  } else {
    sum.textContent = analysis.summary;
    ask(0, false);
    ask(1, false);
  }
}

async function ask(i, animated) {
  const item = analysis.qa[i];
  const chip = $(`#aiChips .chip[data-i="${i}"]`);
  chip?.classList.add('used');
  const thread = $('#aiThread');
  const q = document.createElement('div');
  q.className = 'msg q';
  q.textContent = item.q;
  const a = document.createElement('div');
  a.className = 'msg a';
  thread.append(q, a);
  if (animated) {
    a.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    await thinking(a, 650);
    await typeText(a, item.a, 3);
  } else {
    a.textContent = item.a;
  }
}

/* ---------- салыстыру ---------- */

function renderCompare() {
  const ids = Object.keys(CLIMATES);
  const base = compare.normal;
  $('#compareCards').innerHTML = ids
    .map((id) => {
      const r = compare[id];
      const d = r.profit - base.profit;
      const dw = r.usage.water - base.usage.water;
      const used = r.crops.filter((c) => c.ha > 0.05);
      const fallow = Math.max(0, r.limits.land - r.usage.land);
      return `
      <div class="cmp glass ${id === state.climate ? 'current' : ''}" data-c="${id}">
        <div class="cmp-head"><span>${CLIMATE_ICONS[id]}</span><b>${CLIMATES[id].name}</b>${id === state.climate ? '<em>таңдалған</em>' : ''}</div>
        <div class="cmp-profit">${fmtM(r.profit)}</div>
        <div class="cmp-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${id === 'normal' ? 'база сценарий' : `${d > 0 ? '▲' : '▼'} ${fmtM(Math.abs(d))} қалыптыға қарағанда`}</div>
        <div class="strip">
          ${used.map((c) => `<i style="flex:${c.ha};--c:${c.color}" title="${c.name} ${fmt(c.ha, 1)} га"></i>`).join('')}
          ${fallow > 0.3 ? `<i style="flex:${fallow};--c:#CBBBA0" title="Бос жер"></i>` : ''}
        </div>
        <div class="cmp-meta">
          <span>💧 ${fmt(r.usage.water)} м³ ${id === 'normal' ? '' : `<small>(${dw > 0 ? '+' : ''}${fmt(dw)})</small>`}</span>
          <span>🌱 ${fmt(r.usage.land, 1)} га</span>
        </div>
        <button class="btn btn-soft btn-sm" data-show="${id}">3D картада көру</button>
      </div>`;
    })
    .join('');
  $$('#compareCards [data-show]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.show;
      showMap(compare[id], { label: CLIMATES[id].name + ' (салыстыру)' });
      $('#results').scrollIntoView({ behavior: 'smooth' });
    })
  );

  const crops = state.crops.filter((c) => c.enabled);
  const arrow = (v, b) => {
    const d = v - b;
    if (Math.abs(d) < 0.05) return '<span class="eqv">=</span>';
    return `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '↑' : '↓'}${fmt(Math.abs(d), 1)}</span>`;
  };
  $('#compareTable').innerHTML = `
    <table class="cmp-table">
      <thead><tr><th>Көрсеткіш</th>${ids.map((id) => `<th>${CLIMATE_ICONS[id]} ${CLIMATES[id].short}</th>`).join('')}</tr></thead>
      <tbody>
        ${crops
          .map((c) => {
            const vals = ids.map((id) => compare[id].crops.find((x) => x.id === c.id).ha);
            const b = vals[1];
            return `<tr><td><span class="sw" style="--c:${c.color}"></span>${c.name}, га</td>${vals
              .map((v, i) => `<td>${fmt(v, 1)} ${i === 1 ? '' : arrow(v, b)}</td>`)
              .join('')}</tr>`;
          })
          .join('')}
        <tr class="sep"><td>Пайда</td>${ids.map((id) => `<td><b>${fmtM(compare[id].profit)}</b></td>`).join('')}</tr>
        <tr><td>Су жұмсауы, м³</td>${ids.map((id) => `<td>${fmt(compare[id].usage.water)}</td>`).join('')}</tr>
        <tr><td>Тиімді су қоры, м³</td>${ids.map((id) => `<td>${fmt(compare[id].limits.water)}</td>`).join('')}</tr>
        <tr><td>Бюджет, ₸</td>${ids.map((id) => `<td>${fmtM(compare[id].usage.budget)}</td>`).join('')}</tr>
      </tbody>
    </table>`;
  renderCompareChart(compare, state.crops);
}

/* ---------- оптимизация ---------- */

function onInputsChanged() {
  renderProfile();
  updateCropMetrics();
  renderModel();
  renderClimateBadge();
  $('#chipWater').textContent = fmt(state.water) + ' м³';
  if (result) $('#staleBadge').hidden = false;
}

async function runOptimization({ animate = true, scroll = true } = {}) {
  if (busy) return;
  if (!state.crops.some((c) => c.enabled)) {
    alert('Кем дегенде бір дақылды модельге қосыңыз.');
    return;
  }
  busy = true;
  const next = optimize(state, state.crops);
  const nextCompare = optimizeAllClimates(state, state.crops);

  if (animate) {
    const loader = $('#loader');
    const list = $('#loaderSteps');
    const bar = $('#loaderBar');
    const steps = [
      'Деректер нормаланды, климат коэффициенттері қолданылды',
      `Математикалық модель құрылды: ${next.model.active.length} айнымалы, ${next.model.b.length} шектеу`,
      `Симплекс әдісі: ${next.sol.iterations.length - 1} итерация, Z* = ${fmtM(next.profit)}`,
      'Сезімталдық талдауы және сценарийлерді салыстыру',
      'AI қорытынды дайындалды',
    ];
    list.innerHTML = steps.map((s) => `<li>${s}</li>`).join('');
    bar.style.width = '0';
    loader.hidden = false;
    scenes.hero?.setBusy(true);
    scenes.result?.setBusy(true);
    const lis = $$('li', list);
    for (let i = 0; i < lis.length; i++) {
      lis[i].classList.add('active');
      bar.style.width = ((i + 1) / lis.length) * 100 + '%';
      await wait(380 + Math.random() * 220);
      lis[i].classList.replace('active', 'done');
    }
    await wait(250);
    loader.hidden = true;
    scenes.hero?.setBusy(false);
    scenes.result?.setBusy(false);
  }

  result = next;
  compare = nextCompare;
  $('#staleBadge').hidden = true;
  renderSimplexLog();
  if (scroll) $('#results').scrollIntoView({ behavior: 'smooth' });
  await wait(scroll ? 450 : 0);
  showMap(result);
  renderCharts(result);
  renderCompare();
  busy = false;
  await renderAI(animate);
}

/* ---------- іске қосу ---------- */

function initScenes() {
  const make = (id, opts) => {
    try {
      return new FarmScene(document.getElementById(id), opts);
    } catch (err) {
      console.warn('WebGL unavailable', err);
      document.getElementById(id).classList.add('no-webgl');
      return null;
    }
  };
  scenes.hero = make('heroScene', { mode: 'hero', climate: state.climate });
  scenes.climate = make('climateScene', { mode: 'preview', climate: state.climate });
  scenes.result = make('resultScene', { mode: 'result', climate: state.climate, onHover });
}

function initReveal() {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.12 }
  );
  $$('.section-head, .card, .crop-card, .kpi, .cmp, .climate-opt').forEach((el) => {
    el.classList.add('reveal');
    io.observe(el);
  });
}

function initNav() {
  const links = $$('.nav-links a');
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
      }),
    { rootMargin: '-45% 0px -50% 0px' }
  );
  $$('main section').forEach((s) => io.observe(s));
  $$('[data-action=optimize]').forEach((b) => b.addEventListener('click', () => runOptimization()));
  $('#btnDemo').addEventListener('click', async () => {
    Object.assign(state, { ...DEFAULTS });
    state.crops = CROPS.map((c) => ({ ...c, enabled: true }));
    syncRanges();
    $('#regionSelect').value = state.region;
    renderCrops();
    setClimate(DEFAULTS.climate, { stale: false });
    renderForecast();
    onInputsChanged();
    await runOptimization();
  });
}

renderRanges();
renderRegionSelect();
renderCrops();
renderClimateOptions();
renderForecast();
renderProfile();
renderModel();
renderClimateBadge();
initScenes();
initNav();
initReveal();
runOptimization({ animate: false, scroll: false });
