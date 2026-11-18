<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import UiIconBtn from "./UiIconBtn.vue"

// Шапка страницы: узкая шапка телефона + заголовок на компьютере + тело (слот). mtitle — короткий заголовок для телефона,
// back — куда ведёт «Назад». Слоты: actions (кнопки шапки), deskActions (другой набор для компьютера), crumbs.
defineProps({
    title: { type: String, required: true },
    mtitle: { type: String, default: "" },
    sub: { type: String, default: "" },
    back: { type: [String, Object], default: null },
    cls: { type: String, default: "" }
})
</script>

<template>
    <div class="mtop">
        <UiIconBtn v-if="back" icon="left" label="Назад" :to="back" class="mtop__back" />
        <div class="mtop__t">
            <h1>{{ mtitle || title }}</h1>
            <small v-if="sub">{{ sub }}</small>
        </div>
        <div class="mtop__a"><slot name="actions" /></div>
    </div>
    <div class="page" :class="cls">
        <div class="page-head">
            <nav v-if="$slots.crumbs" class="crumbs" aria-label="Путь"><slot name="crumbs" /></nav>
            <div class="page-head__row">
                <div>
                    <h1>{{ title }}</h1>
                    <p v-if="sub">{{ sub }}</p>
                </div>
                <div class="page-head__a">
                    <slot name="deskActions"><slot name="actions" /></slot>
                </div>
            </div>
        </div>
        <slot />
    </div>
</template>
