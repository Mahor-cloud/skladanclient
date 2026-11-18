<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { money, plural, positions } from "@/domain/format"
import { STATUS } from "@/domain/orders"
import { paneSel, UiCover, UiStatus } from "@/ui"
import { computed } from "vue"

// «Сейчас важно»: плитки по правам, «Чего не хватает» и свои заказы служащего. На широком экране — в правой колонке,
// уже — над списком (inline, без «Чего не хватает»). rows — заказы, которые видит пользователь; shortages — GET /orders/shortages.
const props = defineProps({
    rows: { type: Array, required: true },
    shortages: { type: Array, required: true },
    products: { type: Map, required: true },
    inline: Boolean
})
defineEmits(["filter"])
const { can, isStaff } = useSession()

const pay = computed(() => isStaff.value && can("approve-payment"))
const stock = computed(() => isStaff.value && can("edit_products"))
const act = computed(() => props.rows.filter((r) => !r.o.isCompleted))
const tiles = computed(() => {
    const by = (st) => act.value.filter((r) => r.st === st)
    const tile = (label, list, f, tone, sub) => ({ label, n: list.length, f, tone, sub: sub ?? (list.length ? money(list.reduce((s, r) => s + r.total, 0)) : "пока нет") })
    const out = []
    if (pay.value) {
        const diff = by("paid").filter((r) => r.diff)
        out.push(tile("Оплаты к подтверждению", by("paid"), "paid", "gold"), tile("Из них с доплатой или возвратом", diff, "paid", "", diff.length ? "проверьте суммы" : "нет"))
    }
    if (stock.value) {
        const n = props.shortages.length
        out.push(tile("К выдаче", by("ready"), "ready", "blue"), { label: "Нехватка на складе", n, f: "ready", tone: n ? "warn" : "", sub: n ? plural(n, ["товар", "товара", "товаров"]) + " не хватает" : "всего хватает" })
    }
    if (!out.length && isStaff.value) out.push(tile("Ждут оплаты", by("new"), "new"), tile("К выдаче", by("ready"), "ready", "blue"))
    if (!out.length) out.push(tile("Ждут вашей оплаты", by("new"), "active", "gold"), tile("Можно забирать", by("ready"), "active", "blue"))
    return out
})
const short = computed(() => (stock.value && !props.inline ? props.shortages.slice(0, 4) : []))
// Свои заказы служащего — рядом со сводкой: в общем списке они среди чужих.
const own = computed(() =>
    isStaff.value
        ? act.value
              .filter((r) => r.pm.own)
              .sort((a, b) => b.turn.mine - a.turn.mine || b.o.orderNumber - a.o.orderNumber)
              .slice(0, 3)
        : []
)
</script>

<template>
    <div class="rsum" :class="{ 'rsum--inline': inline }">
        <div class="rtiles">
            <button v-for="t in tiles" :key="t.label" type="button" class="rtile" :class="t.tone && 'rtile--' + t.tone" @click="$emit('filter', t.f)">
                <small>{{ t.label }}</small
                ><b>{{ t.n }}</b
                ><span>{{ t.sub }}</span>
            </button>
        </div>
        <div v-if="short.length" class="rsum__sec">
            <h4>Чего не хватает</h4>
            <RouterLink v-for="s in short" :key="s.product" class="rdef" :to="{ name: 'product', params: { id: s.product } }">
                <UiCover :product="products.get(s.product) || { _id: s.product, name: s.productName, category: '' }" size="xs" />
                <span
                    ><b>{{ s.productName }}</b
                    ><small>нужно {{ s.required }}, на складе {{ s.inStock }}</small></span
                >
            </RouterLink>
        </div>
        <div v-if="own.length" class="rsum__sec">
            <h4>Мои заказы</h4>
            <div class="myorders__l">
                <RouterLink v-for="r in own" :key="r._id" class="myo" :class="{ 'myo--mine': r.turn.mine, 'is-sel': paneSel('/shop/order/' + r._id) }" :to="{ name: 'order', params: { id: r._id } }">
                    <UiStatus :st="r.st" bare />
                    <span class="myo__t"
                        ><b>№{{ r.o.orderNumber }} · {{ STATUS[r.st].label }}</b
                        ><small>{{ money(r.total) }} · {{ positions(r.o.items.length) }}</small></span
                    >
                    <span v-if="r.pm.pay" class="btn btn--primary btn--sm">Оплатить</span>
                    <span v-else-if="r.pm.confirm" class="btn btn--success btn--sm">Подтвердить</span>
                    <span v-else-if="r.pm.complete && !r.pm.blocked && !r.pm.frozen" class="btn btn--success btn--sm">{{ r.pm.own ? "Получил" : "Выдать" }}</span>
                    <span v-else class="myo__wait" :class="{ 'is-warn': r.turn.warn }">{{ r.turn.short }}</span>
                </RouterLink>
            </div>
        </div>
        <div v-if="!inline" class="cartempty cartempty--sm">
            <svg class="lineart" viewBox="0 0 220 150" aria-hidden="true">
                <g class="draw">
                    <path pathLength="1" d="M46 22h104l24 24v82H46z" />
                    <path pathLength="1" d="M150 22v24h24" />
                    <path pathLength="1" class="thin" d="M64 62h60M64 78h86M64 94h72M14 140h192" />
                    <path pathLength="1" class="gold" d="M150 96a13 13 0 1 0 .1 0M144 109l5 5 9-10" />
                </g>
            </svg>
            <b>Выберите заказ</b>
        </div>
    </div>
</template>
