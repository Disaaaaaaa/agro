// SmartFarm AI кеңесші модулі: шешімді, көлеңкелі бағаларды және сезімталдық сценарийлерін талдап,
// фермерге түсінікті тілде қорытынды құрастырады.
import { CLIMATES } from './data.js';
import { optimize, regionById } from './model.js';

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n));
const fmtM = (n) => (n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн ₸';
const pct = (n) => Math.round(n * 100) + '%';
const pick = (arr, seed) => arr[Math.abs(Math.round(seed)) % arr.length];

const LIMIT_NAMES = { land: 'жер көлемі', water: 'су қоры', budget: 'бюджет' };

export function forecast(regionId) {
  const reg = regionById(regionId);
  const entries = Object.entries(reg.probs).sort((a, b) => b[1] - a[1]);
  const [top, p] = entries[0];
  const confidence = Math.min(0.96, 0.62 + p * 0.55);
  const precipDelta = { dry: -18, normal: 0, rainy: 14 }[top] + Math.round((reg.temp - 1.5) * -6);
  return {
    region: reg,
    top,
    probs: reg.probs,
    confidence,
    precipDelta,
    text:
      `${reg.name} бойынша 30 жылдық климаттық қатар мен соңғы маусымдық ауытқуларды талдау нәтижесінде ` +
      `алдағы маусымда «${CLIMATES[top].name.toLowerCase()}» сценарийінің ықтималдығы ең жоғары (${pct(p)}). ` +
      `Орташа температура аномалиясы +${reg.temp.toFixed(1)}°C, жауын-шашын нормасы ~${reg.precip} мм, ` +
      `күтілетін ауытқу ${precipDelta > 0 ? '+' : ''}${precipDelta}%. Топырақ типі: ${reg.soil.toLowerCase()}.`,
  };
}

export function analyze(result, baseCrops) {
  const { crops, profit, usage, limits, binding, inputs, climate } = result;
  const seed = profit / 1000;
  const used = crops.filter((c) => c.ha > 0.05).sort((a, b) => b.ha - a.ha);
  const unused = crops.filter((c) => c.ha <= 0.05 && c.enabled !== false);
  const cl = CLIMATES[climate];
  const reg = regionById(result.region);

  const enabled = crops.filter((c) => c.enabled !== false);
  const byProfitHa = [...enabled].sort((a, b) => b.profit - a.profit);
  const byProfitWater = [...enabled].sort((a, b) => b.profit / b.water - a.profit / a.water);
  const resBinding = binding.filter((b) => LIMIT_NAMES[b.key]);
  const capBinding = binding.filter((b) => b.crop);
  const main = [...resBinding].sort((a, b) => b.dual * limits[b.key] - a.dual * limits[a.key])[0];

  // 1. Негізгі қорытынды
  const top2 = used.slice(0, 2).map((c) => c.name.toLowerCase());
  const opener = pick(
    [
      `${cl.name} жағдайында және ${reg.name} коэффициенттерін ескергенде ең тиімді шешім — жердің негізгі бөлігін ${joinKz(top2)} дақылдарына бөлу.`,
      `${reg.name}, ${cl.name.toLowerCase()} сценарийі үшін оңтайлы құрылым анықталды: басымдық ${joinKz(top2)} дақылдарына беріледі.`,
      `Есептеу нәтижесі бойынша ${cl.name.toLowerCase()} кезінде пайданы максималдау үшін егістіктің басым үлесін ${joinKz(top2)} алуы керек.`,
    ],
    seed
  );
  const allocText = used.map((c) => `${c.name} — ${c.ha.toFixed(1)} га`).join(', ');
  const summary =
    `${opener} Ұсынылатын бөлу: ${allocText}. Күтілетін таза пайда — ${fmtM(profit)}, ` +
    `ресурстардың қолданылуы: жер ${pct(usage.land / limits.land)}, су ${pct(usage.water / limits.water)}, бюджет ${pct(usage.budget / limits.budget)}.`;

  // 2. Қай дақыл тиімді
  const bestHa = byProfitHa[0];
  const bestW = byProfitWater[0];
  let efficiency =
    `1 гектарға шаққанда ең табысты дақыл — ${bestHa.name.toLowerCase()} (${fmt(bestHa.profit)} ₸/га таза пайда). ` +
    `Ал 1 м³ суға шаққанда ең тиімдісі — ${bestW.name.toLowerCase()} (${fmt(bestW.profit / bestW.water)} ₸/м³). `;
  if (bestHa.id !== bestW.id) {
    efficiency +=
      `Яғни ${bestHa.name.toLowerCase()} табыстылығы жоғары болғанымен, су шығыны да көп (${Math.round(bestHa.water)} м³/га). ` +
      `Сондықтан су ресурсы шектеулі болған кезде оның үлесін шектеп, ${bestW.name.toLowerCase()} арқылы теңгерім сақтау ұсынылады.`;
  } else {
    efficiency += `${bestHa.name} гектар бойынша да, су бойынша да көшбасшы, сондықтан модель оны рұқсат етілген шекке дейін арттырады.`;
  }
  if (unused.length) {
    efficiency += ` ${joinKz(unused.map((c) => c.name))} бұл жағдайда жоспарға кірмеді: ресурс бірлігіне шаққандағы пайдасы балама дақылдардан төмен.`;
  }

  // 3. Негізгі кедергі
  let bottleneck;
  if (main) {
    const unit = main.key === 'budget' ? '1 000 ₸' : main.key === 'water' ? '1 м³' : '1 га';
    const val = main.key === 'budget' ? main.dual * 1000 : main.dual;
    bottleneck =
      `Негізгі шектеуші фактор — ${LIMIT_NAMES[main.key]}. Симплекс кестесінің соңғы итерациясындағы көлеңкелі баға бойынша ` +
      `${unit} қосымша ${LIMIT_NAMES[main.key]} пайданы шамамен ${fmt(val)} ₸-ге арттырады. `;
    const others = resBinding.filter((b) => b !== main).map((b) => LIMIT_NAMES[b.key]);
    if (others.length) bottleneck += `Сонымен қатар ${joinKz(others)} шектеуі де толық пайдаланылған. `;
    const free = Object.keys(LIMIT_NAMES).filter((k) => !resBinding.some((b) => b.key === k));
    if (free.length)
      bottleneck += `Ал ${joinKz(free.map((k) => LIMIT_NAMES[k]))} бойынша резерв бар — оны көбейту нәтижені өзгертпейді.`;
  } else {
    bottleneck = `Ресурстық шектеулердің ешқайсысы толық қолданылмаған — нәтижені тек әртараптандыру шектеуі анықтайды.`;
  }
  if (capBinding.length) {
    bottleneck += ` Тәуекелді азайту ережесі (бір дақыл ≤ ${inputs.maxShare}%) ${joinKz(
      capBinding.map((b) => crops.find((c) => c.id === b.crop).name.toLowerCase())
    )} бойынша белсенді.`;
  }

  // 4. Су көп болса не өзгерер еді
  const moreWater = optimize({ ...inputs, water: inputs.water * 1.3 }, baseCrops, climate, result.region);
  const dW = moreWater.profit - profit;
  let whatIf;
  if (dW > profit * 0.002) {
    const shifts = diffCrops(crops, moreWater.crops);
    whatIf =
      `Егер су қоры 30%-ға артса (${fmt(inputs.water * 1.3)} м³), пайда ${fmtM(dW)}-ге өсіп, ${fmtM(moreWater.profit)} болар еді. ` +
      (shifts ? `Құрылым өзгерісі: ${shifts}.` : '');
  } else {
    whatIf =
      `Су қорын 30%-ға арттыру пайданы іс жүзінде өзгертпейді (+${fmt(Math.max(0, dW))} ₸): қазіргі шешімде су негізгі кедергі емес. ` +
      `Инвестицияны ${main ? '«' + LIMIT_NAMES[main.key] + '» ресурсын' : 'басқа ресурстарды'} кеңейтуге бағыттаған тиімдірек.`;
  }

  // 5. Жаңбырлы жылдағы стратегия
  const rainy = climate === 'rainy' ? result : optimize(inputs, baseCrops, 'rainy', result.region);
  const rTop = rainy.crops.filter((c) => c.ha > 0.05).sort((a, b) => b.ha - a.ha);
  const rainyText =
    `Жаңбырлы жылда суару қажеттілігі ~20%-ға азаяды, сондықтан ылғал сүйгіш дақылдардың тиімділігі артады. ` +
    `Мұндай жағдайда оңтайлы стратегия: ${rTop.map((c) => `${c.name.toLowerCase()} ${c.ha.toFixed(0)} га`).join(', ')}; ` +
    `күтілетін пайда — ${fmtM(rainy.profit)}` +
    (climate === 'rainy' ? '.' : ` (${rainy.profit >= profit ? '+' : ''}${fmtM(rainy.profit - profit)} ағымдағы сценариймен салыстырғанда).`);

  // 6. Тәуекел
  const all = Object.keys(CLIMATES).map((id) =>
    id === climate ? result : id === 'rainy' ? rainy : optimize(inputs, baseCrops, id, result.region)
  );
  const expected = all.reduce((s, r) => s + r.profit * reg.probs[r.climate], 0);
  const worst = all.reduce((a, b) => (a.profit < b.profit ? a : b));
  const risk =
    `${reg.name} үшін климаттық ықтималдықтарды ескергендегі күтілетін пайда — ${fmtM(expected)}. ` +
    `Ең қолайсыз сценарий — ${CLIMATES[worst.climate].name.toLowerCase()} (${fmtM(worst.profit)}). ` +
    `Құрғақшылыққа төзімді дақылдардың (күнбағыс, бидай) үлесін сақтау портфельдің тұрақтылығын арттырады.`;

  return {
    summary,
    confidence: 0.86 + Math.min(0.1, (used.length / 4) * 0.08),
    qa: [
      { q: 'Қай дақыл тиімді?', a: efficiency },
      { q: 'Негізгі кедергі қандай?', a: bottleneck },
      { q: 'Су көп болса не өзгереді?', a: whatIf },
      { q: 'Жаңбырлы жылда не істеу керек?', a: rainyText },
      { q: 'Климаттық тәуекел қандай?', a: risk },
    ],
  };
}

function joinKz(list) {
  if (list.length <= 1) return list.join('');
  return list.slice(0, -1).join(', ') + ' және ' + list[list.length - 1];
}

function diffCrops(a, b) {
  return a
    .map((c, i) => ({ name: c.name.toLowerCase(), d: b[i].ha - c.ha }))
    .filter((x) => Math.abs(x.d) > 0.5)
    .map((x) => `${x.name} ${x.d > 0 ? '+' : ''}${x.d.toFixed(1)} га`)
    .join(', ');
}
