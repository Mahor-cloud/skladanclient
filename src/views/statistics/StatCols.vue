<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { computed, ref } from "vue"
import { axisNum, niceMax } from "./statistics"

// Сгруппированные столбики. groups: [{ key, l, v: [...], tip }], series: [{ name, tone }].
// sparse — нулевой столбик не рисуется (пустое место на оси); pickable — столбик нажимается (событие pick(key)), sel — выбранный.
const props = defineProps({
    groups: { type: Array, required: true },
    series: { type: Array, required: true },
    h: { type: Number, default: 200 },
    label: { type: String, default: "График" },
    sparse: Boolean,
    pickable: Boolean,
    sel: { type: String, default: null },
    cls: { type: String, default: "" }
})
const emit = defineEmits(["pick"])
const max = computed(() => niceMax(Math.max(1, ...props.groups.flatMap((g) => g.v))))
// Подписей оси не больше 6 (до 7 столбиков — у каждого): длинный ряд на телефоне иначе слепляет подписи.
const step = computed(() => (props.groups.length <= 7 ? 1 : Math.ceil(props.groups.length / 6)))

// Подсказка над столбиком — по наведению или касанию.
const plot = ref(null)
const tip = ref(null)
function hover(ev) {
    const col = ev.target.closest?.(".cols__g")
    if (!col) return (tip.value = null)
    const r = plot.value.getBoundingClientRect()
    const cr = col.getBoundingClientRect()
    tip.value = { text: props.groups[col.dataset.i].tip, left: Math.min(Math.max(cr.left - r.left + cr.width / 2, 90), r.width - 90) }
}
</script>

<template>
    <figure class="cols" :class="cls" :style="{ '--h': h + 'px' }" :role="pickable ? 'group' : 'img'" :aria-label="label">
        <div ref="plot" class="cols__plot" @pointermove="hover" @pointerdown="hover" @pointerleave="tip = null">
            <div class="chart__grid">
                <span v-for="t in [0, 0.5, 1]" :key="t" :style="{ bottom: t * 100 + '%' }"
                    ><em>{{ axisNum(max * t) }}</em></span
                >
            </div>
            <div
                v-for="(g, i) in groups"
                :key="g.key"
                class="cols__g"
                :class="{ 'is-sel': pickable && sel === g.key }"
                :data-i="i"
                :tabindex="pickable ? 0 : null"
                :role="pickable ? 'button' : null"
                :aria-label="pickable ? g.tip : null"
                :aria-pressed="pickable ? sel === g.key : null"
                @click="pickable && emit('pick', g.key)"
                @keydown.enter.space.prevent="pickable && emit('pick', g.key)"
            >
                <template v-for="(v, j) in g.v" :key="j"><i v-if="!(sparse && !v)" class="cols__b" :class="'cols__b--' + series[j].tone" :style="{ height: (v / max) * 100 + '%' }"></i></template>
            </div>
            <div v-if="tip" class="chart__tip" :style="{ left: tip.left + 'px', top: '0px' }">{{ tip.text }}</div>
        </div>
        <div class="cols__x">
            <span v-for="(g, i) in groups" :key="g.key">{{ i % step === 0 ? g.l : "" }}</span>
        </div>
    </figure>
</template>
