<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { money } from "@/domain/format"
import { UiBtn, UiIcon } from "@/ui"
import { computed, ref } from "vue"
import { siteStock } from "./litna"
import LitnaSiteSheet from "./LitnaSiteSheet.vue"

// Поле «Товар на lit-na.ru» в форме товара и шаблона: выбранный товар сайта (подсказка помечена до сохранения) и выбор из каталога.
// modelValue: id товара сайта, null — без привязки, undefined — не решали.
const props = defineProps({
    modelValue: { type: [Number, String], default: undefined },
    guess: Boolean,
    items: { type: Array, default: () => [] },
    title: { type: String, default: "" }
})
const emit = defineEmits(["update:modelValue"])
const site = computed(() => (props.modelValue == null ? null : props.items.find((s) => String(s.id) === String(props.modelValue))))
const open = ref(false)
</script>

<template>
    <div class="field">
        <span class="field__label">Товар на lit-na.ru</span>
        <div class="pickup" style="align-items: center">
            <span class="copyrow__i"><UiIcon name="globe" :size="22" /></span>
            <p style="flex: 1; min-width: 0">
                <span v-if="modelValue == null" class="muted">{{ modelValue === null ? "Без привязки" : "Не выбран" }}</span>
                <template v-else
                    >{{ site ? site.name : items.length ? "Нет на сайте" : "…" }}<template v-if="guess"> <span class="tag tag--warning" style="margin-left: var(--sp-3)">подсказка</span></template
                    ><small v-if="site" class="muted" style="display: block">{{ money(site.price) }} · {{ siteStock(site) }}</small></template
                >
            </p>
            <UiBtn :label="modelValue == null ? 'Выбрать' : 'Изменить'" kind="secondary" data-track="Товар на lit-na.ru" @click="open = true" />
        </div>
    </div>
    <LitnaSiteSheet v-if="open" :title="title" :items="items" :current="modelValue" @pick="emit('update:modelValue', $event)" @close="open = false" />
</template>
