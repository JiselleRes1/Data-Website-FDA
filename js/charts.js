// Shared ECharts styling + lazy scroll-triggered init, used by report.js and
// dashboard.js. Charts render into <div class="echart" id="...">, not
// <canvas> — ECharts owns its own canvas internally.

const cssVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();

const CHART_TEXT = () => cssVar('--text-secondary');
const CHART_MUTED = () => cssVar('--text-muted');
const CHART_GRID = () => cssVar('--gridline');
const CHART_SURFACE = () => cssVar('--surface-1');

function gradientFill(hex) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: hex },
    { offset: 1, color: hex + '33' },
  ]);
}

function gradientFillH(hex) {
  return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: hex + '55' },
    { offset: 1, color: hex },
  ]);
}

const chartInstances = new Map();

// Lazily creates an ECharts instance in `dom` and calls optionFn() to get
// its option the first time the element scrolls into view (so the chart
// visibly draws itself in). Returns a setter you can call again later
// (e.g. on filter change) to update an already-visible chart immediately.
function lazyChart(domId, optionFn) {
  const dom = document.getElementById(domId);
  if (!dom) return () => {};

  const apply = () => {
    let chart = chartInstances.get(domId);
    if (!chart) {
      chart = echarts.init(dom, null, { renderer: 'canvas' });
      chartInstances.set(domId, chart);
      window.addEventListener('resize', () => chart.resize());
    }
    chart.setOption(optionFn(), true);
  };

  if (!dom.dataset.observed) {
    dom.dataset.observed = '1';
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        apply();
        io.disconnect();
      }
    }, { threshold: 0.15 });
    io.observe(dom);
  } else {
    apply();
  }

  return apply;
}

function tooltipStyle() {
  return {
    backgroundColor: '#1c1815',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    textStyle: { color: cssVar('--text-primary'), fontFamily: 'Inter, sans-serif', fontSize: 12 },
    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.5); border-radius: 8px;',
  };
}

function barOption(categories, values, { color, valueFormatter = (v) => v, horizontal = false } = {}) {
  const grad = gradientFill(color || cssVar('--gold'));
  const valueAxis = {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: CHART_GRID() } },
    axisLabel: { color: CHART_MUTED(), formatter: valueFormatter, fontSize: 11 },
  };
  const catAxis = {
    type: 'category',
    data: categories,
    axisLine: { lineStyle: { color: CHART_GRID() } },
    axisTick: { show: false },
    axisLabel: { color: CHART_TEXT(), fontSize: 11, interval: 0, rotate: horizontal ? 0 : (categories.length > 8 ? 35 : 0) },
  };
  return {
    backgroundColor: 'transparent',
    grid: { left: horizontal ? 90 : 48, right: 20, top: 20, bottom: horizontal ? 20 : (categories.length > 8 ? 60 : 32) },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipStyle(), valueFormatter },
    xAxis: horizontal ? valueAxis : catAxis,
    yAxis: horizontal ? catAxis : valueAxis,
    series: [{
      type: 'bar',
      data: values,
      itemStyle: { color: grad, borderRadius: horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0] },
      emphasis: { itemStyle: { color: color || cssVar('--gold') } },
      barMaxWidth: 42,
      animationDuration: 900,
      animationEasing: 'cubicOut',
    }],
  };
}

function bubbleOption(points, { xFmt = (v) => v, yFmt = (v) => v, xLabel = '', yLabel = '' } = {}) {
  const palette = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'];
  const maxR = Math.max(...points.map((p) => p.r));
  return {
    backgroundColor: 'transparent',
    grid: { left: 60, right: 24, top: 24, bottom: 48 },
    tooltip: {
      ...tooltipStyle(),
      formatter: (p) => {
        const pt = points[p.dataIndex];
        return `<b>${pt.label}</b><br/>${xLabel}: ${xFmt(pt.x)}<br/>${yLabel}: ${yFmt(pt.y)}${pt.tooltipExtra ? '<br/>' + pt.tooltipExtra : ''}`;
      },
    },
    xAxis: {
      type: 'value', name: xLabel, nameLocation: 'middle', nameGap: 30,
      nameTextStyle: { color: CHART_MUTED(), fontSize: 11 },
      axisLine: { lineStyle: { color: CHART_GRID() } }, axisTick: { show: false },
      splitLine: { lineStyle: { color: CHART_GRID() } },
      axisLabel: { color: CHART_MUTED(), formatter: xFmt, fontSize: 10 },
    },
    yAxis: {
      type: 'value', name: yLabel, nameLocation: 'middle', nameGap: 46,
      nameTextStyle: { color: CHART_MUTED(), fontSize: 11 },
      axisLine: { lineStyle: { color: CHART_GRID() } }, axisTick: { show: false },
      splitLine: { lineStyle: { color: CHART_GRID() } },
      axisLabel: { color: CHART_MUTED(), formatter: yFmt, fontSize: 10 },
    },
    series: [{
      type: 'scatter',
      data: points.map((p) => ({ value: [p.x, p.y] })),
      symbolSize: (val, params) => 8 + (points[params.dataIndex].r / maxR) * 46,
      itemStyle: {
        color: (params) => {
          const hex = cssVar(palette[params.dataIndex % palette.length]);
          return new echarts.graphic.RadialGradient(0.4, 0.4, 0.7, [
            { offset: 0, color: hex + 'ee' },
            { offset: 1, color: hex + '66' },
          ]);
        },
        borderColor: (params) => cssVar(palette[params.dataIndex % palette.length]),
        borderWidth: 1.5,
        shadowBlur: 12,
        shadowColor: 'rgba(0,0,0,0.4)',
      },
      animationDuration: 1000,
      animationEasing: 'elasticOut',
    }],
  };
}
