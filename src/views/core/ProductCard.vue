<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { money } from "@/domain/format"
import { stockLevel } from "@/domain/stock"
import { paneSel, UiCover, UiIcon, UiIconBtn } from "@/ui"
import { computed } from "vue"
import BuyButton from "./BuyButton.vue"
import { stockLine } from "./catalog"

// Плитка товара в каталоге и в ленте «Вы часто берёте».
const props = defineProps({
    p: { type: Object, required: true },
    index: { type: Number, default: 0 },
    incoming: { type: Number, default: 0 },
    canEdit: Boolean,
    eager: Boolean
})
const { can, isStaff } = useSession()
const st = computed(() => stockLevel(props.p))
const line = computed(() => stockLine(props.p, props.incoming, isStaff.value))
const to = computed(() => ({ name: "product", params: { id: props.p._id } }))
</script>

<template>
    <article class="pcard" :class="{ 'pcard--out': st.a <= 0, 'is-sel': paneSel('/product/' + p._id) }" :data-pid="p._id" data-tilt :style="{ '--n': Math.min(index, 8) }">
        <RouterLink class="pcard__cover" :to="to" :aria-label="p.name">
            <UiCover :product="p" :eager="eager" />
            <span v-if="st.level === 'deficit' && isStaff" class="pcard__tags"><span class="tag tag--danger">Дефицит</span></span>
            <span v-else-if="st.level === 'low'" class="pcard__tags"><span class="tag tag--accent">Мало</span></span>
            <span v-else-if="st.a <= 0 && incoming" class="pcard__tags"
                ><span class="tag tag--primary"><UiIcon name="truck" :size="14" />Ждёт поставку</span></span
            >
        </RouterLink>
        <UiIconBtn v-if="canEdit" icon="edit" label="Изменить товар" :to="{ name: 'product-edit', params: { id: p._id } }" class="pcard__edit" :size="20" />
        <div class="pcard__body">
            <span class="price">{{ money(p.price) }}</span>
            <RouterLink class="pcard__name" :to="to">{{ p.name }}</RouterLink>
            <span :class="line.cls">{{ line.text }}</span>
        </div>
        <div v-if="can('create_orders')" class="pcard__buy"><BuyButton :product="p" :incoming="incoming" /></div>
    </article>
</template>
