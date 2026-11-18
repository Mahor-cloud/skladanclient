<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useCart } from "@/composables/useCart"
import { useSession } from "@/composables/useSession"
import { money } from "@/domain/format"
import { physical, stockLevel } from "@/domain/stock"
import { paneSel, UiCover, UiIcon, UiIconBtn } from "@/ui"
import { computed } from "vue"
import BuyButton from "./BuyButton.vue"

// Строка товара в каталоге-списке: на телефоне цена и остатки — подписью под названием, на компьютере — колонками.
const props = defineProps({
    p: { type: Object, required: true },
    incoming: { type: Number, default: 0 },
    canEdit: Boolean
})
const { can } = useSession()
const { cart } = useCart()
const st = computed(() => stockLevel(props.p))
</script>

<template>
    <div class="lrow" :class="{ 'lrow--deficit': st.level === 'deficit', 'is-sel': paneSel('/product/' + p._id) }" :data-pid="p._id">
        <RouterLink class="lrow__link" :to="{ name: 'product', params: { id: p._id } }" :aria-label="p.name"></RouterLink>
        <UiCover :product="p" size="sm" />
        <div class="lrow__main">
            <span class="lrow__n">{{ p.name }}</span>
            <div class="lrow__m">
                <span>{{ p.category }}</span
                ><span class="mob"
                    ><b>{{ money(p.price) }}</b></span
                >
                <span class="mob"
                    >доступно <b>{{ st.a }}</b> · склад {{ physical(p) }}<template v-if="p.targetQty"> · цель {{ p.targetQty }}</template></span
                >
                <span v-if="st.level === 'deficit'" class="tag tag--danger">Дефицит</span>
                <span v-else-if="st.level === 'low'" class="tag tag--accent">Мало</span>
                <span v-else-if="st.level === 'out'" class="tag tag--neutral">Нет</span>
                <span v-if="incoming" class="tag tag--primary"><UiIcon name="truck" :size="14" />+{{ incoming }} в пути</span>
            </div>
        </div>
        <div class="lrow__c">{{ money(p.price) }}</div>
        <div class="lrow__c" :class="{ muted: st.a <= 0 }">{{ st.a }}<small>доступно</small></div>
        <div class="lrow__c">
            {{ physical(p) }}<small>{{ st.reserved ? `в заказах ${st.reserved}` : "на складе" }}</small>
        </div>
        <div class="lrow__c">{{ p.targetQty || "—" }}<small>цель</small></div>
        <div class="lrow__a">
            <span v-if="can('create_orders') && (st.a > 0 || cart[p._id])"><BuyButton :product="p" size="sm" :incoming="incoming" /></span>
            <UiIconBtn v-if="canEdit" icon="edit" :label="'Изменить: ' + p.name" :to="{ name: 'product-edit', params: { id: p._id } }" kind="soft" />
        </div>
    </div>
</template>
