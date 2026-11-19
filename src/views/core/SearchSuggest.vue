<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { money } from "@/domain/format"
import { available } from "@/domain/stock"
import { UiChip, UiCover, UiIcon } from "@/ui"

// Подсказки под строкой поиска каталога: пустой запрос — «Вы искали» и виды, иначе первые совпадения.
const props = defineProps({
    q: { type: String, required: true },
    history: { type: Array, required: true },
    kinds: { type: Array, required: true },
    hits: { type: Array, required: true },
    incoming: { type: Object, required: true }
})
defineEmits(["search", "kind", "product"])
// Название режется на куски вокруг совпадения — подсветка без вставки HTML.
const marked = (name) => name.split(new RegExp("(" + props.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"))
const note = (p) => `${p.category} · ${available(p) > 0 ? "в наличии " + available(p) : props.incoming[p._id] ? "ждёт поставку" : "нет в наличии"}`
</script>

<template>
    <div class="sugg" role="listbox">
        <template v-if="!q.trim()">
            <div v-if="history.length" class="sugg__sec">
                <h4>Вы искали</h4>
                <div class="sugg__chips"><UiChip v-for="h in history" :key="h" class="chip--sm" icon="history" :label="h" data-track="Вы искали" @click="$emit('search', h)" /></div>
            </div>
            <div class="sugg__sec">
                <h4>Виды</h4>
                <div class="sugg__chips"><UiChip v-for="k in kinds" :key="k.key" class="chip--sm" :label="k.key" :count="k.count" @click="$emit('kind', k.key)" /></div>
            </div>
        </template>
        <div v-else-if="!hits.length" class="sugg__none">Ничего не нашли по «{{ q.trim() }}»</div>
        <template v-else>
            <div class="sugg__sec">
                <button v-for="p in hits" :key="p._id" type="button" class="sugg__p" data-track="Товар из подсказки" @click="$emit('product', p)">
                    <UiCover :product="p" size="xs" />
                    <span class="sugg__n"
                        ><template v-for="(part, i) in marked(p.name)" :key="i"
                            ><mark v-if="i % 2">{{ part }}</mark
                            ><template v-else>{{ part }}</template></template
                        ><small>{{ note(p) }}</small></span
                    >
                    <b>{{ money(p.price) }}</b>
                </button>
            </div>
            <button type="button" class="sugg__all" @click="$emit('search', q)"><UiIcon name="search" :size="18" />Все результаты по «{{ q.trim() }}»</button>
        </template>
    </div>
</template>
