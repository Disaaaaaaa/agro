import Chart from 'chart.js/auto';
import { CLIMATES } from './data.js';

Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#5B6B63';
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17, 38, 30, 0.92)';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 10;

const nf = new Intl.NumberFormat('ru-RU');
const charts = {};

function upsert(id, config) {
  if (charts[id]) {
    const c = charts[id];
    c.data = config.data;
    c.options = config.options;
    c.update();
    return c;
  }
  charts[id] = new Chart(document.getElementById(id), config);
  return charts[id];
}

export function renderCharts(result) {
  const used = result.crops.filter((c) => c.ha > 0.05);
  const fallow = Math.max(0, result.limits.land - result.usage.land);
  const labels = used.map((c) => c.name);
  const colors = used.map((c) => c.color);
  if (fallow > 0.3) {
    labels.push('Бос жер');
    colors.push('#CBBBA0');
  }

  upsert('pieChart', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: [...used.map((c) => +c.ha.toFixed(1)), ...(fallow > 0.3 ? [+fallow.toFixed(1)] : [])],
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 3,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw} га (${Math.round((ctx.raw / result.limits.land) * 100)}%)`,
          },
        },
      },
      animation: { animateRotate: true, duration: 900 },
    },
  });

  const all = result.crops.filter((c) => c.enabled !== false);
  upsert('barChart', {
    type: 'bar',
    data: {
      labels: all.map((c) => c.name),
      datasets: [
        {
          label: 'Таза пайда, ₸',
          data: all.map((c) => Math.round(c.profitTotal)),
          backgroundColor: '#22C55E',
          borderRadius: 8,
          yAxisID: 'y',
        },
        {
          label: 'Шығын, ₸',
          data: all.map((c) => Math.round(c.costUse)),
          backgroundColor: '#FBBF24',
          borderRadius: 8,
          yAxisID: 'y',
        },
        {
          label: 'Су, м³',
          data: all.map((c) => Math.round(c.waterUse)),
          backgroundColor: '#38BDF8',
          borderRadius: 8,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false } },
        y: {
          position: 'left',
          grid: { color: 'rgba(20,60,40,0.06)' },
          ticks: { callback: (v) => (v / 1e6).toFixed(1) + ' млн' },
          title: { display: true, text: '₸' },
        },
        y1: {
          position: 'right',
          grid: { display: false },
          ticks: { callback: (v) => nf.format(v) },
          title: { display: true, text: 'м³' },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${nf.format(ctx.raw)}` } },
      },
    },
  });
}

export function renderCompareChart(compare, crops) {
  const ids = Object.keys(CLIMATES);
  const palette = { dry: '#F59E0B', normal: '#22C55E', rainy: '#38BDF8' };
  const enabled = crops.filter((c) => c.enabled !== false);
  upsert('compareChart', {
    type: 'bar',
    data: {
      labels: enabled.map((c) => c.name),
      datasets: ids.map((id) => ({
        label: CLIMATES[id].name,
        data: enabled.map((c) => +compare[id].crops.find((x) => x.id === c.id).ha.toFixed(1)),
        backgroundColor: palette[id],
        borderRadius: 6,
      })),
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(20,60,40,0.06)' }, title: { display: true, text: 'га' } },
      },
      plugins: { legend: { position: 'bottom' } },
    },
  });
}
