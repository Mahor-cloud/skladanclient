<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import axiosInstance from "@/service/axios"
import { checkLitna } from "@/service/queries"
import { markActive, overScreen } from "@/service/usage"
import { toast, UiBtn, UiIconBtn, UiLogo, UiSheet } from "@/ui"
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { payFormOk, pollDelay } from "./litna"

// Окно оплаты заказа lit-na.ru открывается сразу: форму Robokassa запрашивает само (способ человек выбирает уже на странице Robokassa),
// пришла — уходит во фрейм; значок в шапке — та же форма в новой вкладке. Пока окно открыто и видно, сайт спрашивается об оплате.
// Событие close(повод, текст): paid | already (оплачена раньше) | reverted (заказа больше нет) | manual (записи заказа нет — 404) |
// failed (отказ сервера) | закрыли сами. end — закупка уже не ждёт оплаты сайта (оплачена или вернулась в черновик с другого
// устройства): окно закрывается само, чтобы не оплатить отменённый заказ живой формой.
const props = defineProps({
    id: { type: String, required: true },
    end: { type: String, default: "" }
})
const emit = defineEmits(["close"])
const frame = "litna-pay-" + props.id
const sheet = ref(null)
const el = ref(null)
const form = ref(null)
// Заставка (знак, как при запуске приложения) закрывает область фрейма, пока страница Robokassa не загрузилась во фрейме:
// первую загрузку пустого фрейма (до отправки формы) не считаем.
const ready = ref(false)
let sent = false
const loaded = () => sent && (ready.value = true)
// Страница банка не загрузилась — форма отправляется во фрейм ещё раз, заставка остаётся с другой подписью. Паузы растут и
// попыток три: на медленной сети частый повтор обрывал бы загрузку, которая вот-вот закончится.
const WAIT = [20_000, 40_000, 80_000]
const again = ref(false)
let retry = 0
let tries = 0
// Вторая проверка прямо перед отправкой: форма уходит только на Robokassa — и во фрейм, и в новую вкладку.
function send(target) {
    if (!payFormOk(form.value?.action)) return toast({ type: "error", title: "Форма оплаты не с Robokassa" })
    if (target === frame) {
        sent = true
        clearTimeout(retry)
        const wait = WAIT[tries++]
        if (wait)
            retry = setTimeout(() => {
                if (ready.value || !alive) return
                again.value = true
                send(frame)
            }, wait)
    }
    el.value.target = target
    el.value.submit()
}

let alive = true
let note = ""
function finish(why, text = "") {
    note = text
    if (alive) sheet.value?.close(why)
}
async function check() {
    const r = await checkLitna(props.id)
    if (r.paid) finish("paid")
    else if (r.reverted || r.gone) finish("reverted", r.message || "")
    return r.paid || r.reverted || r.gone
}
watch(
    () => props.end,
    (v) => v && finish(v),
    { flush: "post" }
)
const t0 = Date.now()
let timer = 0
async function tick() {
    const done = !document.hidden && (await check())
    const ms = pollDelay(Date.now() - t0)
    if (!done && alive && ms) timer = setTimeout(tick, ms)
}
const asking = ref(false)
async function manual() {
    asking.value = true
    const done = await check()
    asking.value = false
    if (!done) toast({ type: "info", title: "Оплаты пока нет" })
}
// Форма оплаты от сервера. Сервер пока ждёт способ — «robokassa» (форма одна для всех способов).
async function load() {
    let data
    try {
        data = (await axiosInstance.post(`/litna/purchases/${props.id}/pay`, { method: "robokassa" })).data
    } catch (err) {
        const res = err?.response
        if (res?.data?.code === "ORDER_CANCELLED") return finish("reverted", res.data.message)
        if (res?.status === 404) return finish("manual")
        return finish("failed", res?.data?.message || err?.message)
    }
    if (data?.paid) return finish("already")
    if (!payFormOk(data?.action)) return finish("failed", "Сайт не отдал форму оплаты")
    if (!alive) return
    form.value = data
    await nextTick()
    send(frame)
    timer = setTimeout(tick, pollDelay(0))
}
// Счётчик использования: пока окно открыто — свой экран; нажатия внутри фрейма до счётчика не доходят — пока вкладка видна
// и фокус во фрейме, активность отмечается раз в 15 с (иначе время обрывалось бы через 30 с).
let back = null
let keep = 0
onMounted(() => {
    back = overScreen("Оплата lit-na.ru")
    // …и только пока идёт опрос оплаты (20 минут): забытая вкладка время не копит
    keep = setInterval(() => !document.hidden && pollDelay(Date.now() - t0) && document.activeElement?.tagName === "IFRAME" && markActive(), 15_000)
    load()
})
onBeforeUnmount(() => {
    alive = false
    clearTimeout(timer)
    clearTimeout(retry)
    clearInterval(keep)
    back?.()
})
</script>

<template>
    <UiSheet ref="sheet" title="Оплата на lit-na.ru" size="lg" cls="ov--pay" @close="emit('close', $event, note)">
        <template #actions><UiIconBtn v-if="form" icon="external" label="Открыть в новой вкладке" @click="send('_blank')" /></template>
        <div class="payfr">
            <!-- Песочница широкая намеренно: банк открывает свои страницы 3-D Secure и переходит в приложение банка — оплату ломать нельзя;
                 allow-same-origin безопасен — во фрейме чужой источник. Поля формы — только значения input. -->
            <iframe
                :name="frame"
                title="Оплата"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation allow-top-navigation-to-custom-protocols"
                referrerpolicy="origin"
                :tabindex="ready ? null : -1"
                @load="loaded"
            ></iframe>
            <div class="payfr__wait" :class="{ 'is-off': ready }" role="status" :aria-hidden="ready ? 'true' : null">
                <UiLogo class="lgo--load" />
                <span class="muted">{{ again ? "Не удалось загрузить форму, пробуем ещё" : "Загружаем форму оплаты" }}</span>
            </div>
        </div>
        <UiBtn label="Проверить оплату" kind="secondary" size="lg" block :loading="asking" :disabled="!form" style="margin-top: var(--sp-5)" @click="manual" />
        <form v-if="form" ref="el" method="post" :action="form.action" rel="noopener noreferrer" hidden>
            <input v-for="(v, k) in form.fields" :key="k" type="hidden" :name="k" :value="v" />
        </form>
    </UiSheet>
</template>
