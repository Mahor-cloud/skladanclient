<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { toast, UiBtn, UiIcon, UiSheet } from "@/ui"
import { ref } from "vue"

// Кадрирование фото товара — как при установке аватарки: рамка в пропорциях обложки (6:7), фото двигается и масштабируется
// (ползунок, колесо, щипок). Его можно уменьшить так, чтобы вошло целиком, — тогда поля прозрачные.
// Результат — WebP 360×420 с прозрачностью: событие done(blob).
defineProps({
    src: { type: String, required: true },
    tint: { type: String, default: "var(--primary)" }
})
const emit = defineEmits(["done", "close"])

const sheet = ref(null)
const frame = ref(null)
const img = ref(null)
const zoom = ref(50)
const st = { s: 1, x: 0, y: 0, iw: 0, ih: 0, W: 0, H: 0, min: 0.1, max: 8, contain: 1, cover: 1 }
const toV = (s) => Math.round((Math.log(s / st.min) / Math.log(st.max / st.min)) * 100)
const toS = (v) => st.min * Math.pow(st.max / st.min, v / 100)

function paint() {
    st.s = Math.min(st.max, Math.max(st.min, st.s))
    // Фото не уезжает за рамку целиком.
    const mx = Math.abs(st.iw * st.s - st.W) / 2
    const my = Math.abs(st.ih * st.s - st.H) / 2
    st.x = Math.min(mx, Math.max(-mx, st.x))
    st.y = Math.min(my, Math.max(-my, st.y))
    img.value.style.transform = `translate(-50%, -50%) translate(${st.x}px, ${st.y}px) scale(${st.s})`
    zoom.value = toV(st.s)
}
function init() {
    st.iw = img.value.naturalWidth || 400
    st.ih = img.value.naturalHeight || 300
    // Размеры по раскладке, а не по экрану: окно в этот момент ещё выезжает с масштабом.
    st.W = frame.value.clientWidth
    st.H = frame.value.clientHeight
    img.value.style.width = st.iw + "px"
    img.value.style.height = st.ih + "px"
    st.contain = Math.min(st.W / st.iw, st.H / st.ih)
    st.cover = Math.max(st.W / st.iw, st.H / st.ih)
    st.min = st.contain * 0.5
    st.max = st.cover * 4
    fit(st.cover)
}
function fit(scale) {
    st.s = scale
    st.x = st.y = 0
    paint()
}
function onZoom(ev) {
    st.s = toS(+ev.target.value)
    paint()
}
function onWheel(ev) {
    st.s *= Math.exp(-ev.deltaY * 0.0016)
    paint()
}
const pts = new Map()
let pinch = 0
function down(ev) {
    frame.value.setPointerCapture(ev.pointerId)
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    pinch = 0
}
function move(ev) {
    const p0 = pts.get(ev.pointerId)
    if (!p0) return
    if (pts.size === 1) {
        st.x += ev.clientX - p0.x
        st.y += ev.clientY - p0.y
    }
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch) st.s *= d / pinch
        pinch = d
    }
    paint()
}
function up(ev) {
    pts.delete(ev.pointerId)
    pinch = 0
}
function done() {
    const W = 360
    const H = 420
    const k = W / st.W
    const cv = document.createElement("canvas")
    cv.width = W
    cv.height = H
    const g = cv.getContext("2d")
    g.translate(W / 2 + st.x * k, H / 2 + st.y * k)
    g.scale(st.s * k, st.s * k)
    g.imageSmoothingQuality = "high"
    g.drawImage(img.value, -st.iw / 2, -st.ih / 2, st.iw, st.ih)
    cv.toBlob(
        (blob) => {
            if (!blob) return toast({ type: "error", title: "Не получилось обработать фото" })
            emit("done", blob)
            sheet.value.close("ok")
        },
        "image/webp",
        0.9
    )
}
</script>

<template>
    <UiSheet ref="sheet" title="Фото товара" size="md" cls="ov--crop" @close="$emit('close')">
        <div class="crop">
            <div ref="frame" class="crop__frame" :style="{ '--cat': tint }" @wheel.prevent="onWheel" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
                <img ref="img" :src="src" alt="" draggable="false" @load="init" />
            </div>
            <label class="crop__zoom"><UiIcon name="minus" :size="18" /><input type="range" min="0" max="100" step="1" :value="zoom" aria-label="Масштаб фото" @input="onZoom" /><UiIcon name="plus" :size="18" /></label>
            <div class="crop__btns">
                <UiBtn label="Вписать целиком" kind="secondary" @click="fit(st.contain)" />
                <UiBtn label="Заполнить рамку" kind="secondary" @click="fit(st.cover)" />
            </div>
        </div>
        <template #footer="{ close }">
            <UiBtn label="Отмена" kind="secondary" size="lg" @click="close()" />
            <UiBtn label="Готово" icon="check" size="lg" @click="done" />
        </template>
    </UiSheet>
</template>
