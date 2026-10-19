// Симплекс әдісі (кестелік түрі).
// max c·x,  A·x ≤ b,  x ≥ 0,  b ≥ 0  — бастапқы базис ретінде қосымша (slack) айнымалылар алынады.

const EPS = 1e-9;

export function simplex(c, A, b, { maxIter = 200 } = {}) {
  const n = c.length;
  const m = A.length;
  const width = n + m + 1;
  const rhs = width - 1;

  const T = A.map((row, i) => {
    const r = new Array(width).fill(0);
    row.forEach((v, j) => (r[j] = v));
    r[n + i] = 1;
    r[rhs] = b[i];
    return r;
  });
  const z = new Array(width).fill(0);
  c.forEach((v, j) => (z[j] = -v));

  const basis = Array.from({ length: m }, (_, i) => n + i);
  const iterations = [{ iter: 0, entering: null, leaving: null, z: 0, basis: [...basis] }];
  let status = 'optimal';

  for (let it = 1; it <= maxIter; it++) {
    // Кіретін айнымалы: Z-жолындағы ең теріс коэффициент (Данциг ережесі)
    let e = -1;
    let min = -EPS;
    for (let j = 0; j < n + m; j++) {
      if (z[j] < min) {
        min = z[j];
        e = j;
      }
    }
    if (e < 0) break;

    // Шығатын айнымалы: минималды қатынас ережесі
    let l = -1;
    let best = Infinity;
    for (let i = 0; i < m; i++) {
      if (T[i][e] > EPS) {
        const ratio = T[i][rhs] / T[i][e];
        if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[l])) {
          best = ratio;
          l = i;
        }
      }
    }
    if (l < 0) {
      status = 'unbounded';
      break;
    }

    pivot(T, z, l, e);
    const leaving = basis[l];
    basis[l] = e;
    iterations.push({ iter: it, entering: e, leaving, z: z[rhs], basis: [...basis] });

    if (it === maxIter) status = 'iteration_limit';
  }

  const x = new Array(n).fill(0);
  basis.forEach((v, i) => {
    if (v < n) x[v] = Math.max(0, T[i][rhs]);
  });

  return {
    status,
    x,
    z: z[rhs],
    duals: z.slice(n, n + m), // көлеңкелі бағалар (ресурстың шекті құндылығы)
    reducedCosts: z.slice(0, n),
    iterations,
    tableau: T.map((r) => [...r]),
    zRow: [...z],
    basis,
  };
}

function pivot(T, z, l, e) {
  const p = T[l][e];
  const row = T[l];
  for (let j = 0; j < row.length; j++) row[j] /= p;
  for (let i = 0; i < T.length; i++) {
    if (i === l) continue;
    const f = T[i][e];
    if (Math.abs(f) < EPS) continue;
    for (let j = 0; j < row.length; j++) T[i][j] -= f * row[j];
  }
  const f = z[e];
  if (Math.abs(f) > EPS) for (let j = 0; j < row.length; j++) z[j] -= f * row[j];
}
