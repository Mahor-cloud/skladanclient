<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { isWide } from "@/composables/useBreakpoint"
import { useKindCovers } from "@/service/queries"
import { KIND_COVERS } from "@/ui/keys"
import { pane } from "@/ui/pane"
import UiHost from "@/ui/UiHost.vue"
import { computed, provide, watchEffect } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()
const { data: kindCovers } = useKindCovers()
provide(
    KIND_COVERS,
    computed(() => kindCovers.value || {})
)

// Классы каркаса стоят на самом <div id="app"> (на них опираются стили прототипа), а он — вне шаблона: Vue монтируется в него.
const root = document.getElementById("app")
watchEffect(() => {
    const detail = isWide.value && pane.details > 0
    const name = detail ? "detail" : isWide.value && pane.asideShown ? pane.aside : ""
    root.className = ["app", route.meta.bare && "app--bare", name && "has-pane", detail && pane.aside === "cart" && "cart-away"].filter(Boolean).join(" ")
    if (name) root.dataset.pane = name
    else delete root.dataset.pane
})
</script>

<template>
    <main v-if="route.meta.bare" id="view" class="view view--bare"><RouterView /></main>
    <RouterView v-else />
    <UiHost />
</template>
