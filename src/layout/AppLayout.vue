<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import GlobalProgressBar from "@/components/GlobalProgressBar.vue"
import { usePwaInstall } from "@/composables/usePwaInstall"
import { useRealtime } from "@/composables/useRealtime"
import { useLayout } from "@/layout/composables/layout"
import { computed, ref, watch } from "vue"
import AppFooter from "./AppFooter.vue"
import AppSidebar from "./AppSidebar.vue"
import AppTopbar from "./AppTopbar.vue"

const { layoutConfig, layoutState, isSidebarActive } = useLayout()

useRealtime()

const { canInstall, isInstalled, isIOS, promptInstall } = usePwaInstall()

const outsideClickListener = ref(null)

watch(isSidebarActive, (newVal) => {
    if (newVal) {
        bindOutsideClickListener()
    } else {
        unbindOutsideClickListener()
    }
})

const containerClass = computed(() => {
    return {
        "layout-overlay": layoutConfig.menuMode === "overlay",
        "layout-static": layoutConfig.menuMode === "static",
        "layout-static-inactive": layoutState.staticMenuDesktopInactive && layoutConfig.menuMode === "static",
        "layout-overlay-active": layoutState.overlayMenuActive,
        "layout-mobile-active": layoutState.staticMenuMobileActive
    }
})

function bindOutsideClickListener() {
    if (!outsideClickListener.value) {
        outsideClickListener.value = (event) => {
            if (isOutsideClicked(event)) {
                layoutState.overlayMenuActive = false
                layoutState.staticMenuMobileActive = false
                layoutState.menuHoverActive = false
            }
        }
        document.addEventListener("click", outsideClickListener.value)
    }
}

function unbindOutsideClickListener() {
    if (outsideClickListener.value) {
        document.removeEventListener("click", outsideClickListener)
        outsideClickListener.value = null
    }
}

function isOutsideClicked(event) {
    const sidebarEl = document.querySelector(".layout-sidebar")
    const topbarEl = document.querySelector(".layout-menu-button")

    return !(sidebarEl?.isSameNode(event.target) || sidebarEl?.contains(event.target) || topbarEl?.isSameNode(event.target) || topbarEl?.contains(event.target))
}
</script>

<template>
    <GlobalProgressBar />
    <div class="layout-wrapper" :class="containerClass">
        <app-topbar></app-topbar>
        <app-sidebar></app-sidebar>
        <div class="layout-main-container pl-2 pr-2">

            <div
                v-if="!isInstalled && (canInstall || isIOS)"
                class="pwa-install-bar"
            >
                <i class="pi pi-mobile" />
                <span v-if="canInstall" class="pwa-install-bar__text">Установите приложение на устройство — быстрее запуск и работа из кэша.</span>
                <span v-else class="pwa-install-bar__text">Установка на iPhone/iPad: меню «Поделиться» → «На экран „Домой“».</span>
                <Button
                    v-if="canInstall"
                    label="Установить"
                    icon="pi pi-download"
                    size="small"
                    @click="promptInstall"
                />
            </div>
            <main class="layout-main">
                <router-view></router-view>
            </main>
            <app-footer></app-footer>
        </div>
        <div class="layout-mask animate-fadein"></div>
    </div>
    <Toast />
</template>

<style scoped>
.pwa-install-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin: 8px 0;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(3, 105, 161, 0.08);
    border: 1px solid rgba(3, 105, 161, 0.25);
    font-size: 14px;
}
.pwa-install-bar__text {
    flex: 1 1 220px;
    min-width: 0;
}
</style>
