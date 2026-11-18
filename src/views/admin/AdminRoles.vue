<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { homePath } from "@/domain/nav"
import { plural } from "@/domain/format"
import { UiAvatar, UiBtn, UiEmpty, UiError, UiIcon, UiIconBtn, UiPage, UiSk, UiSkRow } from "@/ui"
import { computed } from "vue"
import { ALL, roleBrief, roleId, rolePerms, useRoles, useUsers } from "./admin"
import AdminTabs from "./AdminTabs.vue"

const { user, can, plain } = useSession()
const { data: roles, isPending, isError, refetch } = useRoles()
const { data: users } = useUsers()
const usersOf = (r) => (users.value || []).filter((u) => roleId(u) === r._id)
// Менять роли сервер даёт только с флагом «Служащий» (AdminGuard), системной роли председателя мало.
const canEdit = (r) => !r.isSystem && !!user.value?.isAdmin && can("edit_roles")
const canCreate = computed(() => !!user.value?.isAdmin && can("create_role"))
</script>

<template>
    <UiPage v-if="!can('view_roles')" title="Роли и права">
        <div class="card">
            <UiEmpty art="error" title="Нет доступа"><UiBtn label="На главную" icon="home" :to="homePath(plain)" /></UiEmpty>
        </div>
    </UiPage>
    <UiPage v-else title="Админка" :sub="user?.companyName || ''">
        <template #actions><UiIconBtn v-if="canCreate" icon="plus" label="Новая роль" kind="primary" :to="{ name: 'admin-role-new' }" /></template>
        <template #deskActions><UiBtn v-if="canCreate" label="Новая роль" icon="plus" :to="{ name: 'admin-role-new' }" /></template>
        <AdminTabs cur="roles" />

        <div v-if="isError && !roles" class="card card--pad"><UiError title="Не удалось загрузить «Роли и права»" @retry="refetch()" /></div>
        <template v-else-if="isPending">
            <div class="listtools">
                <div class="filterbar"><UiSk v-for="w in [90, 120, 110, 130]" :key="w" :w="w + 'px'" :h="40" :r="99" /></div>
                <UiSk :h="48" :r="14" />
            </div>
            <p class="loading-note" role="status"><span class="spin"></span>Загружаем…</p>
            <div class="card tbl tbl--sk" aria-busy="true"><UiSkRow v-for="i in 7" :key="i" /></div>
        </template>
        <div v-else class="rcards">
            <article v-for="r in roles" :key="r._id" class="card rcard" :class="{ 'rcard--sys': r.isSystem }">
                <div class="rcard__top">
                    <span class="rcard__i"><UiIcon :name="r.isSystem ? 'shield' : 'users'" :size="22" /></span>
                    <div>
                        <h3>{{ r.name }}</h3>
                        <small v-if="r.isSystem">системная · председатель местности</small>
                        <small v-else-if="users">{{ usersOf(r).length }} {{ plural(usersOf(r).length, ["человек", "человека", "человек"]) }}</small>
                    </div>
                    <span v-if="r.isSystem" class="tag tag--dark"><UiIcon name="lock" :size="14" />все права</span>
                </div>
                <div class="rcard__meter">
                    <span class="bar"><i :style="{ width: (rolePerms(r).length / ALL.length) * 100 + '%' }"></i></span><b>{{ rolePerms(r).length }} из {{ ALL.length }} прав</b>
                </div>
                <div class="rcard__tags">
                    <span v-for="t in roleBrief(r)" :key="t" class="tag tag--neutral">{{ t }}</span>
                </div>
                <div v-if="users" class="rcard__users">
                    <UiAvatar v-for="u in usersOf(r).slice(0, 6)" :key="u._id" :user="u" size="sm" /><span v-if="usersOf(r).length > 6" class="cstack__more">+{{ usersOf(r).length - 6 }}</span
                    ><span v-if="!usersOf(r).length" class="muted">никому не назначена</span>
                </div>
                <div class="rcard__acts">
                    <UiBtn label="Что может" icon="info" kind="ghost" :to="{ name: 'admin-role-info', params: { id: r._id } }" />
                    <UiBtn :label="canEdit(r) ? 'Изменить права' : 'Открыть'" :icon="canEdit(r) ? 'edit' : 'eye'" kind="secondary" :to="{ name: 'admin-role', params: { id: r._id } }" />
                </div>
            </article>
            <RouterLink v-if="canCreate" class="card rcard rcard--add" :to="{ name: 'admin-role-new' }"><UiIcon name="plus" :size="28" /><b>Новая роль</b></RouterLink>
        </div>
    </UiPage>
    <!-- Формы «новый» и «правка» — один компонент: ключ пересоздаёт его при смене адреса, иначе форма осталась бы в прежнем режиме -->
    <RouterView v-slot="{ Component, route: r }"><component :is="Component" :key="r.path" /></RouterView>
</template>
