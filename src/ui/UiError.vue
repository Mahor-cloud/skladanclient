<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import UiBtn from "./UiBtn.vue"
import UiEmpty from "./UiEmpty.vue"

// Ошибка загрузки с «Повторить»: <UiError @retry="refetch()" />
defineProps({
    title: { type: String, default: "Не удалось загрузить данные" },
    text: { type: String, default: "Нет связи с сервером. Проверьте интернет и попробуйте снова" }
})
defineEmits(["retry"])
</script>

<template>
    <UiEmpty art="error" :title="title" :text="text"><UiBtn label="Повторить" icon="repeat" @click="$emit('retry')" /></UiEmpty>
</template>
