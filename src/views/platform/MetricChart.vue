<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { date, dateTime, time } from "@/domain/format"
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

// Линейный график прототипа (chart.area): SVG из данных, null в ряду — разрыв линии. fill — заливка под первым рядом.
const props = defineProps({
    at: { type: Array, required: true },
    series: { type: Array, required: true },
    fill: Boolean,
    long: Boolean,
    h: { type: Number, default: 180 },
    label: { type: String, default: "График" },
    fmt: { type: Function, default: (v) => String(v) }
})
const W = 1000
const H = 300
const niceMax = (v) => {
    const p = Math.pow(10, Math.floor(Math.log10(v)))
    return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((m) => m >= v)
}
// Подписи оси с одной десятичной: у малых значений (мс, сек/мин) шаг четвертей не теряется.
const axisNum = (v) => (v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace(".", ",") + " млн" : v >= 1000 ? String(Math.round(v / 100) / 10).replace(".", ",") + " тыс" : String(Math.round(v * 10) / 10).replace(".", ","))

const n = computed(() => props.at.length)
const max = computed(() => {
    let m = 1
    for (const s of props.series) for (const v of s.v) if (v > m) m = v
    return niceMax(m)
})
const x = (i) => (n.value === 1 ? W / 2 : (i / (n.value - 1)) * W)
const y = (v) => H - (v / max.value) * H
const paths = computed(() =>
    props.series.map((s) => {
        let d = ""
        let pen = false
        for (let i = 0; i < s.v.length; i++) {
            if (s.v[i] == null) {
                pen = false
                continue
            }
            d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(s.v[i]).toFixed(1)}`
            pen = true
        }
        return d
    })
)
const area = computed(() => (props.fill && paths.value[0] ? `${paths.value[0]} L${W} ${H} L0 ${H} Z` : ""))
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((t) => ({ t, l: axisNum(max.value * t) })))
const xLabels = computed(() => {
    const k = n.value
    const step = Math.max(1, Math.ceil(k / 6))
    const out = []
    for (let i = 0; i < k; i++) if ((i % step === 0 && k - 1 - i >= step) || i === k - 1) out.push({ i, left: (x(i) / W) * 100, l: props.long ? date(props.at[i]).slice(0, 5) : time(props.at[i]) })
    return out
})

/* Подсказка: указатель или палец над областью → курсор, точки рядов и значения в этой точке. */
const plot = ref(null)
const hover = ref(-1)
function move(ev) {
    const r = plot.value.getBoundingClientRect()
    hover.value = Math.max(0, Math.min(n.value - 1, Math.round(((ev.clientX - r.left) / r.width) * (n.value - 1))))
}
const xp = computed(() => (n.value === 1 ? 50 : (hover.value / (n.value - 1)) * 100))
// Касание оставляет подсказку на месте, пока не нажали в другом месте.
const away = (ev) => plot.value && !plot.value.contains(ev.target) && (hover.value = -1)
onMounted(() => document.addEventListener("pointerdown", away))
onBeforeUnmount(() => document.removeEventListener("pointerdown", away))
</script>

<template>
    <figure class="chart" :style="{ '--h': h + 'px' }" role="img" :aria-label="label">
        <div ref="plot" class="chart__plot" :class="{ 'is-hover': hover >= 0 }" @pointermove="move" @pointerdown="move" @pointerleave="$event.pointerType === 'mouse' && (hover = -1)">
            <div class="chart__grid">
                <span v-for="t in ticks" :key="t.t" :style="{ bottom: t.t * 100 + '%' }"
                    ><em>{{ t.l }}</em></span
                >
            </div>
            <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
                <path v-if="area" :d="area" :class="'chart__fill chart__fill--' + series[0].tone" />
                <path v-for="(d, i) in paths" :key="i" :d="d" :class="'chart__line chart__line--' + series[i].tone" vector-effect="non-scaling-stroke" />
            </svg>
            <template v-if="hover >= 0">
                <template v-for="s in series" :key="s.name"><i v-if="s.v[hover] != null" :class="'chart__dot chart__dot--' + s.tone" :style="{ left: xp + '%', bottom: (s.v[hover] / max) * 100 + '%' }"></i></template>
                <span class="chart__cursor" :style="{ left: xp + '%' }"></span>
                <div class="chart__tip" :style="{ left: `clamp(80px, ${xp}%, calc(100% - 80px))` }">
                    <b>{{ dateTime(at[hover]) }}</b>
                    <span v-for="s in series" :key="s.name"><i :class="'sw sw--' + s.tone"></i>{{ s.name ? s.name + ": " : "" }}{{ s.v[hover] == null ? "–" : fmt(s.v[hover]) }}</span>
                </div>
            </template>
        </div>
        <div class="chart__x">
            <span v-for="t in xLabels" :key="t.i" :style="{ left: t.left + '%' }">{{ t.l }}</span>
        </div>
    </figure>
</template>
