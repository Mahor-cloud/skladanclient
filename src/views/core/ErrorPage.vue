<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { dateTime } from "@/domain/format"
import { authService } from "@/service/auth/auth.service"
import { UiBtn, UiIcon, UiLogo, UiWordmark } from "@/ui"
import { computed } from "vue"

// Служебные страницы вне каркаса: 403 (нет права), 404, 500 и «Сессия завершена».
const props = defineProps({ code: { type: String, default: "500" } })
const ERR = {
    403: { code: "403", title: "Сюда нельзя", text: "У вашей роли нет доступа к этому разделу", act: "На главную", icon: "lock" },
    404: { code: "404", title: "Такой страницы нет", text: "", act: "В каталог", icon: "search" },
    500: { code: "500", title: "Что-то сломалось", text: "Сервер не ответил, попробуйте ещё раз", act: "Повторить", icon: "repeat" },
    session: { code: "", title: "Сессия завершена", text: "Похоже, вы зашли с другого устройства. Если это сделали не вы — обратитесь к администратору для смены пароля.", act: "Войти", icon: "logout" }
}
const { user, can } = useSession()
const e = computed(() => ERR[props.code] || ERR[500])
const home = computed(() => (user.value ? authService.landingRoute() : "/auth/login"))
const now = dateTime(Date.now())
</script>

<template>
    <div class="errpage">
        <RouterLink class="errpage__brand" :to="home"><UiLogo class="logo__m" /><UiWordmark /></RouterLink>
        <div class="errpage__art">
            <template v-if="e.code">
                <template v-for="(d, i) in e.code" :key="i">
                    <span v-if="d === '0'" class="errd errd--tag" :style="{ '--i': i }">
                        <svg viewBox="0 0 60 120" aria-hidden="true">
                            <circle cx="30" cy="16" r="12" fill="none" stroke="#B7BCC7" stroke-width="4" />
                            <rect x="6" y="26" width="48" height="90" rx="22" fill="var(--accent)" />
                            <circle cx="30" cy="40" r="6" fill="var(--bg)" />
                            <rect x="13" y="50" width="5" height="54" rx="2.5" fill="#fff" opacity=".25" />
                        </svg>
                    </span>
                    <span v-else class="errd" :style="{ '--i': i }">{{ d }}</span>
                </template>
            </template>
            <span v-else class="errd errd--icon"><UiIcon name="logout" :size="72" /></span>
        </div>
        <h1>{{ e.title }}</h1>
        <p>{{ e.text }}</p>
        <div class="errpage__acts">
            <UiBtn :label="e.act" :icon="e.icon" size="lg" :to="code === 'session' ? '/auth/login' : home" />
            <UiBtn v-if="code !== 'session' && can('view_orders')" label="Мои заказы" kind="secondary" size="lg" to="/shop" />
        </div>
        <p class="errpage__code">{{ e.code ? `Код ошибки ${e.code} · ` : "" }}{{ now }}</p>
    </div>
</template>
