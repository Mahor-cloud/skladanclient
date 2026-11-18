<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { UiSk } from "@/ui"
</script>

<template>
    <div class="pcard pcard--sk" aria-hidden="true">
        <span class="sk sk--cover"></span>
        <div class="pcard__body"><UiSk w="46%" :h="20" /><UiSk w="92%" :h="13" /><UiSk w="70%" :h="13" /><UiSk w="40%" :h="11" /></div>
        <div class="pcard__buy"><UiSk :h="44" :r="12" /></div>
    </div>
</template>
