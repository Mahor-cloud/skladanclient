<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { COVERS, kindCover } from "@/domain/covers"
import { money, pcs, plural } from "@/domain/format"
import axiosInstance from "@/service/axios"
import { useKindCovers, useProducts } from "@/service/queries"
import { toast, UiBtn, UiCover, UiField, UiIcon, UiSheet } from "@/ui"
import { useQueryClient } from "@tanstack/vue-query"
import { computed, ref } from "vue"

// Вид товара (вход — из формы товара): название и тип обложки — сетка мини-обложек с живым предпросмотром карточки.
// Событие done(название, тип обложки) — вид сохранён (название могло смениться).
// local: { products, covers } — вид шаблона «Семена»: товары и обложки берутся отсюда, сервер не трогается, правку применяет родитель.
const props = defineProps({ kind: { type: String, required: true }, local: { type: Object, default: null } })
const emit = defineEmits(["done", "close"])
const queryClient = useQueryClient()
const products = props.local ? computed(() => props.local.products) : useProducts().data
const covers = props.local ? computed(() => props.local.covers) : useKindCovers().data

const inKind = computed(() => (products.value || []).filter((p) => p.category === props.kind))
const n = inKind.value.length
// Вид, только что вписанный в форму, ещё не сохранён: у него есть только обложка.
const known = n > 0
const sample = inKind.value[0] || { _id: "kind-" + props.kind, name: props.kind, category: props.kind, price: 100, quantity: 12 }
const name = ref(props.kind)
const cur = ref(kindCover(props.kind, covers.value))
const why = n ? `В виде ${n} ${plural(n, ["товар", "товара", "товаров"])}` : ""
const saving = ref(false)

async function save(close) {
    const next = name.value.trim()
    if (!next) return toast({ type: "warning", title: "Введите название вида" })
    const renamed = known && next !== props.kind
    if (renamed && (products.value || []).some((p) => p.category !== props.kind && p.category?.toLowerCase() === next.toLowerCase())) return toast({ type: "warning", title: "Такой вид уже есть" })
    if (props.local) {
        emit("done", next, cur.value)
        return close("ok")
    }
    saving.value = true
    try {
        if (renamed) await axiosInstance.put("/products/kinds/rename", { from: props.kind, to: next })
        await axiosInstance.put("/products/kinds/cover", { category: next, cover: cur.value })
        queryClient.invalidateQueries({ queryKey: ["product-kinds"] })
        queryClient.invalidateQueries({ queryKey: ["products"] })
        toast({ type: "success", title: renamed ? "Вид переименован" : "Обложка вида сохранена", text: `«${next}» — ${COVERS[cur.value].label.toLowerCase()}`, timeout: 2400 })
        emit("done", next, cur.value)
        close("ok")
    } catch (err) {
        const payload = err?.response?.data
        toast({ type: "error", title: payload?.code === "ACTIVE_INVENTORY" ? "Изменение товаров запрещено" : "Не удалось сохранить вид", text: [].concat(payload?.message || err.message || []).join(". "), timeout: 7000 })
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <UiSheet :title="`Вид «${kind}»`" size="lg" cls="ov--kc" @close="$emit('close')">
        <div class="kc">
            <UiField v-if="known" v-model="name" label="Название вида" maxlength="40" required autocomplete="off" />
            <div class="kc__pv">
                <article class="pcard kc__card">
                    <span class="pcard__cover"><UiCover :product="sample" :type="cur" :photo="null" /></span>
                    <div class="pcard__body">
                        <span class="price">{{ money(sample.price) }}</span
                        ><span class="pcard__name">{{ sample.name }}</span
                        ><span class="stock">В наличии {{ pcs(Math.max(1, sample.quantity || 12)) }}</span>
                    </div>
                </article>
                <p class="kc__note">
                    <b>{{ COVERS[cur].label }}</b>
                </p>
            </div>
            <div class="kc__grid" role="group" aria-label="Тип обложки">
                <button v-for="(t, id) in COVERS" :key="id" type="button" class="kc__t" :class="{ 'is-on': id === cur }" :aria-pressed="id === cur" @click="cur = id">
                    <UiCover :product="sample" size="sm" :type="id" :photo="null" /><span>{{ t.label }}</span>
                </button>
            </div>
        </div>
        <template #footer="{ close }">
            <p v-if="why" class="foot-note"><UiIcon name="info" :size="16" class="inl" /> {{ why }}</p>
            <UiBtn v-if="known" label="Удалить" icon="trash" kind="danger-ghost" size="lg" disabled :title="why" />
            <UiBtn label="Отмена" kind="secondary" size="lg" @click="close()" />
            <UiBtn label="Сохранить" icon="check" size="lg" :loading="saving" @click="save(close)" />
        </template>
    </UiSheet>
</template>
