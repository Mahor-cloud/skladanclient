<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useCart } from "@/composables/useCart"
import { useSession } from "@/composables/useSession"
import { cartLines, cartTotal } from "@/domain/cart"
import { money, pcs, positions } from "@/domain/format"
import { useProducts } from "@/service/queries"
import { UiAside, UiBtn, UiIcon, UiLines } from "@/ui"
import { computed } from "vue"
import { useCartQty, useCheckout } from "./cart"

// Корзина в правой колонке (каталог, «Мой склад») — только у тех, кто может заказывать, и только на широком экране.
const { can } = useSession()
const { cart, count } = useCart()
const { data: products } = useProducts()
const { setQty, clamped } = useCartQty()
const { checkout, pending, lock, sent } = useCheckout()
// Пока отправка без ответа (sent), нехватку мог создать сам неподтверждённый заказ: строки не помечаются, чтобы корзину не уменьшали зря.
const lines = computed(() => cartLines(cart, products.value).map((x) => ({ ...x, bad: x.bad && !sent.value })))
const over = computed(() => lines.value.some((x) => x.bad))
</script>

<template>
    <UiAside v-if="can('create_orders')" name="cart" :sub="lines.length ? `${positions(lines.length)} · ${pcs(count)}` : ''">
        <template #title
            ><span class="pane__ci"><UiIcon name="cart" :size="22" /></span>Корзина</template
        >
        <div v-if="!lines.length" class="cartempty">
            <svg class="lineart" viewBox="0 0 220 150" aria-hidden="true">
                <g class="draw">
                    <path pathLength="1" d="M26 36h22l17 64h86l15-46H60" />
                    <path pathLength="1" d="M84 112a9 9 0 1 0 .1 0M142 112a9 9 0 1 0 .1 0" />
                    <path pathLength="1" class="thin" d="M92 66v22M112 66v22M132 66v22M12 140h196" />
                    <path pathLength="1" class="gold" d="M158 12l13 13-13 13-13-13zM152 25h12" />
                </g>
            </svg>
            <b>В корзине пусто</b>
        </div>
        <template v-else>
            <UiLines :items="lines" step :head="false" @qty="setQty" @clamped="clamped" />
            <div class="itotal">
                <span>Итого</span><b>{{ money(cartTotal(lines)) }}</b>
            </div>
            <span v-if="over" class="field__msg field__msg--err"><UiIcon name="alert" :size="16" />Товара меньше, чем в корзине</span>
        </template>
        <template v-if="lines.length" #footer>
            <p v-if="lock" class="foot-note"><UiIcon name="lock" :size="16" class="inl" /> Идёт инвентаризация — создание заказов невозможно</p>
            <UiBtn label="Открыть" kind="secondary" size="lg" to="/cart" />
            <UiBtn label="Оформить заказ" icon="check" size="lg" :disabled="over || lock" :loading="pending" @click="checkout" />
        </template>
    </UiAside>
</template>
