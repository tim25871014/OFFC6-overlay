<script setup>
import { ref, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue'
import Chart from 'chart.js/auto'

// Stacked, smoothed strain graph drawn with Chart.js.
// X axis: performance.graph.xaxis. Y: the aim/reading/speed series stacked
// bottom-to-top. The part of the graph past `live` (current play time, ms) is
// drawn desaturated so the coloured region reads as "already played".
const props = defineProps({
    graph: { type: Object, default: null },
    live: { type: Number, default: 0 }, // current play time in ms (beatmap.time.live)
    // gaussian low-pass radius as a fraction of the map length, so the curve
    // looks equally smooth regardless of how many points a map has (0 = off)
    smooth: { type: Number, default: 0.01 },
})

// bottom -> top stacking order. `fill` is the played colour (teal shades of
// ~#7ba4af); `gray` is its desaturated twin used past the live marker.
const layers = [
    { name: 'aim', fill: '#688f99', gray: '#848484' },     // bottom, darkest
    { name: 'reading', fill: '#7ba4af', gray: '#999999' }, // middle
    { name: 'speed', fill: '#95b9c1', gray: '#afafaf' },   // top, lightest
]

const canvas = ref(null)
const chart = shallowRef(null)
let xaxis = []          // current graph's x values (ms), for live comparisons
let lastBoundary = -1   // last data index the live marker sat on

// -100 is tosu's "no data" sentinel; clamp it (and any negative) to 0
const clean = (arr, len) => {
    const out = new Array(len).fill(0)
    if (Array.isArray(arr)) for (let i = 0; i < len; i++) out[i] = arr[i] > 0 ? arr[i] : 0
    return out
}

// Centered Gaussian smoothing: a zero-phase low-pass filter (unlike an EMA it
// doesn't shift the curve, so it stays aligned with the live marker).
const smoothSeries = (arr, r) => {
    if (r <= 0) return arr
    const sigma = r / 2
    const weights = []
    for (let k = -r; k <= r; k++) weights.push(Math.exp(-(k * k) / (2 * sigma * sigma)))
    const n = arr.length
    const out = new Array(n)
    for (let i = 0; i < n; i++) {
        let sum = 0
        let wsum = 0
        for (let k = -r; k <= r; k++) {
            const j = i + k
            if (j < 0 || j >= n) continue
            const w = weights[k + r]
            sum += arr[j] * w
            wsum += w
        }
        out[i] = wsum ? sum / wsum : arr[i]
    }
    return out
}

// number of points already played (x <= live)
const boundaryIndex = () => {
    let i = 0
    while (i < xaxis.length && xaxis[i] <= props.live) i++
    return i
}

// tosu pads the series head/tail with the -100 "no data" sentinel; real strain
// values are >= 0. Trim that padding so the actual content always fills the full
// (fixed) width, instead of shrinking for shorter maps.
const SENTINEL = -50
const contentRange = (series, len) => {
    let start = len
    let end = -1
    for (const arr of series) {
        if (!Array.isArray(arr)) continue
        for (let i = 0; i < arr.length; i++) if (arr[i] > SENTINEL) { start = Math.min(start, i); break }
        for (let i = arr.length - 1; i >= 0; i--) if (arr[i] > SENTINEL) { end = Math.max(end, i); break }
    }
    return end < start ? [0, len - 1] : [start, end]
}

const buildData = (graph) => {
    const rawXaxis = graph?.xaxis || []
    const byName = {}
    for (const s of graph?.series || []) byName[s.name] = s.data
    const [start, end] = contentRange(layers.map((l) => byName[l.name]), rawXaxis.length)
    const contentLen = end - start + 1

    // pad ~2% of the map length of zeros on each side so the curve eases from the
    // baseline (avoids a hard cut at the trimmed edges) once the LPF is applied
    const pad = Math.max(1, Math.round(contentLen * 0.02))
    // scale the LPF radius to the map length so smoothness is length-independent
    const smoothR = props.smooth > 0 ? Math.max(1, Math.round(contentLen * props.smooth)) : 0
    const step = contentLen > 1 ? (rawXaxis[end] - rawXaxis[start]) / (contentLen - 1) : 400
    const headX = Array.from({ length: pad }, (_, k) => rawXaxis[start] - step * (pad - k))
    const tailX = Array.from({ length: pad }, (_, k) => rawXaxis[end] + step * (k + 1))
    xaxis = [...headX, ...rawXaxis.slice(start, end + 1), ...tailX]
    const zeros = new Array(pad).fill(0)

    return {
        labels: xaxis,
        datasets: layers.map((l) => ({
            label: l.name,
            // zero-pad, then low-pass filter so head/tail ramp smoothly from 0
            data: smoothSeries(
                [...zeros, ...clean(byName[l.name]?.slice(start, end + 1), contentLen), ...zeros],
                smoothR,
            ),
            backgroundColor: l.fill,
            borderWidth: 0,
            fill: true,
            tension: 0,      // smooth the curve
            pointRadius: 0,
            spanGaps: true,
            // colour each fill segment by whether it is before/after the live marker
            segment: {
                backgroundColor: (ctx) => (xaxis[ctx.p1DataIndex] > props.live ? l.gray : l.fill),
            },
        })),
    }
}

const render = () => {
    const data = buildData(props.graph)
    lastBoundary = boundaryIndex()
    if (chart.value) {
        chart.value.data = data
        chart.value.update()
        return
    }
    chart.value = new Chart(canvas.value, {
        type: 'line',
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: null },
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { type: 'category', display: false },
                y: { stacked: true, display: false, min: 0 },
            },
            elements: { line: { borderJoinStyle: 'round' } },
        },
    })
}

watch(() => props.graph, render)
// live moves every tick; only repaint when it crosses to a new data point
watch(() => props.live, () => {
    if (!chart.value) return
    const b = boundaryIndex()
    if (b === lastBoundary) return
    lastBoundary = b
    chart.value.update('none')
})
onMounted(render)
onBeforeUnmount(() => {
    if (chart.value) chart.value.destroy()
    chart.value = null
})
</script>

<template>
    <div class="relative h-full w-full opacity-80">
        <canvas ref="canvas"></canvas>
    </div>
</template>
