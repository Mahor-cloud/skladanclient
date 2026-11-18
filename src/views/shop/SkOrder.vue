<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { UiSk } from "@/ui"
// Скелетон карточки заказа: первая загрузка списка и сторож ленивой подгрузки.
</script>

<template>
    <div class="ocard ocard--sk" aria-hidden="true">
        <div class="ocard__top"><UiSk w="38%" :h="18" /><UiSk w="74px" :h="24" :r="99" /></div>
        <UiSk :h="6" :r="99" /><UiSk w="62%" :h="12" />
        <div class="ocard__foot"><UiSk w="120px" :h="32" :r="8" /><UiSk w="80px" :h="20" /></div>
    </div>
</template>
