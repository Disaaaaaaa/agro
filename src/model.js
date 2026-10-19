import { CLIMATES, REGIONS } from './data.js';
import { simplex } from './simplex.js';

export const regionById = (id) => REGIONS.find((r) => r.id === id) || REGIONS[0];

// Климат пен аймақты ескере отырып, дақылдың тиімді параметрлерін есептеу
export function effectiveCrops(crops, climateId, regionId) {
  const cl = CLIMATES[climateId];
  const reg = regionById(regionId);
  return crops.map((c) => {
    const climateK = cl.yieldKey ? c[cl.yieldKey] : 1;
    const regionK = reg.factors[c.id] ?? 1;
    const water = c.water * cl.waterNeed;
    const yieldT = c.yield * climateK * regionK;
    const revenue = yieldT * c.price;
    const profit = revenue - c.cost;
    return { ...c, water, yieldT, revenue, profit, climateK, regionK };
  });
}

export function buildModel(inputs, crops, climateId) {
  const cl = CLIMATES[climateId];
  const active = crops.filter((c) => c.enabled !== false);
  const waterAvail = inputs.water * cl.waterAvail;

  const c = active.map((k) => Math.max(0, k.profit));
  const A = [active.map(() => 1), active.map((k) => k.water), active.map((k) => k.cost)];
  const b = [inputs.land, waterAvail, inputs.budget];
  const rows = [
    { key: 'land', name: 'Жер', unit: 'га' },
    { key: 'water', name: 'Су', unit: 'м³' },
    { key: 'budget', name: 'Бюджет', unit: '₸' },
  ];

  if (inputs.maxShare < 100) {
    const cap = (inputs.land * inputs.maxShare) / 100;
    active.forEach((k, i) => {
      A.push(active.map((_, j) => (j === i ? 1 : 0)));
      b.push(cap);
      rows.push({ key: 'cap_' + k.id, name: `${k.name} үлесі`, unit: 'га', crop: k.id });
    });
  }

  return { active, c, A, b, rows, waterAvail };
}

export function optimize(inputs, baseCrops, climateId = inputs.climate, regionId = inputs.region) {
  const crops = effectiveCrops(baseCrops, climateId, regionId);
  const model = buildModel(inputs, crops, climateId);
  const sol = simplex(model.c, model.A, model.b);

  const alloc = crops.map((k) => {
    const idx = model.active.indexOf(k);
    const ha = idx >= 0 ? sol.x[idx] : 0;
    return {
      ...k,
      ha,
      waterUse: ha * k.water,
      costUse: ha * k.cost,
      revenueTotal: ha * k.revenue,
      profitTotal: ha * k.profit,
    };
  });

  const sum = (f) => alloc.reduce((s, a) => s + f(a), 0);
  const usage = {
    land: sum((a) => a.ha),
    water: sum((a) => a.waterUse),
    budget: sum((a) => a.costUse),
    revenue: sum((a) => a.revenueTotal),
  };

  const limits = { land: inputs.land, water: model.waterAvail, budget: inputs.budget };
  const binding = model.rows
    .map((r, i) => ({ ...r, dual: sol.duals[i], slack: model.b[i] - rowValue(model.A[i], sol.x) }))
    .filter((r) => r.dual > 1e-6);

  return {
    climate: climateId,
    region: regionId,
    inputs: { ...inputs },
    crops: alloc,
    profit: sol.z,
    usage,
    limits,
    binding,
    model,
    sol,
  };
}

const rowValue = (row, x) => row.reduce((s, v, j) => s + v * x[j], 0);

export function optimizeAllClimates(inputs, baseCrops) {
  return Object.keys(CLIMATES).reduce((acc, id) => {
    acc[id] = optimize(inputs, baseCrops, id);
    return acc;
  }, {});
}
