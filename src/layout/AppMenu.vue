<script setup>
import { ref } from "vue"

import AppMenuItem from "./AppMenuItem.vue"

const model = ref([
    {
        label: "Служебное",
        items: [
            {
                label: "Админка",
                icon: "pi pi-fw pi-users",
                to: "/admin"
            },
            {
                label: "Инвентаризация",
                icon: "pi pi-fw pi-search",
                to: "/storage/inventory"
            },
            {
                label: "Закупка",
                icon: "pi pi-fw pi-tag",
                to: "/purchase"
            }
        ]
    },
    {
        label: "Склад",
        items: [
            { label: "Главная", icon: "pi pi-fw pi-home", to: "/" },
            {
                label: "Заказы",
                icon: "pi pi-fw pi-tags",
                to: "/shop"
            },
            {
                label: "История",
                to: "/history"
            }
        ]
    }
])
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
