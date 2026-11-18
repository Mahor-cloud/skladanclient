<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { ref } from "vue"
import UiIcon from "./UiIcon.vue"

// Поле ввода; rows — многострочное. Прочие атрибуты (autocomplete, list, name…) уходят на сам <input>, class — на обёртку.
defineOptions({ inheritAttrs: false })
const props = defineProps({
    modelValue: { type: [String, Number], default: "" },
    label: { type: String, default: "" },
    type: { type: String, default: "text" },
    hint: { type: String, default: "" },
    error: { type: String, default: "" },
    prefix: { type: String, default: "" },
    suffix: { type: String, default: "" },
    icon: { type: String, default: "" },
    rows: { type: Number, default: 0 },
    required: Boolean,
    readonly: Boolean,
    id: { type: String, default: "" }
})
defineEmits(["update:modelValue"])
const uid = props.id || "f-" + ++seq
const input = ref(null)
defineExpose({ focus: () => input.value?.focus() })
</script>

<script>
let seq = 0
</script>

<template>
    <label class="field" :class="[{ 'is-invalid': error, 'is-readonly': readonly }, $attrs.class]" :for="uid">
        <span v-if="label" class="field__label">{{ required ? label + " " : label }}<span v-if="required" class="req" aria-hidden="true">*</span></span>
        <span class="field__box" :class="{ 'field__box--area': rows }">
            <UiIcon v-if="icon" :name="icon" class="field__icon" />
            <span v-if="prefix" class="field__fix">{{ prefix }}</span>
            <textarea
                v-if="rows"
                :id="uid"
                ref="input"
                class="field__input"
                :rows="rows"
                :value="modelValue"
                :readonly="readonly"
                :required="required"
                :aria-invalid="error ? 'true' : null"
                :aria-describedby="hint || error ? uid + '-h' : null"
                v-bind="{ ...$attrs, class: undefined }"
                @input="$emit('update:modelValue', $event.target.value)"
            ></textarea>
            <input
                v-else
                :id="uid"
                ref="input"
                class="field__input"
                :type="type"
                :value="modelValue"
                :readonly="readonly"
                :required="required"
                :aria-invalid="error ? 'true' : null"
                :aria-describedby="hint || error ? uid + '-h' : null"
                v-bind="{ ...$attrs, class: undefined }"
                @input="$emit('update:modelValue', $event.target.value)"
            />
            <span v-if="suffix" class="field__fix">{{ suffix }}</span>
            <slot name="after" />
        </span>
        <span v-if="error" :id="uid + '-h'" class="field__msg field__msg--err"><UiIcon name="alert" :size="16" />{{ error }}</span>
        <span v-else-if="hint" :id="uid + '-h'" class="field__msg">{{ hint }}</span>
    </label>
</template>
