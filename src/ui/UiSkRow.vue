<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import UiSk from "./UiSk.vue"
</script>

<template>
    <div class="lrow lrow--sk" aria-hidden="true">
        <UiSk w="48px" :h="48" :r="10" />
        <div class="lrow__main"><UiSk w="58%" /><UiSk w="34%" :h="12" /></div>
        <UiSk w="72px" :h="16" />
    </div>
</template>
