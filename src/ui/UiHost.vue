<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { confirms, toast, toasts } from "./overlay"
import UiBtn from "./UiBtn.vue"
import UiField from "./UiField.vue"
import UiIcon from "./UiIcon.vue"
import UiSheet from "./UiSheet.vue"

// Рисует то, что вызвано программно: toast() и confirm(). Стоит один раз в App.vue.
const TOAST_ICON = { success: "check", warning: "alert", error: "alert", info: "info" }
const sheets = {}
const tone = (c) => c.o.tone || "primary"

function yes(c) {
    // Окно уже закрывается (Отмена, Esc, затемнение) — ответ не меняется: «Да» за время анимации не должно сработать.
    if (sheets[c.id]?.closing) return
    const reason = c.reason.trim()
    if (c.o.reason?.required && !reason) {
        c.invalid = true
        return toast({ type: "warning", title: "Укажите причину", text: c.o.reason.error })
    }
    c.result = { reason }
    sheets[c.id].close("ok")
}
// Действие уведомления — один раз: уведомление видно ещё 260 мс, второе касание не должно слать второй запрос.
function act(t) {
    if (t.acted) return
    t.acted = true
    t.close()
    t.action.fn()
}
function closed(c) {
    delete sheets[c.id]
    c.done()
}
</script>

<template>
    <Teleport to="#toasts">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="['toast--' + t.type, { 'is-in': t.shown }]" :role="t.type === 'error' ? 'alert' : 'status'">
            <span class="toast__i"><UiIcon :name="TOAST_ICON[t.type]" /></span>
            <div class="toast__b">
                <b>{{ t.title }}</b>
                <p v-if="t.text">{{ t.text }}</p>
            </div>
            <button v-if="t.action" type="button" class="toast__a" @click="act(t)">{{ t.action.label }}</button>
            <button type="button" class="toast__x" aria-label="Закрыть уведомление" @click="t.close()"><UiIcon name="x" :size="18" /></button>
        </div>
    </Teleport>
    <UiSheet v-for="c in confirms" :key="c.id" :ref="(el) => el && (sheets[c.id] = el)" :label="c.o.title" size="sm" cls="ov--confirm" @close="closed(c)">
        <div class="confirm" :class="'confirm--' + tone(c)">
            <span class="confirm__i"><UiIcon :name="c.o.icon || (tone(c) === 'danger' ? 'alert' : tone(c) === 'success' ? 'check' : 'info')" :size="26" /></span>
            <div class="confirm__t">
                <h3>{{ c.o.title }}</h3>
                <p v-if="c.o.text">{{ c.o.text }}</p>
            </div>
        </div>
        <div v-if="c.o.reason" class="confirm__reason">
            <UiField
                v-model="c.reason"
                :class="{ 'is-invalid': c.invalid && !c.reason.trim() }"
                :label="c.o.reason.label || 'Причина изменения'"
                :rows="3"
                maxlength="500"
                :placeholder="c.o.reason.placeholder || 'Например: позиции нет в наличии'"
                :required="c.o.reason.required"
            />
        </div>
        <template #footer>
            <UiBtn :label="c.o.cancel || 'Отмена'" kind="secondary" size="lg" @click="sheets[c.id].close('cancel')" />
            <UiBtn :label="c.o.ok || 'Да'" :kind="tone(c) === 'danger' ? 'danger' : tone(c) === 'success' ? 'success' : 'primary'" :icon="c.o.okIcon" size="lg" @click="yes(c)" />
        </template>
    </UiSheet>
</template>
