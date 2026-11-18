<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { date } from "@/domain/format"
import axiosInstance from "@/service/axios"
import { useActiveOrders, useInventories, useMsgs, usePurchases } from "@/service/queries"
import { backTo, confirm, toast, UiBtn, UiIcon, UiSheet } from "@/ui"
import { useQueryClient } from "@tanstack/vue-query"
import { computed, ref, watch } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()
const queryClient = useQueryClient()
const { can, isSys } = useSession()
const { data: list } = useInventories()
const { data: orders } = useActiveOrders()
const { data: purchases } = usePurchases()
const { data: msgs } = useMsgs()

const allowed = computed(() => can("create_inventory"))
watch(
    allowed,
    (ok) => {
        if (ok) return
        toast({ type: "error", title: "Нет права начинать инвентаризацию" })
        router.replace({ name: "inventory" })
    },
    { immediate: true }
)

const mode = ref("sync")
const openInv = computed(() => (list.value || []).find((i) => !i.isCompleted) || null)
// Считаем как сервер: все незавершённые заказы и закупки (черновики тоже). Без права их видеть строки нет — решит сервер.
const docs = computed(() => (orders.value && purchases.value ? { orders: orders.value.filter((o) => !o.isCompleted).length, purchases: purchases.value.filter((p) => !p.isCompleted).length } : null))
const has = computed(() => !!docs.value && docs.value.orders + docs.value.purchases > 0)
const docsLine = computed(() => docs.value && `Незавершённых заказов: ${docs.value.orders}, закупок: ${docs.value.purchases}`)
// Настройка местности видна с правом view-messages; не видна — не запрещаем заранее, запрет вернёт сервер.
const denied = computed(() => !!msgs.value && msgs.value.allowInventoryWithOpenDocs !== true)
const blocked = computed(() => !!openInv.value || (has.value && denied.value))

const busy = ref(false)
async function start(confirmOpenDocs = false) {
    busy.value = true
    try {
        const { data } = await axiosInstance.post("/inventory", { prefillFromStock: mode.value === "sync", ...(confirmOpenDocs ? { confirmOpenDocs: true } : {}) })
        queryClient.invalidateQueries({ queryKey: ["inventorizations"] })
        toast({ type: "info", title: "Началась инвентаризация", text: "Выдача заказов и приёмка закупок на паузе", timeout: 5200 })
        router.push({ name: "inventory-edit", params: { id: data._id } })
    } catch (e) {
        const p = e?.response?.data
        // Настройка включена, есть открытые документы: сервер просит подтвердить — текст его же.
        if (p?.code === "OPEN_DOCS" && !confirmOpenDocs) {
            busy.value = false
            if (await confirm({ title: "Начать инвентаризацию?", icon: "clipboard", ok: "Начать", okIcon: "check", cancel: "Не сейчас", text: p.message })) await start(true)
            return
        }
        toast({ type: "warning", title: "Нельзя начать инвентаризацию", text: p?.message || "Сначала завершите все заказы и закупки.", timeout: 7000 })
    } finally {
        busy.value = false
    }
}
</script>

<template>
    <UiSheet v-if="allowed" title="Новая инвентаризация" size="md" @close="backTo({ name: 'inventory' })">
        <div class="modes" role="radiogroup" aria-label="Режим">
            <label class="mode"
                ><input v-model="mode" type="radio" name="invmode" value="sync" /><span class="mode__b"
                    ><span class="mode__i"><UiIcon name="repeat" :size="22" /></span
                    ><span
                        ><b>Свести с остатками <span class="tag tag--success">рекомендуется</span></b
                        ><small>Каждая позиция начнётся с текущего остатка склада, отклонение = 0. Правьте только те товары, где есть расхождение. Незатронутые позиции останутся без изменений.</small></span
                    ></span
                ></label
            >
            <label class="mode"
                ><input v-model="mode" type="radio" name="invmode" value="empty" /><span class="mode__b"
                    ><span class="mode__i"><UiIcon name="clipboard" :size="22" /></span
                    ><span><b>Пустая (с нуля)</b><small>Все позиции начнутся с 0. Нужно вручную вписать фактическое количество по каждому товару. Незаполненные позиции при завершении обнулят остаток.</small></span></span
                ></label
            >
        </div>
        <h4 class="checks__h">Перед началом</h4>
        <ul class="checks">
            <li v-if="openInv" class="is-bad">
                <UiIcon name="x" :size="18" /><span>Есть незавершённая инвентаризация от {{ date(openInv.startDate) }}<small>Завершите её перед созданием новой.</small></span>
            </li>
            <li v-else class="is-ok"><UiIcon name="check" :size="18" /><span>Нет незавершённых инвентаризаций</span></li>
            <li v-if="docs && !has" class="is-ok"><UiIcon name="check" :size="18" /><span>Все заказы и закупки завершены</span></li>
            <li v-else-if="has && !denied" class="is-info">
                <UiIcon name="info" :size="18" /><span>{{ docsLine }}</span>
            </li>
            <li v-else-if="has" class="is-bad">
                <UiIcon name="x" :size="18" /><span
                    >{{ docsLine }}. Сначала завершите их<small
                        ><span class="checks__links"><RouterLink to="/shop">Открыть заказы</RouterLink><RouterLink to="/purchase">Открыть закупки</RouterLink></span
                        >Председатель может разрешить инвентаризацию при открытых заказах: <RouterLink v-if="isSys" :to="{ name: 'admin-settings' }">Админка → Настройки</RouterLink><template v-else>Админка → Настройки</template>.</small
                    ></span
                >
            </li>
        </ul>
        <template #footer="{ close }">
            <UiBtn label="Отмена" kind="secondary" size="lg" @click="close()" />
            <UiBtn :label="openInv ? 'Уже идёт другая' : blocked ? 'Начать нельзя' : 'Начать'" :icon="blocked ? 'lock' : 'check'" size="lg" :disabled="blocked" :loading="busy" @click="start()" />
        </template>
    </UiSheet>
</template>
