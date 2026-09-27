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
// Holds the most recently requested apply() per chart, so a pending
// IntersectionObserver (registered before the first render) fires the
// LATEST render instead of a stale one captured when it was created — this
// matters because filters (e.g. the genre picker) can change the data
// before a chart has ever scrolled into view.
const chartLatestApply = new Map();

// Lazily creates an ECharts instance in `dom` and calls optionFn() to get
// its option the first time the element scrolls into view (so the chart
// visibly draws itself in). Pass `afterFn(chart)` to run once the chart has
// finished animating in (e.g. to overlay poster-medallion graphics that need
// the final axis pixel positions). Returns a setter you can call again later
// (e.g. on filter change) to update an already-visible chart immediately.
function lazyChart(domId, optionFn, afterFn) {
  const dom = document.getElementById(domId);
  if (!dom) return () => {};

  const apply = () => {
    let chart = chartInstances.get(domId);
    if (!chart) {
      chart = echarts.init(dom, null, { renderer: 'canvas' });
      chartInstances.set(domId, chart);
      window.addEventListener('resize', () => {
        chart.resize();
        if (chart._lastAfterFn) chart._lastAfterFn(chart);
      });
    }
    chart._lastAfterFn = afterFn;
    chart.setOption(optionFn(), true);
    if (afterFn) {
      const onFinished = () => { afterFn(chart); chart.off('finished', onFinished); };
      chart.on('finished', onFinished);
    }
  };

  chartLatestApply.set(domId, apply);

  if (!dom.dataset.observed) {
    dom.dataset.observed = '1';
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const latest = chartLatestApply.get(domId);
        if (latest) latest();
        io.disconnect();
      }
    }, { threshold: 0.15 });
    io.observe(dom);
  } else {
    apply();
  }

  return apply;
}

// ---- Poster medallions + rich poster tooltips (decorative, genre-aware) ----
let GENRE_POSTERS = {};
function setGenrePosters(map) { GENRE_POSTERS = map || {}; }
function posterUrl(path, size = 'w92') { return `https://image.tmdb.org/t/p/${size}${path}`; }

// items: [{ label, x, y }] in the chart's own data coordinates (category
// index or value, matching what convertToPixel expects for that chart).
function addPosterToppers(chart, items, { offsetY = 8 } = {}) {
  const w = 30, h = 44;
  const elements = [];
  items.forEach(({ label, x, y }) => {
    const info = GENRE_POSTERS[label];
    if (!info) return;
    let px, py;
    try {
      [px, py] = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [x, y]);
    } catch (e) { return; }
    if (px == null || py == null || Number.isNaN(px) || Number.isNaN(py)) return;
    elements.push({
      type: 'image',
      id: `poster-${label}`,
      style: {
        image: posterUrl(info.poster_path), x: 0, y: 0, width: w, height: h,
        shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.65)',
      },
      x: px - w / 2,
      y: py - h - offsetY,
      z: 50,
      silent: true,
    });
  });
  chart.setOption({ graphic: { elements } });
}

// A tooltip formatter that shows the genre's representative poster + title
// alongside the value. Falls back to a plain label/value tooltip when the
// category isn't a known genre (e.g. decade/language breakdowns).
function genreTooltipFormatter(valueFormatter) {
  return (params) => {
    const p = Array.isArray(params) ? params[0] : params;
    const name = p.name || (Array.isArray(p.value) ? p.value[0] : '');
    const rawValue = Array.isArray(p.value) ? p.value[p.value.length - 1] : p.value;
    const val = valueFormatter(rawValue);
    const info = GENRE_POSTERS[name];
    if (!info) return `<b>${name}</b><br/>${val}`;
    return `
      <div style="display:flex;gap:10px;align-items:flex-start;max-width:220px;">
        <img src="${posterUrl(info.poster_path)}" style="width:50px;border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,0.6);flex:none;">
        <div>
          <div style="font-weight:700;color:#f4efe4;">${name}</div>
          <div style="font-size:12px;color:#b8b0a3;margin:2px 0 4px;">${val}</div>
          <div style="font-size:10.5px;color:#7a7268;font-style:italic;">${info.title}</div>
        </div>
      </div>`;
  };
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

function barOption(categories, values, { color, valueFormatter = (v) => v, horizontal = false, genreAware = false } = {}) {
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
    grid: { left: horizontal ? 90 : 48, right: 20, top: genreAware && !horizontal ? 66 : 20, bottom: horizontal ? 20 : (categories.length > 8 ? 60 : 32) },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipStyle(),
      ...(genreAware ? { formatter: genreTooltipFormatter(valueFormatter) } : { valueFormatter }),
    },
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

// A circular "film reel" bar chart: same data as barOption, but wrapped
// around a polar axis instead of a cartesian grid. Genre-aware tooltip only
// (no poster medallions — polar pixel geometry isn't worth the complexity).
function radialBarOption(categories, values, { color, valueFormatter = (v) => v } = {}) {
  const grad = gradientFill(color || cssVar('--gold'));
  return {
    backgroundColor: 'transparent',
    polar: { radius: ['12%', '78%'], center: ['50%', '52%'] },
    angleAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: CHART_GRID() } },
      axisTick: { show: false },
      axisLabel: { color: CHART_TEXT(), fontSize: 10 },
    },
    radiusAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: CHART_GRID() } },
      axisLabel: { color: CHART_MUTED(), fontSize: 9, formatter: valueFormatter },
    },
    tooltip: { ...tooltipStyle(), formatter: genreTooltipFormatter(valueFormatter) },
    series: [{
      type: 'bar',
      data: values,
      coordinateSystem: 'polar',
      itemStyle: { color: grad },
      roundCap: true,
      animationDuration: 1000,
      animationEasing: 'cubicOut',
    }],
  };
}

function bubbleOption(points, { xFmt = (v) => v, yFmt = (v) => v, xLabel = '', yLabel = '' } = {}) {
  const palette = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'];
  const maxR = Math.max(...points.map((p) => p.r));
  return {
    backgroundColor: 'transparent',
    grid: { left: 60, right: 24, top: 64, bottom: 48 },
    tooltip: {
      ...tooltipStyle(),
      formatter: (p) => {
        const pt = points[p.dataIndex];
        const info = GENRE_POSTERS[pt.label];
        const body = `<div style="font-weight:700;color:#f4efe4;">${pt.label}</div>
          <div style="font-size:12px;color:#b8b0a3;margin:2px 0 4px;">${xLabel}: ${xFmt(pt.x)}<br/>${yLabel}: ${yFmt(pt.y)}</div>
          ${pt.tooltipExtra ? `<div style="font-size:11px;color:#b8b0a3;">${pt.tooltipExtra}</div>` : ''}
          ${info ? `<div style="font-size:10.5px;color:#7a7268;font-style:italic;margin-top:2px;">${info.title}</div>` : ''}`;
        if (!info) return `<div style="max-width:200px;">${body}</div>`;
        return `<div style="display:flex;gap:10px;align-items:flex-start;max-width:230px;">
          <img src="${posterUrl(info.poster_path)}" style="width:50px;border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,0.6);flex:none;">
          <div>${body}</div>
        </div>`;
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
