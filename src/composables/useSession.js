/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { computed, ref } from "vue"

function readUser() {
    try {
        return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
        return null
    }
}

// Пользователь лежит в localStorage.user; вход, обновление токена и смена прав на лету (useRealtime) шлют событие storage.
const user = ref(readUser())
export const syncSession = () => (user.value = readUser())
window.addEventListener("storage", (e) => {
    if (!e || e.key === "user" || e.key === null) syncSession()
})

const isSuper = computed(() => !!user.value?.isSuperAdmin)
const isSys = computed(() => !isSuper.value && user.value?.role?.isSystem === true)
/** Право роли. У супер-админа прав местности нет. */
const can = (perm) => !isSuper.value && !!user.value?.role?.permissions?.includes(perm)
/** «Служащий» — флаг пользователя (или системная роль): нужен вместе с правом для товаров, чужих заказов, оплат, настроек. */
const isStaff = computed(() => !isSuper.value && (isSys.value || !!user.value?.isAdmin))
const roleTitle = computed(() => (isSuper.value ? "Супер-админ" : user.value?.role?.name || "Пользователь"))

/** Сессия простыми значениями — для функций src/domain (orderPerms, orderTurn, visibleNav, homePath…). */
const plain = computed(() => ({ user: user.value, can, isSuper: isSuper.value, isSys: isSys.value, isStaff: isStaff.value }))

const session = { user, can, isSuper, isSys, isStaff, roleTitle, plain }

/** { user, can(право), isSuper, isSys, isStaff, roleTitle, plain } — одни и те же реактивные значения для всего приложения. */
export function useSession() {
    return session
}
