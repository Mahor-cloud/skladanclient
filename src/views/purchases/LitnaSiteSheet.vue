<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { money } from "@/domain/format"
import { UiBtn, UiIcon, UiLazy, UiSheet } from "@/ui"
import { computed, reactive, ref } from "vue"
import { search, siteStock } from "./litna"

// Выбор товара lit-na.ru — в форме товара, шаблоне «Семян», привязке в админке и в закупке. current: id товара сайта (или подсказка) —
// выбран заранее; null — без привязки, undefined — не решали. Привязка (none): поиск заполнен названием нашего товара (title),
// нажатие на строку только выбирает её, «Привязать» подтверждает; «Из lit-na.ru» (без none): поиск пуст, нажатие сразу выбирает.
// Событие pick(id | null) — сразу, close — после анимации.
// Миниатюры — публичный адрес нашего сервера; нет картинки или не загрузилась — значок в той же рамке, строки не прыгают.
const props = defineProps({
    title: { type: String, default: "" },
    items: { type: Array, default: () => [] },
    current: { type: [Number, String], default: undefined },
    none: { type: Boolean, default: true }
})
const broken = reactive(new Set())
const emit = defineEmits(["pick", "close"])
const q = ref(props.none ? props.title : "")
const sel = ref(props.current ?? null)
const list = computed(() => search(props.items, q.value, (s) => `${s.name} ${s.sku || ""}`))
const on = (s) => sel.value != null && String(s.id) === String(sel.value)
function choose(v, close) {
    emit("pick", v)
    close()
}
const tap = (s, close) => (props.none ? (sel.value = s.id) : choose(s.id, close))
</script>

<template>
    <UiSheet :title="title || 'Товар на lit-na.ru'" size="lg" @close="emit('close')">
        <template #default="{ close }">
            <form class="msearch__f" style="margin-bottom: var(--sp-5)" role="search" @submit.prevent="$event.target.querySelector('input').blur()">
                <UiIcon name="search" /><input v-model="q" type="search" name="q" placeholder="Товар сайта или артикул" aria-label="Товар сайта или артикул" autocomplete="off" @focus="$event.target.select()" />
                <button v-if="q" type="button" class="msearch__x" aria-label="Очистить поиск" @click="q = ''"><UiIcon name="x" :size="18" /></button>
            </form>
            <div>
                <UiLazy v-slot="{ item: s }" :items="list" :size="30" :reset-key="q">
                    <button type="button" class="sugg__p" :data-track="none ? 'Товар сайта' : 'Товар сайта для нового'" :aria-pressed="on(s)" :style="on(s) ? 'background: var(--primary-soft)' : ''" @click="tap(s, close)">
                        <span class="copyrow__i" style="overflow: hidden"
                            ><img v-if="s.image && !broken.has(s.id)" :src="`/api/litna/thumb/${s.id}`" alt="" loading="lazy" width="40" height="40" style="width: 100%; height: 100%; object-fit: cover" @error="broken.add(s.id)" /><UiIcon
                                v-else
                                name="image"
                        /></span>
                        <UiIcon v-if="on(s)" name="check" /><span class="sugg__n"
                            >{{ s.name }}<small>{{ [s.sku, siteStock(s)].filter(Boolean).join(" · ") }}</small></span
                        ><b>{{ money(s.price) }}</b>
                    </button>
                </UiLazy>
                <p v-if="!list.length" class="muted">Ничего не нашли</p>
            </div>
        </template>
        <template v-if="none" #footer="{ close }">
            <UiBtn label="Без привязки" kind="secondary" size="lg" data-track="Выбрать «Без привязки»" :disabled="current === null" @click="choose(null, close)" />
            <UiBtn label="Привязать" icon="check" size="lg" data-track="Привязать к lit-na.ru" :disabled="sel == null" @click="choose(sel, close)" />
        </template>
    </UiSheet>
</template>
