<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { nextTick, onBeforeUnmount, ref } from "vue"
import UiIcon from "./UiIcon.vue"

// Количество: − / поле / +. При min = 0 и значении 1 «минус» становится корзиной (убрать). Ввод с клавиатуры применяется с задержкой,
// а при потере фокуса, Enter и уходе со страницы — сразу: разделы перед действием снимают фокус и получают набранное число.
// Значение больше max урезается, о чём сообщает событие clamped(max).
const props = defineProps({
    modelValue: { type: Number, required: true },
    min: { type: Number, default: 0 },
    max: { type: Number, default: Infinity },
    size: { type: String, default: "md" },
    label: { type: String, default: "Количество" },
    trash: { type: Boolean, default: true }
})
const emit = defineEmits(["update:modelValue", "clamped"])
const input = ref(null)
let timer = 0
let typed = false // в поле набрано то, что ещё не применено
// При min < 0 (факт инвентаризации) с клавиатуры можно набрать и минус — только в начале, как в прежнем окне.
const digits = (s) => (props.min < 0 ? s.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "") : s.replace(/\D/g, ""))
// final — окончательно (фокус ушёл, Enter, размонтирование): пустое поле — это min, как в прежнем «Моём складе»; «-» и мусор — прежнее значение.
function apply(el, final) {
    const raw = digits(el.value)
    let v = raw === "" && final ? props.min : parseInt(raw, 10)
    if (isNaN(v)) {
        if (final) el.value = props.modelValue
        return
    }
    typed = false
    if (v > props.max) {
        v = props.max
        emit("clamped", props.max)
    }
    v = Math.max(props.min, v)
    if (v !== props.modelValue) emit("update:modelValue", v)
    else el.value = v
}
const onInput = (ev) => {
    typed = true
    clearTimeout(timer)
    timer = setTimeout(apply, 700, ev.target, false)
}
function commit(ev) {
    clearTimeout(timer)
    if (!typed) return
    const el = ev.target
    apply(el, true)
    // Родитель мог не принять число — поле не должно показывать то, чего нет в модели.
    nextTick(() => document.activeElement !== el && (el.value = props.modelValue))
}
onBeforeUnmount(() => {
    clearTimeout(timer)
    if (typed && input.value) apply(input.value, true)
})
</script>

<template>
    <div class="stepper" :class="'stepper--' + size" role="group" :aria-label="label">
        <button type="button" class="stepper__b" aria-label="Уменьшить" :disabled="modelValue <= min" @click="$emit('update:modelValue', modelValue - 1)"><UiIcon :name="trash && modelValue <= 1 && min === 0 ? 'trash' : 'minus'" :size="18" /></button>
        <input
            ref="input"
            class="stepper__v"
            type="text"
            name="qty"
            autocomplete="off"
            inputmode="numeric"
            :pattern="min < 0 ? '-?[0-9]*' : '[0-9]*'"
            :value="modelValue"
            :aria-label="label"
            @input="onInput"
            @change="commit"
            @blur="commit"
            @keydown.enter="commit"
        />
        <button type="button" class="stepper__b" aria-label="Увеличить" :disabled="modelValue >= max" @click="$emit('update:modelValue', modelValue + 1)"><UiIcon name="plus" :size="18" /></button>
    </div>
</template>
