// Dashboard logic: load the dataset, wire up filters/switches, render charts + table.
// TODO once a dataset is chosen:
//   1. Fetch the data file from ../data/ (CSV via a small parser, or JSON).
//   2. Populate the filter <select> options from the actual column values.
//   3. Implement applyFilters() to filter the in-memory rows.
//   4. Implement computeMeasure() for count/total/median/rate per breakdown value.
//   5. Wire measure/breakdown <select>s to re-render their chart.
//   6. Render the filtered rows into #data-table.

let rows = []; // TODO: populate from fetched dataset
let charts = {}; // chart-id -> Chart.js instance

const state = {
  filters: {}, // e.g. { time: '', group: '', cat1: '', cat2: '' }
};

function applyFilters() {
  // TODO: return rows matching state.filters
  return rows;
}

function computeMeasure(filteredRows, measure, breakdownColumn) {
  // TODO: group filteredRows by breakdownColumn, compute count/total/median/rate
  return { labels: [], values: [] };
}

function renderStats(filteredRows) {
  // TODO: compute and set #stat-1..#stat-4 from filteredRows
}

function renderChart(chartNum, filteredRows) {
  const canvas = document.getElementById(`chart-${chartNum}`);
  if (!canvas) return;
  const measureSel = document.querySelector(`select[data-role="measure"][data-chart="${chartNum}"]`);
  const breakdownSel = document.querySelector(`select[data-role="breakdown"][data-chart="${chartNum}"]`);
  const { labels, values } = computeMeasure(filteredRows, measureSel?.value, breakdownSel?.value);

  if (charts[chartNum]) charts[chartNum].destroy();
  const seriesColor = getComputedStyle(document.body).getPropertyValue(`--series-${chartNum}`).trim();
  charts[chartNum] = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: seriesColor, borderRadius: 4 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true }, x: { grid: { display: false } } },
    },
  });
}

function renderTable(filteredRows) {
  // TODO: render filteredRows (or a summary of them) into #data-table
}

function renderAll() {
  const filtered = applyFilters();
  renderStats(filtered);
  for (let i = 1; i <= 4; i++) renderChart(i, filtered);
  renderTable(filtered);
}

document.querySelectorAll('.filter-bar select').forEach((sel) => {
  sel.addEventListener('change', () => {
    state.filters[sel.id] = sel.value;
    renderAll();
  });
});

document.querySelectorAll('.chart-controls select').forEach((sel) => {
  sel.addEventListener('change', () => {
    const chartNum = sel.dataset.chart;
    renderChart(Number(chartNum), applyFilters());
  });
});

document.getElementById('reset-filters').addEventListener('click', () => {
  document.querySelectorAll('.filter-bar select').forEach((sel) => (sel.value = ''));
  state.filters = {};
  renderAll();
});

renderAll();
