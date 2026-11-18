<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { backTo, UiBtn, UiIcon, UiSheet } from "@/ui"
import { computed, watch } from "vue"
import { ALL, PERMS, rolePerms, useRoles } from "./admin"

// «Что может роль» — права списком по группам.
const props = defineProps({ id: { type: String, required: true } })
const { data: roles } = useRoles()
const r = computed(() => (roles.value || []).find((x) => x._id === props.id))
const toList = () => backTo({ name: "admin-roles" })
watch(
    () => roles.value && !r.value,
    (gone) => gone && toList(),
    { immediate: true }
)
const sections = computed(() => {
    const sel = new Set(rolePerms(r.value))
    return PERMS.map(([title, icon, list]) => ({ title, icon, on: list.filter((p) => sel.has(p[0])) })).filter((g) => g.on.length)
})
</script>

<template>
    <UiSheet v-if="r" :title="`Роль «${r.name}»`" :sub="`${rolePerms(r).length} из ${ALL.length} прав`" size="md" @close="toList">
        <p class="muted" style="margin-bottom: var(--sp-5)">Пользователь с этой ролью может:</p>
        <section v-for="g in sections" :key="g.title" class="cando">
            <h4><UiIcon :name="g.icon" :size="18" />{{ g.title }}</h4>
            <ul>
                <li v-for="p in g.on" :key="p[0]"><UiIcon name="check" :size="16" />{{ p[3] }}</li>
            </ul>
        </section>
        <p v-if="!sections.length">Нет назначенных прав.</p>
        <template #footer="{ close }"><UiBtn label="Понятно" kind="secondary" size="lg" @click="close()" /></template>
    </UiSheet>
</template>
