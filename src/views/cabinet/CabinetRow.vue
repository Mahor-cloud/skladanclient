<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { money } from "@/domain/format"
import { available } from "@/domain/stock"
import { UiCover, UiIcon, UiIconBtn, UiStepper } from "@/ui"
import { computed, inject } from "vue"
import { CAB, rowKey } from "./cabinet"

// Строка «Моего склада». Своя компонента у каждой строки: нажатие «+» перерисовывает только её (значения — из общего словаря правок).
const props = defineProps({
    r: { type: Object, required: true },
    p: { type: Object, default: null }, // товар из каталога: обложка и «доступно»
    narrow: Boolean // рядом с корзиной справа: цена и остаток уходят в подпись
})
const { val, set, edit, remove } = inject(CAB)
const base = computed(() => val(props.r, "baseQty"))
const have = computed(() => val(props.r, "currentQty"))
const ord = computed(() => props.r.inOrderQty || 0)
const need = computed(() => Math.max(0, base.value - have.value - ord.value))
const stock = computed(() => (props.p ? available(props.p) : props.r.stockQty || 0))
const cov = computed(() => props.p || { _id: props.r.productId, name: props.r.productName, category: props.r.category })
</script>

<template>
    <div class="trow trow--cab" :class="{ 'is-need': need, 'is-own': r.isCustom }" :data-row="rowKey(r)">
        <span class="trow__cov">
            <span v-if="r.isCustom" class="cover cover--sm cover--own"><UiIcon name="tag" :size="22" /></span>
            <UiCover v-else :product="cov" size="sm" />
        </span>
        <div class="trow__main">
            <span class="trow__n">
                <button v-if="r.isCustom" type="button" class="linkbtn" @click="edit(r)">
                    <i>{{ r.productName }}</i> <span class="muted">(своя)</span>
                </button>
                <template v-else>{{ r.productName }}</template>
            </span>
            <span v-if="r.isCustom" class="trow__m">{{ r.price ? money(r.price) + " · справочно" : "без цены" }}{{ r.note ? " · " + r.note : "" }}</span>
            <span v-else class="trow__m"
                >{{ money(r.price) }}<span :class="{ mob: !narrow }"> · на складе {{ stock > 0 ? stock : "нет" }}{{ ord ? ` · в заказе ${ord}` : "" }}</span></span
            >
        </div>
        <template v-if="!narrow">
            <span class="trow__c">{{ r.price ? money(r.price) : "—" }}</span>
            <span class="trow__c"
                ><template v-if="r.isCustom">—</template><template v-else-if="stock > 0">{{ stock }}</template
                ><span v-else class="muted">нет</span></span
            >
        </template>
        <div class="trow__ctl">
            <div class="cstep">
                <small>Цель</small>
                <UiStepper :model-value="base" :trash="false" :label="`Цель: ${r.productName}`" @update:model-value="set(r, 'baseQty', $event)" />
            </div>
            <div class="cstep">
                <small>У меня</small>
                <UiStepper :model-value="have" :trash="false" :label="`У меня: ${r.productName}`" @update:model-value="set(r, 'currentQty', $event)" />
            </div>
        </div>
        <span v-if="!narrow" class="trow__c"
            ><span v-if="ord" class="tag tag--info">в заказе {{ ord }}</span
            ><span v-else class="muted">—</span></span
        >
        <span class="trow__c"
            ><span v-if="need" class="tag tag--warning">нужно {{ need }}</span
            ><span v-else-if="base" class="okmark"><UiIcon name="check" :size="16" />хватает</span></span
        >
        <span class="trow__side"
            ><span class="mob"
                ><span v-if="need" class="tag tag--warning">нужно {{ need }}</span
                ><span v-else-if="base" class="okmark"><UiIcon name="check" :size="16" />хватает</span></span
            ></span
        >
        <span class="trow__act"
            ><template v-if="r.isCustom"
                ><UiIconBtn icon="edit" label="Изменить свою позицию" kind="soft" :size="18" @click="edit(r)" /><UiIconBtn icon="trash" label="Удалить свою позицию" :size="18" class="ibtn--danger" @click="remove(r)" /></template
        ></span>
    </div>
</template>
