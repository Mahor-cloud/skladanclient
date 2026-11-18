<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { useInventoryLock } from "@/service/queries"
import UiIcon from "./UiIcon.vue"

// Спокойная полоса в одну строку на каждом экране каркаса, пока идёт инвентаризация (ставит её AppShell).
const { can } = useSession()
const { open, lock } = useInventoryLock()
</script>

<template>
    <div v-if="open" class="invbar" :class="{ 'invbar--lock': lock }" role="status">
        <UiIcon name="clipboard" :size="18" />
        <span class="invbar__l">{{ lock ? "Идёт инвентаризация — новые заказы и закупки оформить нельзя" : "Идёт инвентаризация — заказы оформляются, выдача после её завершения" }}</span>
        <span class="invbar__s">{{ lock ? "Идёт инвентаризация · заказы пока не оформить" : "Идёт инвентаризация · выдача после неё" }}</span>
        <RouterLink v-if="can('view_inventory')" to="/storage/inventory">Открыть</RouterLink>
    </div>
</template>
