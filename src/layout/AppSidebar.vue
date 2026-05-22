<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import AppMenu from './AppMenu.vue';

function readUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
        return null
    }
}

const user = ref(readUser())

function onStorage(e) {
    if (!e || e.key === 'user' || e.key === null) {
        user.value = readUser()
    }
}
onMounted(() => window.addEventListener('storage', onStorage))
onBeforeUnmount(() => window.removeEventListener('storage', onStorage))
</script>

<template>
    <div class="layout-sidebar">
        <div v-if="user" class="sidebar-user">
            <span class="sidebar-user__avatar"><i class="pi pi-user"></i></span>
            <div class="sidebar-user__info">
                <span class="sidebar-user__name">{{ user.name || user.login }}</span>
                <span class="sidebar-user__role">{{ user.isSuperAdmin ? 'Супер-админ' : (user.role?.name || 'Пользователь') }}</span>
            </div>
        </div>
        <app-menu></app-menu>
    </div>
</template>

<style lang="scss" scoped>
.sidebar-user {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    margin-bottom: 8px;
    border-radius: 10px;
    background: var(--surface-100, rgba(0, 0, 0, 0.04));
}
.sidebar-user__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    border-radius: 50%;
    background: var(--primary-color, #3b82f6);
    color: #fff;
    font-size: 18px;
}
.sidebar-user__info {
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.sidebar-user__name {
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.sidebar-user__role {
    font-size: 12px;
    opacity: 0.7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
