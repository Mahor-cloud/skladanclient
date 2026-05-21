<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useIsFetching, useIsMutating } from "@tanstack/vue-query"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()
const fetchingCount = useIsFetching({
    predicate: (query) => !(query?.meta && query.meta.silent)
})
const mutatingCount = useIsMutating({
    predicate: (mutation) => !(mutation?.meta && mutation.meta.silent)
})

const routeTransitioning = ref(false)
const progress = ref(0)
const visible = ref(false)

let progressTimer = null
let hideTimer = null
let pointerSafetyTimer = null

const isActive = computed(() => routeTransitioning.value || fetchingCount.value > 0 || mutatingCount.value > 0)

function startProgress() {
    if (hideTimer) {
        clearTimeout(hideTimer)
        hideTimer = null
    }
    visible.value = true
    progress.value = Math.max(progress.value, 8)

    if (progressTimer) clearInterval(progressTimer)
    progressTimer = setInterval(() => {
        if (progress.value < 80) {

            const delta = (80 - progress.value) * 0.08
            progress.value = Math.min(80, progress.value + Math.max(0.5, delta))
        }
    }, 200)
}

function finishProgress() {
    if (progressTimer) {
        clearInterval(progressTimer)
        progressTimer = null
    }
    progress.value = 100
    hideTimer = setTimeout(() => {
        visible.value = false
        progress.value = 0
    }, 220)
}

watch(isActive, (active) => {
    if (active) startProgress()
    else finishProgress()
})

const MIN_VISIBLE_MS = 200
let navStart = 0
const removeBefore = router.beforeEach((to, from, next) => {
    if (to.fullPath !== from.fullPath) {
        navStart = Date.now()
        routeTransitioning.value = true
        startProgress()
    }
    next()
})
const removeAfter = router.afterEach(() => {
    const elapsed = Date.now() - navStart
    setTimeout(
        () => {
            routeTransitioning.value = false
            if (pointerSafetyTimer) {
                clearTimeout(pointerSafetyTimer)
                pointerSafetyTimer = null
            }
        },
        Math.max(120, MIN_VISIBLE_MS - elapsed)
    )
})

function isNavIntent(target) {
    if (!target || !target.closest) return false

    return !!target.closest(
        'a[href]:not([href^="#0"]):not([href^="#!"]),' +
            ' .p-menuitem-link,' +
            ' .layout-topbar-logo,' +
            ' [data-nav-start]'
    )
}
function onAnyNavPointerDown(e) {

    if (e.button !== undefined && e.button !== 0) return
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
    if (!isNavIntent(e.target)) return

    navStart = Date.now()
    routeTransitioning.value = true
    startProgress()
    if (pointerSafetyTimer) clearTimeout(pointerSafetyTimer)
    pointerSafetyTimer = setTimeout(() => {

        routeTransitioning.value = false
        pointerSafetyTimer = null
    }, 1500)
}
onMounted(() => {
    document.addEventListener("pointerdown", onAnyNavPointerDown, { capture: true, passive: true })
})

onBeforeUnmount(() => {
    if (progressTimer) clearInterval(progressTimer)
    if (hideTimer) clearTimeout(hideTimer)
    if (pointerSafetyTimer) clearTimeout(pointerSafetyTimer)
    document.removeEventListener("pointerdown", onAnyNavPointerDown, { capture: true })
    removeBefore?.()
    removeAfter?.()
})
</script>

<template>
    <div class="global-progress-bar" :class="{ 'is-visible': visible }">
        <div class="global-progress-bar__track" :style="{ width: progress + '%' }"></div>
    </div>
</template>

<style scoped>
.global-progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: transparent;
    z-index: 9999;
    pointer-events: none;
    opacity: 0;

    transition: opacity 180ms ease-out;
}
.global-progress-bar.is-visible {
    opacity: 1;

    transition: opacity 0ms;
}
.global-progress-bar__track {
    height: 100%;
    background: linear-gradient(90deg, #0ea5e9 0%, #38bdf8 50%, #0ea5e9 100%);
    box-shadow: 0 0 6px rgba(14, 165, 233, 0.55);
    transition: width 220ms ease-out;
    border-bottom-right-radius: 3px;
}
</style>
