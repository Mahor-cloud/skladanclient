<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

import AppMenuItem from "./AppMenuItem.vue"

function readUser() {
    try {
        return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
        return null
    }
}

const user = ref(readUser())

function onStorage(e) {
    if (!e || e.key === "user" || e.key === null) {
        user.value = readUser()
    }
}
onMounted(() => window.addEventListener("storage", onStorage))
onBeforeUnmount(() => window.removeEventListener("storage", onStorage))

function hasAny(perms) {
    if (!perms || perms.length === 0) return true
    if (!user.value) return false
    if (user.value.isSuperAdmin) return false
    const userPerms = user.value.role?.permissions || []
    return perms.some((p) => userPerms.includes(p))
}

const rawModel = ref([
    {
        label: "Супер-админ",
        items: [
            {
                label: "Компании",
                icon: "pi pi-fw pi-globe",
                to: "/companies",
                onlySuperAdmin: true
            },
            {
                label: "Семена",
                icon: "pi pi-fw pi-seedling",
                to: "/seeds",
                onlySuperAdmin: true
            },
            {
                label: "Метрики",
                icon: "pi pi-fw pi-chart-bar",
                to: "/observability",
                onlySuperAdmin: true
            }
        ]
    },
    {
        label: "Служебное",
        items: [
            {
                label: "Админка",
                icon: "pi pi-fw pi-users",
                to: "/admin",
                hideForSuperAdmin: true
            },
            {
                label: "Инвентаризация",
                icon: "pi pi-fw pi-search",
                to: "/storage/inventory",
                permissions: ["view_inventory"]
            },
            {
                label: "Закупка",
                icon: "pi pi-fw pi-tag",
                to: "/purchase",
                permissions: ["view_purchases"]
            }
        ]
    },
    {
        label: "Склад",
        items: [
            { label: "Главная", icon: "pi pi-fw pi-home", to: "/", hideForSuperAdmin: true },
            {
                label: "Заказы",
                icon: "pi pi-fw pi-tags",
                to: "/shop",
                permissions: ["view_orders"]
            },
            {
                label: "Личный склад",
                icon: "pi pi-fw pi-briefcase",
                to: "/cabinet",
                permissions: ["cabinet_access"]
            },
            {
                label: "Личные склады (сводка)",
                icon: "pi pi-fw pi-th-large",
                to: "/cabinet-summary",
                permissions: ["view_cabinet_summary", "view_all_cabinets"]
            }
        ]
    },
    {
        label: "Аналитика",
        items: [
            {
                label: "Статистика",
                icon: "pi pi-fw pi-chart-line",
                to: "/statistics",
                permissions: ["view_statistics"]
            },
            {
                label: "История",
                icon: "pi pi-fw pi-clock",
                to: "/history",
                permissions: ["view_change_history"]
            }
        ]
    }
])

const model = computed(() => {
    return rawModel.value
        .map((group) => {
            const items = (group.items || []).filter((it) => {
                if (it.onlySuperAdmin) return !!user.value?.isSuperAdmin
                if (it.hideForSuperAdmin && user.value?.isSuperAdmin) return false
                return hasAny(it.permissions)
            })
            return { ...group, items }
        })
        .filter((group) => group.items.length > 0)
})
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item.label">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
