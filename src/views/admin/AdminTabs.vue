<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { UiIcon } from "@/ui"
import { onMounted, ref } from "vue"
import { useRoles, useUsers } from "./admin"

defineProps({ cur: { type: String, required: true } })
const { can } = useSession()
const { data: users } = useUsers()
const { data: roles } = useRoles()
// На телефоне полоса вкладок прокручивается: выбранная — по центру, как в прототипе.
const nav = ref(null)
onMounted(() => {
    const tab = nav.value.querySelector(".is-on")
    if (tab) nav.value.scrollLeft = tab.offsetLeft - (nav.value.clientWidth - tab.offsetWidth) / 2
})
</script>

<template>
    <nav ref="nav" class="ptabs" aria-label="Разделы страницы">
        <RouterLink v-if="can('view_users')" class="ptab" :class="{ 'is-on': cur === 'users' }" :aria-current="cur === 'users' ? 'page' : null" :to="{ name: 'admin' }"
            ><UiIcon name="users" :size="18" /><span>Пользователи</span><b v-if="users">{{ users.length }}</b></RouterLink
        >
        <RouterLink v-if="can('view_roles')" class="ptab" :class="{ 'is-on': cur === 'roles' }" :aria-current="cur === 'roles' ? 'page' : null" :to="{ name: 'admin-roles' }"
            ><UiIcon name="shield" :size="18" /><span>Роли и права</span><b v-if="roles">{{ roles.length }}</b></RouterLink
        >
        <RouterLink class="ptab" :class="{ 'is-on': cur === 'settings' }" :aria-current="cur === 'settings' ? 'page' : null" :to="{ name: 'admin-settings' }"><UiIcon name="sliders" :size="18" /><span>Настройки</span></RouterLink>
    </nav>
</template>
