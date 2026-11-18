<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { UiAvatar, UiBtn, UiChip, UiEmpty, UiError, UiIcon, UiIconBtn, UiLazy, UiPage, UiSk, UiSkRow } from "@/ui"
import { computed, ref, watchEffect } from "vue"
import { useRouter } from "vue-router"
import { roleId, useRoles, useUsers } from "./admin"
import AdminTabs from "./AdminTabs.vue"

const router = useRouter()
const { user, can } = useSession()
const { data: users, isPending, isError, refetch } = useUsers()
const { data: roles } = useRoles()
// Без права на пользователей вход в раздел ведёт в настройки; права могут смениться на лету.
watchEffect(() => !can("view_users") && router.replace({ name: "admin-settings" }))
// Создавать пользователей сервер даёт только с флагом «Служащий» (AdminGuard).
const canCreate = computed(() => !!user.value?.isAdmin && can("create_users"))

const q = ref("")
const role = ref("")
const all = computed(() => users.value || [])
// Роли для фильтра: полный список, а без права на роли — те, что назначены пользователям.
const roleList = computed(() => roles.value || [...new Map(all.value.filter((u) => u.role?._id).map((u) => [u.role._id, u.role])).values()])
const chips = computed(() => [
    { label: "Все", value: "", count: all.value.length },
    { label: "Служащие", value: "staff", count: all.value.filter((u) => u.isAdmin).length },
    ...roleList.value.filter((r) => !r.isSystem).map((r) => ({ label: r.name, value: r._id, count: all.value.filter((u) => roleId(u) === r._id).length }))
])
const list = computed(() => {
    const s = q.value.trim().toLowerCase()
    return all.value.filter((u) => !role.value || (role.value === "staff" ? u.isAdmin : roleId(u) === role.value)).filter((u) => !s || u.name?.toLowerCase().includes(s) || u.login?.toLowerCase().includes(s))
})
const reset = () => ((q.value = ""), (role.value = ""))
const COLS = "52px minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.3fr) 100px 40px"
</script>

<template>
    <UiPage title="Админка" :sub="user?.companyName || ''">
        <template #actions><UiIconBtn v-if="canCreate" icon="plus" label="Новый пользователь" kind="primary" :to="{ name: 'admin-user-new' }" /></template>
        <template #deskActions><UiBtn v-if="canCreate" label="Новый пользователь" icon="plus" :to="{ name: 'admin-user-new' }" /></template>
        <AdminTabs cur="users" />

        <div v-if="isError && !users" class="card card--pad"><UiError title="Не удалось загрузить «Пользователи»" @retry="refetch()" /></div>
        <template v-else-if="isPending">
            <div class="listtools">
                <div class="filterbar"><UiSk v-for="w in [90, 120, 110, 130]" :key="w" :w="w + 'px'" :h="40" :r="99" /></div>
                <UiSk :h="48" :r="14" />
            </div>
            <p class="loading-note" role="status"><span class="spin"></span>Загружаем…</p>
            <div class="card tbl tbl--sk" aria-busy="true"><UiSkRow v-for="i in 7" :key="i" /></div>
        </template>
        <template v-else>
            <div class="listtools">
                <div class="filterbar" role="group" aria-label="Роль"><UiChip v-for="c in chips" :key="c.value" :label="c.label" :count="c.count" :active="role === c.value" @click="role = c.value" /></div>
                <form class="msearch__f lsearch" role="search" @submit.prevent="$event.target.querySelector('input').blur()">
                    <UiIcon name="search" /><input v-model="q" type="search" name="q" placeholder="Имя или логин" aria-label="Имя или логин" autocomplete="off" />
                    <button v-if="q" type="button" class="msearch__x" aria-label="Очистить поиск" @click="q = ''"><UiIcon name="x" :size="18" /></button>
                </form>
            </div>
            <div v-if="list.length" class="card tbl" :style="{ '--cols': COLS }">
                <div class="tbl__h" aria-hidden="true"><span></span><span>Пользователь</span><span>Логин</span><span>Роль</span><span>Служащий</span><span></span></div>
                <UiLazy v-slot="{ item: u }" :items="list" :size="40" :reset-key="q + '~' + role">
                    <RouterLink class="trow" :to="{ name: 'admin-user', params: { id: u._id } }">
                        <span class="trow__cov"><UiAvatar :user="u" /></span>
                        <div class="trow__main">
                            <span class="trow__n"
                                >{{ u.name
                                }}<template v-if="u.role?.isSystem">
                                    <span class="tag tag--dark"><UiIcon name="lock" :size="14" />главный</span></template
                                ></span
                            >
                            <span class="trow__m"
                                ><span class="mono">@{{ u.login }}</span
                                ><span class="mob"> · {{ u.role ? (u.role.isSystem ? "Председатель" : u.role.name) : "без роли" }}</span></span
                            >
                        </div>
                        <span class="trow__c"
                            ><span class="mono">{{ u.login }}</span></span
                        >
                        <span class="trow__c"
                            ><span v-if="u.role" class="tag" :class="u.role.isSystem ? 'tag--dark' : 'tag--primary'">{{ u.role.isSystem ? u.role.name + " · председатель" : u.role.name }}</span
                            ><template v-else>—</template></span
                        >
                        <span class="trow__c"
                            ><span v-if="u.isAdmin" class="okmark"><UiIcon name="check" :size="16" />да</span><span v-else class="muted">—</span></span
                        >
                        <div class="trow__ctl"></div>
                        <span class="trow__side"
                            ><span class="mob"><span v-if="u.isAdmin" class="tag tag--teal">служащий</span></span
                            ><UiIcon name="right" class="trow__chev"
                        /></span>
                    </RouterLink>
                </UiLazy>
            </div>
            <div v-else class="card">
                <UiEmpty art="search" title="Никого не нашли"><UiBtn label="Сбросить" kind="secondary" @click="reset" /></UiEmpty>
            </div>
        </template>
    </UiPage>
    <!-- Формы «новый» и «правка» — один компонент: ключ пересоздаёт его при смене адреса, иначе форма осталась бы в прежнем режиме -->
    <RouterView v-slot="{ Component, route: r }"><component :is="Component" :key="r.path" /></RouterView>
</template>
