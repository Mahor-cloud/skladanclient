<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { money, pcs } from "@/domain/format"
import { ownerId } from "@/domain/orders"
import { physical, pid, stockLevel } from "@/domain/stock"
import axiosInstance from "@/service/axios"
import { useActiveOrders, useIncoming, useProducts } from "@/service/queries"
import { UiBanner, UiBtn, UiCover, UiEmpty, UiPane } from "@/ui"
import { useQuery } from "@tanstack/vue-query"
import { computed } from "vue"
import BuyButton from "./BuyButton.vue"
import { stockLine } from "./catalog"

// Товар — деталь каталога: правая колонка / окно / лист снизу.
const props = defineProps({ id: { type: String, required: true } })
const { user, can, isStaff } = useSession()
const { data: products, isPending } = useProducts()
const { data: orders } = useActiveOrders()
const incomingMap = useIncoming()
// «Мой склад» читает тот же запрос, что и раздел: массив строк { productId, baseQty, currentQty, cabinetItemId }.
const { data: cabinet } = useQuery({ queryKey: ["cabinet-merged"], queryFn: async () => (await axiosInstance.get("/cabinet/merged")).data, staleTime: 30_000, enabled: computed(() => can("cabinet_access")) })

const p = computed(() => (products.value || []).find((x) => x._id === props.id))
const st = computed(() => stockLevel(p.value))
const incoming = computed(() => incomingMap.value[props.id] || 0)
const line = computed(() => stockLine(p.value, incoming.value, isStaff.value))
const canEdit = computed(() => isStaff.value && can("edit_products"))
const cab = computed(() => (cabinet.value || []).find((r) => r.productId === props.id && (r.cabinetItemId || r.baseQty || r.currentQty)))
const inOrders = computed(() => (orders.value || []).filter((o) => !o.isCompleted && ownerId(o) === String(user.value?._id) && o.items.some((it) => pid(it) === props.id)))
</script>

<template>
    <UiPane :title="p ? p.category : isPending ? '' : 'Не найдено'" :back="{ name: 'catalog' }" :loading="isPending">
        <UiEmpty v-if="!p" art="search" title="Такой записи нет" />
        <div v-else class="psheet" :data-pid="p._id">
            <div class="psheet__top">
                <UiCover :product="p" size="lg" eager />
                <div>
                    <div class="psheet__price">{{ money(p.price) }}</div>
                    <h3 class="psheet__name">{{ p.name }}</h3>
                    <div class="psheet__meta">
                        <span :class="line.cls">{{ line.text }}</span
                        ><span v-if="st.level === 'low'" class="tag tag--accent">Мало</span>
                    </div>
                </div>
            </div>
            <UiBanner v-if="st.level === 'deficit' && isStaff" tone="danger" title="Дефицит на складе" />
            <div class="psheet__facts">
                <div class="kv">
                    <span>Вид</span><b>{{ p.category }}</b>
                </div>
                <div class="kv">
                    <span>В наличии</span><b>{{ st.a > 0 ? pcs(st.a) : "нет" }}</b>
                </div>
                <div v-if="isStaff" class="kv">
                    <span>На складе физически</span><b>{{ pcs(physical(p)) }}</b>
                </div>
                <div v-if="isStaff && st.reserved" class="kv">
                    <span>В незавершённых заказах</span><b>{{ pcs(st.reserved) }}</b>
                </div>
                <div v-if="incoming" class="kv">
                    <span>Ждёт поставку</span><b>+{{ pcs(incoming) }} в закупке</b>
                </div>
                <div v-if="cab" class="kv">
                    <span>Мой склад</span><b>у вас {{ cab.currentQty }} из {{ cab.baseQty || "—" }}</b>
                </div>
                <div v-if="inOrders.length" class="kv">
                    <span>В ваших заказах</span><b>{{ inOrders.map((o) => "№" + o.orderNumber).join(", ") }}</b>
                </div>
            </div>
        </div>
        <template v-if="p && (canEdit || can('create_orders'))" #footer>
            <UiBtn v-if="canEdit" :label="can('create_orders') ? '' : 'Изменить товар'" title="Изменить товар" icon="edit" kind="secondary" size="lg" :to="{ name: 'product-edit', params: { id: p._id } }" />
            <div v-if="can('create_orders')" class="psheet__buy"><BuyButton :product="p" size="lg" :incoming="incoming" /></div>
        </template>
    </UiPane>
</template>
