<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { money, positions } from "@/domain/format"
import { orderPerms, orderStatus, STATUS } from "@/domain/orders"
import { searchProducts } from "@/domain/stock"
import axiosInstance from "@/service/axios"
import { useProducts } from "@/service/queries"
import { backTo, toast, UiBanner, UiBtn, UiCover, UiEmpty, UiField, UiIcon, UiIconBtn, UiPage, UiSkPage, UiStepper } from "@/ui"
import { computed, nextTick, ref, toRef, watch } from "vue"
import { orderError, refreshOrders, useOrder } from "./api"
import { editDiff, linesPayload, linesTotal, maxQty, orderLines, sameItems } from "./orders"

// Правка позиций заказа: количество, удаление и добавление товаров; для оплаченного и завершённого — с причиной.
const props = defineProps({ id: { type: String, required: true } })
const { can, isSys, plain } = useSession()
const { data: order, isPending } = useOrder(toRef(props, "id"))
const { data: products } = useProducts()

const back = computed(() => ({ name: "order", params: { id: props.id } }))
const pm = computed(() => orderPerms(order.value, plain.value))
const orig = computed(() => orderLines(order.value))
const items = ref(null)
const reason = ref("")
const q = ref("")
const saving = ref(false)
const reasonField = ref(null)
// Черновик берётся из заказа один раз: обновление заказа по realtime не должно стирать начатую правку.
watch(order, (o) => o && !items.value && (items.value = orig.value.map((x) => ({ p: x.p, qty: x.qty }))), { immediate: true })
// Другой заказ по тому же экрану — черновик прежнего к нему не относится.
watch(
    () => props.id,
    () => {
        items.value = null
        reason.value = ""
    }
)

const needReason = computed(() => !!(order.value.isPaid || order.value.isCompleted))
// Завершённый заказ правит только системная роль, и остаток её не ограничивает: склад пересчитается на разницу.
const over = computed(() => isSys.value && !!order.value.isCompleted)
const byId = computed(() => new Map((products.value || []).map((p) => [String(p._id), p])))
const room = (p) => maxQty(byId.value.get(String(p._id)), orig.value.find((x) => String(x.p._id) === String(p._id))?.qty)
const maxFor = (p) => (over.value ? Infinity : room(p))
const total = computed(() => linesTotal(items.value))
const changed = computed(() => !sameItems(orig.value, items.value))
// Прогноз показывается только по настоящей правке: без неё сервер сумму не сравнивает.
const delta = computed(() => (changed.value ? editDiff(order.value, total.value) : 0))

const hits = computed(() =>
    q.value.trim()
        ? searchProducts(products.value || [], q.value)
              .filter((p) => !p.deletedAt)
              .slice(0, 6)
        : []
)
const has = (p) => items.value.some((x) => String(x.p._id) === String(p._id))
function add(p) {
    // Товар, который был в заказе и возвращён в ту же правку, идёт по своей прежней цене — так его посчитает и сервер.
    const was = orig.value.find((x) => String(x.p._id) === String(p._id))
    items.value.push({ p: was?.p || p, qty: 1 })
    q.value = ""
}
function drop(i) {
    const [x] = items.value.splice(i, 1)
    toast({ type: "info", title: "Позиция убрана", text: x.p.name, action: { label: "Вернуть", fn: () => has(x.p) || items.value.splice(Math.min(i, items.value.length), 0, x) } })
}
const clamped = (p, max) => toast({ type: "warning", title: "Недостаточно на складе", text: `«${p.name}»: доступно максимум ${max} шт. Количество уменьшено до ${max}.` })

async function save() {
    if (saving.value) return
    // Набранное в поле количества применяется по потере фокуса, а кнопка её не гарантирует (на iPhone фокус остаётся в поле):
    // без этого ушло бы прежнее количество.
    document.activeElement?.blur?.()
    await nextTick()
    if (!items.value.length) return toast({ type: "warning", title: "Заказ не может быть пустым" })
    const why = reason.value.trim()
    if (needReason.value && !why) {
        reasonField.value?.focus()
        return toast({ type: "warning", title: "Укажите причину изменения" })
    }
    if (!changed.value) {
        backTo(back.value)
        return toast({ type: "info", title: "Изменений нет" })
    }
    const o = order.value
    const d = delta.value
    const payload = { items: linesPayload(items.value) }
    if (typeof o.comment === "string") payload.comment = o.comment
    if (why) payload.editReason = why
    saving.value = true
    try {
        await axiosInstance.put(`/orders/${props.id}`, payload)
        refreshOrders(props.id)
        // saving не снимается: экран уходит, а повторное касание до ухода отправило бы правку ещё раз
        backTo(back.value)
        toast({ type: "success", title: "Позиции заказа обновлены", text: !o.isCompleted && d ? `Казначей подтвердит ${d > 0 ? "доплату" : "возврат"} ${money(Math.abs(d))}` : "" })
    } catch (e) {
        saving.value = false
        const data = e?.response?.data
        if (data?.code === "INSUFFICIENT_STOCK") {
            // Сервер назвал, сколько доступно: строка подрезается, сохранить нужно ещё раз.
            const row = items.value.find((x) => String(x.p._id) === String(data.product))
            if (row) row.qty = Math.max(1, Number(data.available) || 0)
            toast({ type: "warning", title: "Недостаточно на складе", text: `«${data.productName}»: запрошено ${data.requested}, доступно ${data.available}. Количество подрезано до ${data.available}. Проверьте и сохраните снова.`, timeout: 7000 })
        } else orderError(e, "Не удалось обновить заказ")
    }
}
</script>

<template>
    <UiSkPage v-if="isPending && can('view_orders')" title="Правка заказа" />
    <UiPage v-else-if="!order" title="Заказ не найден" :back="{ name: 'shop' }">
        <div class="card">
            <UiEmpty art="search" title="Заказ не найден"><UiBtn label="Все заказы" icon="receipt" :to="{ name: 'shop' }" /></UiEmpty>
        </div>
    </UiPage>
    <UiPage v-else-if="!pm.edit || !items" :title="`Заказ №${order.orderNumber}`" :back="back">
        <div class="card">
            <UiEmpty art="box" title="Позиции править нельзя"><UiBtn label="Вернуться к заказу" :to="back" /></UiEmpty>
        </div>
    </UiPage>
    <UiPage v-else :title="`Правка заказа №${order.orderNumber}`" :sub="`${order.user?.name || ''} · ${STATUS[orderStatus(order)].label}`" :back="back" cls="has-abar">
        <template #crumbs>
            <RouterLink :to="{ name: 'shop' }">Заказы</RouterLink><UiIcon name="right" :size="14" /><RouterLink :to="back">№{{ order.orderNumber }}</RouterLink
            ><UiIcon name="right" :size="14" /><span>Правка позиций</span>
        </template>
        <div class="order">
            <div class="order__main">
                <section class="card blk o-items">
                    <h3>
                        Позиции<small>{{ positions(items.length) }}</small>
                    </h3>
                    <p v-if="!items.length" class="muted">Позиций нет — заказ не может быть пустым.</p>
                    <div v-for="(x, i) in items" :key="x.p._id" class="irow irow--edit">
                        <UiCover :product="x.p" size="sm" />
                        <div class="irow__n">
                            {{ x.p.name
                            }}<small
                                >{{ money(x.p.price) }} за шт.<template v-if="!over && byId.has(String(x.p._id))"> · можно до {{ room(x.p) }}</template></small
                            >
                        </div>
                        <div class="irow__e">
                            <UiStepper v-model="x.qty" :min="1" :max="maxFor(x.p)" :label="'Количество: ' + x.p.name" @clamped="clamped(x.p, $event)" />
                            <span class="irow__s">{{ money(x.p.price * x.qty) }}</span>
                            <UiIconBtn icon="trash" :label="'Убрать ' + x.p.name" data-track="Убрать товар" @click="drop(i)" />
                        </div>
                    </div>
                    <div class="addrow">
                        <span class="field__label">Добавить товар</span>
                        <label class="msearch__f"><UiIcon name="plus" /><input v-model="q" type="search" name="q" placeholder="Выберите товар" aria-label="Добавить товар" autocomplete="off" /></label>
                        <div v-if="q.trim()">
                            <div v-if="hits.length" class="sugg sugg--inline">
                                <button v-for="p in hits" :key="p._id" type="button" class="sugg__p" data-track="Товар из подсказки" :disabled="has(p) || room(p) <= 0" @click="add(p)">
                                    <UiCover :product="p" size="xs" />
                                    <span class="sugg__n"
                                        >{{ p.name }}<small>{{ has(p) ? "уже в заказе" : room(p) > 0 ? `в наличии ${room(p)}` : "нет в наличии" }}</small></span
                                    >
                                    <b>{{ money(p.price) }}</b>
                                </button>
                            </div>
                            <p v-else class="muted">Ничего не нашли</p>
                        </div>
                    </div>
                    <div class="itotal">
                        <span>Итого после правки</span><b>{{ money(total) }}</b>
                    </div>
                </section>
            </div>
            <div class="order__side">
                <div v-if="order.isCompleted || delta" class="banners">
                    <UiBanner v-if="order.isCompleted" tone="warning" title="Правка завершённого заказа" text="Склад будет пересчитан на разницу: уменьшение вернёт товар на склад, увеличение — спишет дополнительно." />
                    <UiBanner
                        v-if="delta > 0"
                        tone="warning"
                        icon="wallet"
                        :title="`Потребуется доплата ${money(delta)}`"
                        :text="`Всего к оплате ${money(total)}.` + (order.isCompleted ? '' : ' Подтверждение оплаты будет сброшено — казначей подтвердит заново.')"
                    />
                    <UiBanner v-else-if="delta < 0" tone="teal" :title="`Потребуется возврат ${money(-delta)}`" :text="`Всего к оплате ${money(total)}.` + (order.isCompleted ? '' : ' Казначей подтвердит возврат.')" />
                </div>
                <section v-if="needReason" class="card blk o-reason"><UiField ref="reasonField" v-model="reason" label="Причина изменения" :rows="3" maxlength="500" required /></section>
                <div class="order__acts">
                    <UiBtn label="Сохранить позиции" icon="check" size="lg" block :loading="saving" @click="save" />
                    <UiBtn label="Отмена" kind="secondary" size="lg" block @click="backTo(back)" />
                </div>
            </div>
            <div class="abar">
                <UiBtn label="Отмена" kind="secondary" size="lg" @click="backTo(back)" />
                <UiBtn label="Сохранить" icon="check" size="lg" :loading="saving" @click="save" />
            </div>
        </div>
    </UiPage>
</template>
