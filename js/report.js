// Renders the report page's headline numbers and 8 finding charts.
// TODO: once a dataset is chosen, load it (fetch a CSV/JSON from ../data/)
// and replace the placeholder values/charts below with real computed numbers.

Chart.defaults.font.family = getComputedStyle(document.body).getPropertyValue('--font') || 'system-ui, sans-serif';
Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim();
Chart.defaults.borderColor = getComputedStyle(document.body).getPropertyValue('--gridline').trim();

const seriesColor = (n) =>
  getComputedStyle(document.body).getPropertyValue(`--series-${n}`).trim();

// Placeholder chart so the page renders something before real data exists.
function placeholderChart(canvasId, seriesIndex) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  new Chart(el, {
    type: 'bar',
    data: {
      labels: ['A', 'B', 'C', 'D', 'E'],
      datasets: [{
        label: 'TODO',
        data: [3, 5, 2, 6, 4],
        backgroundColor: seriesColor(seriesIndex),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: getComputedStyle(document.body).getPropertyValue('--gridline') } },
        x: { grid: { display: false } },
      },
    },
  });
}

for (let i = 1; i <= 8; i++) {
  placeholderChart(`chart-${i}`, ((i - 1) % 8) + 1);
}
