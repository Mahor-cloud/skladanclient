<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useCart } from "@/composables/useCart"
import { available } from "@/domain/stock"
import { fly, UiIcon, UiStepper } from "@/ui"
import { computed, nextTick } from "vue"
import { useCartQty } from "./cart"

// Покупка на карточке: «В корзину» → степпер на месте; нет в наличии — неактивная подпись (или «Ждёт поставку», если товар едет).
const props = defineProps({
    product: { type: Object, required: true },
    size: { type: String, default: "md" },
    incoming: { type: Number, default: 0 }
})
const { cart, set } = useCart()
const { setQty, clamped } = useCartQty()
const max = computed(() => Math.max(0, available(props.product)))

async function toCart(ev) {
    const id = props.product._id
    // Кнопка в подвале листа товара стоит вне карточки — обложку для перелёта берём из той же панели.
    const card = ev.currentTarget.closest("[data-pid]") || ev.currentTarget.closest("#pane, .ov")?.querySelector(`[data-pid="${id}"]`)
    const cover = card?.querySelector("[data-cover]")
    set(id, 1)
    await nextTick()
    fly(cover, document.querySelector(`#pane .line[data-pid="${id}"] [data-cover]`))
}
</script>

<template>
    <UiStepper v-if="cart[product._id]" :model-value="cart[product._id]" :max="max" :size="size" :label="'В корзине: ' + product.name" @update:model-value="setQty(product, $event)" @clamped="clamped(product, $event)" />
    <button v-else-if="max <= 0" type="button" class="btn btn--soldout btn--block" :class="'btn--' + size" disabled>
        <template v-if="incoming"><UiIcon name="truck" :size="18" /><span>Ждёт поставку</span></template>
        <span v-else>Нет в наличии</span>
    </button>
    <button v-else type="button" class="btn btn--primary btn--block btn--buy" :class="'btn--' + size" @click="toCart"><UiIcon name="cart" :size="18" /><span>В корзину</span></button>
</template>
