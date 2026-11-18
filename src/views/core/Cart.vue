<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useCart } from "@/composables/useCart"
import { useSession } from "@/composables/useSession"
import { cartLines, cartTotal } from "@/domain/cart"
import { money, pcs, plural, positions } from "@/domain/format"
import { useProducts } from "@/service/queries"
import { toast, UiBanner, UiBtn, UiEmpty, UiError, UiIcon, UiLines, UiPage, UiSkPage } from "@/ui"
import { computed } from "vue"
import { useCartQty, useCheckout } from "./cart"

// Экран корзины: строки товаров с правкой количества, итог и оформление (на телефоне — панель действий снизу).
const { can } = useSession()
const { cart, count, replace, clear } = useCart()
const { data: products, isPending, isError, refetch } = useProducts({ always: true })
const { setQty, clamped } = useCartQty()
const { checkout, pending, lock, sent } = useCheckout()

// Пока отправка без ответа (sent), нехватку мог создать сам неподтверждённый заказ: строки не помечаются, чтобы корзину не уменьшали зря.
const lines = computed(() => cartLines(cart, products.value).map((x) => ({ ...x, bad: x.bad && !sent.value })).map((x) => ({ ...x, note: x.bad ? (x.max > 0 ? `Доступно только ${x.max} шт.` : "Закончился") : x.max > 0 ? `в наличии ${x.max}` : "" })))
const over = computed(() => lines.value.some((x) => x.bad))
const sub = computed(() => `${positions(lines.value.length)} · ${pcs(count.value)}`)
const sum = computed(() => money(cartTotal(lines.value)))

function fixAll() {
    replace(Object.fromEntries(lines.value.map((x) => [x.p._id, Math.min(x.qty, x.max)])))
    toast({ type: "warning", title: "Корзина скорректирована по остаткам" })
}
function clearAll() {
    const prev = { ...cart }
    const n = Object.keys(prev).length
    clear()
    toast({ type: "info", title: "Корзина очищена", text: `${n} ${plural(n, ["позиция", "позиции", "позиций"])} убрано`, action: { label: "Вернуть", fn: () => replace(prev) } })
}
</script>

<template>
    <UiPage v-if="!can('create_orders')" title="Корзина" :back="{ name: 'catalog' }">
        <div class="card card--pad"><UiEmpty art="box" title="Сюда нельзя" text="У вашей роли нет доступа к этому разделу" /></div>
    </UiPage>
    <UiPage v-else-if="isError && !products" title="Корзина" :back="{ name: 'catalog' }">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Корзина»" @retry="refetch()" /></div>
    </UiPage>
    <UiSkPage v-else-if="isPending" title="Корзина" :rows="3" />
    <UiPage v-else-if="!lines.length" title="Корзина" :back="{ name: 'catalog' }">
        <div class="card">
            <UiEmpty art="box" title="В корзине пусто"><UiBtn label="Перейти в каталог" icon="grid" :to="{ name: 'catalog' }" /></UiEmpty>
        </div>
    </UiPage>
    <UiPage v-else title="Корзина" :sub="sub" cls="has-abar" :back="{ name: 'catalog' }">
        <template #actions><UiBtn label="Очистить" kind="danger-ghost" size="sm" @click="clearAll" /></template>
        <div v-if="over" style="margin-bottom: var(--sp-5)">
            <UiBanner tone="danger" title="Остатки изменились">
                <template #action><UiBtn label="Исправить все" kind="danger" size="sm" @click="fixAll" /></template>
            </UiBanner>
        </div>
        <div class="cartl">
            <div class="cartl__items">
                <section class="card blk"><UiLines :items="lines" step @qty="setQty" @clamped="clamped" /></section>
            </div>
            <div class="cartl__side">
                <div class="card sumcard">
                    <div class="kv">
                        <span>Позиций</span><b>{{ lines.length }}</b>
                    </div>
                    <div class="kv">
                        <span>Штук</span><b>{{ count }}</b>
                    </div>
                    <div class="sumcard__total">
                        <span>Итого</span><b>{{ sum }}</b>
                    </div>
                    <p v-if="lock" class="foot-note"><UiIcon name="lock" :size="16" class="inl" /> Идёт инвентаризация — создание заказов невозможно</p>
                    <div class="desk-only"><UiBtn label="Оформить заказ" icon="check" block size="lg" :disabled="over || lock" :loading="pending" @click="checkout" /></div>
                </div>
            </div>
        </div>
        <div class="abar">
            <span class="abar__sum"
                ><small>{{ sub }}</small
                ><b>{{ sum }}</b></span
            >
            <UiBtn label="Оформить" icon="check" size="lg" :disabled="over || lock" :loading="pending" @click="checkout" />
        </div>
    </UiPage>
</template>
