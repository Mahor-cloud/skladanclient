<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { money } from "@/domain/format"
import { copyText } from "./overlay"
import UiIcon from "./UiIcon.vue"

// «Как оплатить»: сумма с копированием, реквизиты местности (карта, телефон, получатель) и текст казначея.
// pay — настройки местности (/database/msg): paymentCard, paymentPhone, paymentHolder, paymentMessage.
const props = defineProps({
    amount: { type: Number, required: true },
    title: { type: String, default: "Как оплатить" },
    pay: { type: Object, default: () => ({}) }
})
const rows = () =>
    [
        ["card", props.pay.paymentCard, String(props.pay.paymentCard || "").replace(/\s/g, ""), "Номер карты"],
        ["phone", props.pay.paymentPhone, String(props.pay.paymentPhone || "").replace(/[^\d+]/g, ""), "Номер телефона"],
        ["user", props.pay.paymentHolder, props.pay.paymentHolder, "Получатель"]
    ].filter((r) => r[1])
</script>

<template>
    <section class="card blk o-pay" aria-label="Реквизиты для оплаты">
        <h3>{{ title }}</h3>
        <div class="pay__amount">
            <span>К переводу</span><b>{{ money(amount) }}</b>
            <button type="button" class="ibtn pay__copy" aria-label="Скопировать сумму" @click="copyText(amount, 'Сумма')"><UiIcon name="copy" /></button>
        </div>
        <div v-for="[icon, value, copy, label] in rows()" :key="label" class="copyrow copyrow--bare">
            <span class="copyrow__i"><UiIcon :name="icon" /></span><b class="copyrow__v mono">{{ value }}</b>
            <button type="button" class="btn btn--secondary btn--sm copyrow__b" :aria-label="'Скопировать: ' + label.toLowerCase()" @click="copyText(copy, label)"><UiIcon name="copy" :size="18" /><span>Скопировать</span></button>
        </div>
        <p v-if="pay.paymentMessage" class="pay__note">{{ pay.paymentMessage }}</p>
        <p v-else-if="!rows().length" class="pay__note">Реквизиты не указаны</p>
    </section>
</template>
