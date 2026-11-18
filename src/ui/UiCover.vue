<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { coverColor, coverSVG, photoUrl, stockCover } from "@/domain/covers"
import { computed, inject, ref, watch } from "vue"
import { KIND_COVERS } from "./keys"

// Обложка товара. size: xs 36 · sm 48 · md (карточка) · lg (лист товара). Загруженное фото важнее настоящей обложки из набора,
// та — важнее рисунка по типу вида и цвету товара. type / color / photo — принудительно (предпросмотр в форме товара и окне вида):
// photo = null — только рисунок, photo = строка — эта картинка.
const props = defineProps({
    product: { type: Object, required: true },
    size: { type: String, default: "md" },
    type: { type: String, default: "" },
    color: { type: String, default: "" },
    photo: { type: String, default: undefined },
    eager: Boolean
})
const kindCovers = inject(KIND_COVERS, ref({}))
const opts = computed(() => ({ kindCovers: kindCovers.value, type: props.type, color: props.color }))
const own = computed(() => (props.photo !== undefined ? props.photo : photoUrl(props.product)))
const stock = computed(() => (props.photo === undefined && !own.value ? stockCover(props.product) : null))
const src = computed(() => own.value || stock.value)
const loaded = ref(false)
const failed = ref(false)
watch(src, () => {
    loaded.value = false
    failed.value = false
})
</script>

<template>
    <span v-if="src && !failed" class="cover cover--photo" :class="['cover--' + size, { 'cover--stock': stock, 'is-loaded': loaded }]" :style="{ '--cat': coverColor(product, opts) }" data-cover>
        <img :src="src" :alt="product.name || ''" width="360" height="420" :loading="eager ? 'eager' : 'lazy'" decoding="async" draggable="false" @load="loaded = true" @error="failed = true" />
    </span>
    <span v-else class="cover" :class="'cover--' + size" :style="{ '--cat': coverColor(product, opts) }" data-cover v-html="coverSVG(product, opts)"></span>
</template>
