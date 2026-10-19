// Дақылдардың базалық параметрлері (қалыпты жыл, 1 га үшін)
export const CROPS = [
  {
    id: 'wheat',
    name: 'Бидай',
    latin: 'Triticum aestivum',
    color: '#E3B23C',
    water: 30, // м³/га
    cost: 90000, // ₸/га
    yield: 2.8, // т/га
    price: 85000, // ₸/т
    drought: 0.88,
    rain: 1.06,
  },
  {
    id: 'corn',
    name: 'Жүгері',
    latin: 'Zea mays',
    color: '#8BC34A',
    water: 50,
    cost: 130000,
    yield: 6.5,
    price: 52000,
    drought: 0.8,
    rain: 1.1,
  },
  {
    id: 'rice',
    name: 'Күріш',
    latin: 'Oryza sativa',
    color: '#3BB3A3',
    water: 80,
    cost: 180000,
    yield: 5.0,
    price: 95000,
    drought: 0.7,
    rain: 1.15,
  },
  {
    id: 'sunflower',
    name: 'Күнбағыс',
    latin: 'Helianthus annuus',
    color: '#F2925A',
    water: 25,
    cost: 110000,
    yield: 2.0,
    price: 145000,
    drought: 0.94,
    rain: 1.04,
  },
];

export const CLIMATES = {
  dry: {
    id: 'dry',
    name: 'Құрғақ жыл',
    short: 'Құрғақ',
    waterAvail: 0.8,
    waterNeed: 1.18,
    yieldKey: 'drought',
    desc: 'Су қоры азаяды, булану күшейеді, өнімділік төмендейді.',
  },
  normal: {
    id: 'normal',
    name: 'Қалыпты жыл',
    short: 'Қалыпты',
    waterAvail: 1,
    waterNeed: 1,
    yieldKey: null,
    desc: 'Көпжылдық орташа көрсеткіштер, түзету коэффициенттері жоқ.',
  },
  rainy: {
    id: 'rainy',
    name: 'Жаңбырлы жыл',
    short: 'Жаңбырлы',
    waterAvail: 1.12,
    waterNeed: 0.8,
    yieldKey: 'rain',
    desc: 'Жауын-шашын суару қажеттілігін азайтады, өнімділік өседі.',
  },
};

// Аймақтық коэффициенттер және көпжылдық климаттық статистика
export const REGIONS = [
  {
    id: 'almaty',
    name: 'Алматы облысы',
    factors: { wheat: 1.0, corn: 1.08, rice: 0.95, sunflower: 1.0 },
    probs: { dry: 0.24, normal: 0.52, rainy: 0.24 },
    precip: 470,
    temp: 1.3,
    soil: 'Сұр-қоңыр топырақ',
  },
  {
    id: 'akmola',
    name: 'Ақмола облысы',
    factors: { wheat: 1.12, corn: 0.84, rice: 0.6, sunflower: 1.02 },
    probs: { dry: 0.38, normal: 0.46, rainy: 0.16 },
    precip: 320,
    temp: 1.6,
    soil: 'Қара топырақ',
  },
  {
    id: 'kostanay',
    name: 'Қостанай облысы',
    factors: { wheat: 1.15, corn: 0.8, rice: 0.55, sunflower: 1.06 },
    probs: { dry: 0.41, normal: 0.44, rainy: 0.15 },
    precip: 300,
    temp: 1.7,
    soil: 'Қара топырақ',
  },
  {
    id: 'turkistan',
    name: 'Түркістан облысы',
    factors: { wheat: 0.95, corn: 1.06, rice: 1.08, sunflower: 0.96 },
    probs: { dry: 0.47, normal: 0.39, rainy: 0.14 },
    precip: 260,
    temp: 1.9,
    soil: 'Сұр топырақ',
  },
  {
    id: 'kyzylorda',
    name: 'Қызылорда облысы',
    factors: { wheat: 0.84, corn: 0.94, rice: 1.2, sunflower: 0.86 },
    probs: { dry: 0.56, normal: 0.34, rainy: 0.1 },
    precip: 150,
    temp: 2.1,
    soil: 'Сортаңды топырақ',
  },
  {
    id: 'east',
    name: 'Шығыс Қазақстан',
    factors: { wheat: 1.02, corn: 0.9, rice: 0.62, sunflower: 1.2 },
    probs: { dry: 0.22, normal: 0.5, rainy: 0.28 },
    precip: 410,
    temp: 1.2,
    soil: 'Қара-қоңыр топырақ',
  },
];

export const DEFAULTS = {
  land: 100,
  water: 5000,
  budget: 12000000,
  maxShare: 40,
  region: 'almaty',
  climate: 'normal',
};

export const CROP_ICONS = {
  wheat: `<svg viewBox="0 0 64 64" fill="none"><path d="M32 60V20" stroke="#B98A1E" stroke-width="3" stroke-linecap="round"/><g fill="#E3B23C"><ellipse cx="32" cy="12" rx="4" ry="7"/><ellipse cx="25" cy="22" rx="3.5" ry="6.5" transform="rotate(-30 25 22)"/><ellipse cx="39" cy="22" rx="3.5" ry="6.5" transform="rotate(30 39 22)"/><ellipse cx="25" cy="33" rx="3.5" ry="6.5" transform="rotate(-30 25 33)"/><ellipse cx="39" cy="33" rx="3.5" ry="6.5" transform="rotate(30 39 33)"/><ellipse cx="25" cy="44" rx="3.5" ry="6.5" transform="rotate(-30 25 44)"/><ellipse cx="39" cy="44" rx="3.5" ry="6.5" transform="rotate(30 39 44)"/></g></svg>`,
  corn: `<svg viewBox="0 0 64 64" fill="none"><path d="M18 58c4-14 8-22 14-28" stroke="#5E9E2F" stroke-width="5" stroke-linecap="round"/><path d="M46 58c-4-14-8-22-14-28" stroke="#7CB342" stroke-width="5" stroke-linecap="round"/><rect x="24" y="6" width="16" height="36" rx="8" fill="#F5C842"/><g fill="#E0A82E"><circle cx="29" cy="14" r="2"/><circle cx="35" cy="14" r="2"/><circle cx="29" cy="21" r="2"/><circle cx="35" cy="21" r="2"/><circle cx="29" cy="28" r="2"/><circle cx="35" cy="28" r="2"/><circle cx="29" cy="35" r="2"/><circle cx="35" cy="35" r="2"/></g></svg>`,
  rice: `<svg viewBox="0 0 64 64" fill="none"><path d="M6 54h52" stroke="#5AC8E8" stroke-width="4" stroke-linecap="round"/><g stroke="#2E9C8C" stroke-width="3" stroke-linecap="round"><path d="M32 54V18"/><path d="M32 40c-6-4-10-12-12-22"/><path d="M32 40c6-4 10-12 12-22"/><path d="M32 46c-9-2-15-8-19-16"/><path d="M32 46c9-2 15-8 19-16"/></g><g fill="#D9C27A"><circle cx="20" cy="16" r="2.5"/><circle cx="44" cy="16" r="2.5"/><circle cx="32" cy="14" r="2.5"/><circle cx="13" cy="28" r="2.5"/><circle cx="51" cy="28" r="2.5"/></g></svg>`,
  sunflower: `<svg viewBox="0 0 64 64" fill="none"><path d="M32 60V34" stroke="#5E9E2F" stroke-width="4" stroke-linecap="round"/><path d="M32 50c-6 0-11-4-12-9 6 0 11 3 12 9z" fill="#7CB342"/><g fill="#F7B731">${Array.from({ length: 12 }, (_, i) => `<ellipse cx="32" cy="8" rx="4" ry="8" transform="rotate(${i * 30} 32 22)"/>`).join('')}</g><circle cx="32" cy="22" r="8" fill="#7A4A1E"/></svg>`,
};
