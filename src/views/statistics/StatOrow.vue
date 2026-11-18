<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { dateTime, money } from "@/domain/format"
import { orderStatus } from "@/domain/orders"
import { peek, UiAvatar, UiIcon, UiStatus } from "@/ui"

// Строка заказа статистики: заказ открывается справа (peek) только для просмотра — адрес и фильтры страницы остаются.
defineProps({ o: { type: Object, required: true } })
</script>

<template>
    <button type="button" class="sorow" @click="peek({ name: 'order', params: { id: o._id } }, { readonly: true })">
        <span class="sorow__n">№{{ o.orderNumber }}</span>
        <span class="sorow__u"
            ><UiAvatar :user="o.user" size="sm" /><b>{{ o.user?.name || o.user?.login || "—" }}</b></span
        >
        <span class="sorow__d">{{ dateTime(o.orderDate) }}</span>
        <span class="sorow__s">{{ o.totalAmount == null ? "—" : money(o.totalAmount) }}</span>
        <span class="sorow__st"><UiStatus :st="orderStatus(o)" size="sm" /></span>
        <UiIcon name="right" :size="18" class="sorow__chev" />
    </button>
</template>
