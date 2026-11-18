<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { isDesk } from "@/composables/useBreakpoint"
import { layerClose, layerOpen } from "./overlay"
import UiIconBtn from "./UiIconBtn.vue"

// Окно: на телефоне — лист снизу (закрывается свайпом вниз), на компьютере — окно по центру средней колонки.
// Родитель показывает его через v-if и убирает по событию close(reason): x | esc | swipe | scrim | свой повод из close().
// beforeClose — асинхронная проверка «закрыть без сохранения?» (вернуть false — не закрывать).
// Слоты: default (тело), footer — оба получают { close } для закрытия с анимацией; title; actions (кнопки в шапке перед крестиком).
const props = defineProps({
    title: { type: String, default: null },
    sub: { type: String, default: "" },
    label: { type: String, default: "Окно" },
    size: { type: String, default: "md" },
    cls: { type: String, default: "" },
    beforeClose: { type: Function, default: null }
})
const emit = defineEmits(["close"])

const kind = computed(() => (isDesk.value ? "dialog" : "sheet"))
const open = ref(false)
const root = ref(null)
const panel = ref(null)
const body = ref(null)
const scrim = ref(null)
const uid = "ov" + ++seq
const closing = ref(false)
let prevFocus = null

async function close(reason = "x") {
    if (closing.value) return
    if (props.beforeClose && (await props.beforeClose(reason)) === false) return
    closing.value = true
    open.value = false
    setTimeout(() => emit("close", reason), 360)
}
const layer = { close, root }
// closing — окно уже закрывается: его кнопки не должны повторять действие за время анимации.
defineExpose({ close, el: root, closing })

onMounted(() => {
    prevFocus = document.activeElement
    layerOpen(layer)
    requestAnimationFrame(() => requestAnimationFrame(() => (open.value = true)))
    // Фокус внутрь окна: на компьютере — первое поле, на телефоне — сама панель (без клавиатуры).
    setTimeout(() => {
        const el = root.value
        if (!el) return
        const f = el.querySelector("[autofocus]") || (isDesk.value ? el.querySelector(".ov__body input:not([readonly]):not([type=file]):not([type=checkbox]), .ov__body textarea") : null) || panel.value
        f?.focus({ preventScroll: true })
    }, 60)
})
onBeforeUnmount(() => {
    layerClose(layer)
    try {
        prevFocus?.focus?.({ preventScroll: true })
    } catch {
        // элемент, с которого открывали окно, мог исчезнуть
    }
})

/* Свайп: лист тянется вниз за шапку, а за тело — когда оно прокручено до верха; у нижнего края тело тянется «резинкой». */
const rubber = (d) => Math.min(96, Math.max(0, d) * 0.34)
let y0 = null
let dy = 0
let t0 = 0
let mode = null
let atTop = false
let atEnd = false
function touchStart(e) {
    y0 = null
    if (kind.value !== "sheet" || e.touches.length !== 1 || closing.value) return
    const inBody = body.value.contains(e.target)
    if (!inBody && e.target.closest(".ov__foot")) return
    y0 = e.touches[0].clientY
    dy = 0
    t0 = Date.now()
    mode = null
    atTop = !inBody || body.value.scrollTop <= 0
    atEnd = inBody && body.value.scrollTop + body.value.clientHeight >= body.value.scrollHeight - 1
}
function touchMove(e) {
    if (y0 == null) return
    dy = e.touches[0].clientY - y0
    if (!mode) {
        if (Math.abs(dy) < 6) return
        mode = dy > 0 && atTop ? "close" : dy < 0 && atEnd ? "rub" : null
        if (!mode) return (y0 = null)
        ;(mode === "close" ? panel : body).value.style.transition = "none"
    }
    if (mode === "close") {
        panel.value.style.transform = `translateY(${Math.max(0, dy)}px)`
        scrim.value.style.opacity = String(Math.max(0.15, 1 - Math.max(0, dy) / 520))
    } else body.value.style.transform = `translateY(${-rubber(-dy)}px)`
    if (e.cancelable) e.preventDefault()
}
function touchEnd() {
    if (y0 == null || !mode) return (y0 = null)
    const fast = dy / Math.max(1, Date.now() - t0) > 0.55
    if (mode === "close") {
        panel.value.style.transition = ""
        scrim.value.style.opacity = ""
        panel.value.style.transform = ""
        if (dy > 120 || (dy > 36 && fast)) close("swipe")
    } else {
        const b = body.value
        b.style.transition = "transform 420ms cubic-bezier(.2, .9, .3, 1.25)"
        b.style.transform = ""
        setTimeout(() => (b.style.transition = ""), 440)
    }
    y0 = null
    mode = null
}
</script>

<script>
let seq = 0
</script>

<template>
    <Teleport to="#layer">
        <div ref="root" class="ov" :class="['ov--' + kind, 'ov--' + size, cls, { 'is-open': open }]">
            <div ref="scrim" class="ov__scrim" @click="close('scrim')"></div>
            <section
                ref="panel"
                class="ov__panel"
                role="dialog"
                :inert="closing || null"
                aria-modal="true"
                :aria-labelledby="uid + '-t'"
                tabindex="-1"
                @touchstart.passive="touchStart"
                @touchmove="touchMove"
                @touchend="touchEnd"
                @touchcancel="touchEnd"
            >
                <span v-if="kind === 'sheet'" class="ov__grab" aria-hidden="true"></span>
                <header v-if="title != null || $slots.title" class="ov__head">
                    <div class="ov__ht">
                        <h2 :id="uid + '-t'">
                            <slot name="title">{{ title }}</slot>
                        </h2>
                        <p v-if="sub">{{ sub }}</p>
                    </div>
                    <slot name="actions" />
                    <UiIconBtn icon="x" label="Закрыть" class="ov__x" @click="close('x')" />
                </header>
                <h2 v-else :id="uid + '-t'" class="sr">{{ label }}</h2>
                <div ref="body" class="ov__body"><slot :close="close" /></div>
                <footer v-if="$slots.footer" class="ov__foot"><slot name="footer" :close="close" /></footer>
            </section>
        </div>
    </Teleport>
</template>
