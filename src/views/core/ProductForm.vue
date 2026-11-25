<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { photoUrl } from "@/domain/covers"
import { physical } from "@/domain/stock"
import axiosInstance from "@/service/axios"
import { useInventoryLock, useLitnaCatalog, useProducts } from "@/service/queries"
import { backTo, confirm, toast, UiBanner, UiBtn, UiChip, UiField, UiSheet } from "@/ui"
import { useQuery, useQueryClient } from "@tanstack/vue-query"
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue"
import { useRouter } from "vue-router"
import { litnaStart } from "@/views/purchases/litna"
import LitnaField from "@/views/purchases/LitnaField.vue"
import LitnaSiteSheet from "@/views/purchases/LitnaSiteSheet.vue"
import { sitePhoto } from "./photo"
import CoverEdit from "./CoverEdit.vue"
import KindSheet from "./KindSheet.vue"

// Карточка товара: создание (маршрут product-new) и правка (product-edit) — окно поверх каталога.
const props = defineProps({ id: { type: String, default: "" } })
const router = useRouter()
const queryClient = useQueryClient()
const { can, isSys, isStaff } = useSession()
const { data: products } = useProducts()
const { open: inventory } = useInventoryLock()

const isNew = !props.id
const product = computed(() => (products.value || []).find((p) => p._id === props.id))
const allowed = computed(() => isStaff.value && can("edit_products") && (!isNew || can("create_product")))
const toCatalog = () => backTo({ name: "catalog" })
// Адрес формы открыли без права или товара уже нет — возвращаемся в каталог.
watch(
    () => [allowed.value, products.value, product.value],
    () => {
        if (!allowed.value || (!isNew && products.value && !product.value)) router.replace({ name: "catalog" })
    },
    { immediate: true }
)

const d = reactive({ name: "", price: "", category: "", targetQty: 0, color: "" })
const photo = reactive({ blob: null, url: "", removed: false }) // новое фото до сохранения
const err = reactive({})
const dirty = ref(false)
const saving = ref(false)
// Товар приходит из общего списка: форма заполняется один раз, дальнейшие обновления списка её не перетирают.
watch(
    product,
    (p) => {
        if (p && !dirty.value) Object.assign(d, { name: p.name, price: String(p.price ?? ""), category: p.category || "", targetQty: p.targetQty || 0, color: p.coverColor || "" })
    },
    { immediate: true }
)
const touch = (key) => {
    dirty.value = true
    delete err[key]
}
const digits = (v) => String(v).replace(/\D/g, "")

/* ---------- Товар на lit-na.ru: видит тот, кому видна вкладка аккаунта (право создавать или вести закупки) ---------- */
const litnaOn = computed(() => can("create_purchases") || can("edit_purchases"))
const { data: litCat } = useLitnaCatalog({ on: litnaOn })
const lit = reactive({ id: undefined, guess: false, touched: false })
watch(
    [product, litCat],
    ([p, c]) => {
        if (!lit.touched) Object.assign(lit, litnaStart(p?.litnaId, c?.suggest?.[props.id]))
    },
    { immediate: true }
)
const litSite = computed(() => (lit.id == null ? null : (litCat.value?.items || []).find((s) => String(s.id) === String(lit.id))))
function setLit(v) {
    Object.assign(lit, { id: v, guess: false, touched: true })
    dirty.value = true
}
// Новый товар из каталога сайта: название, цена сайта, вид (если пуст), привязка и фото — сразу кадром по умолчанию.
const adding = ref(false)
const fetching = ref(false)
async function addFromSite(id) {
    const s = (litCat.value?.items || []).find((x) => String(x.id) === String(id))
    if (!s) return
    // Цена сайта как есть, без округления — как при засеве местности из lit-na.ru.
    Object.assign(d, { name: s.name, price: String(s.price ?? "") })
    if (!d.category.trim() && s.category) d.category = s.category
    setLit(s.id)
    for (const k of Object.keys(err)) delete err[k]
    if (!s.image) return
    fetching.value = true
    const blob = await sitePhoto(s.id)
    fetching.value = false
    if (blob) setPhoto(blob)
    else toast({ type: "warning", title: "Фото с lit-na.ru не загрузилось" })
}

const kinds = computed(() => [...new Set((products.value || []).map((p) => p.category).filter(Boolean))])
const serverPhoto = computed(() => (photo.removed ? null : photoUrl(product.value)))
// Фото товара в предпросмотре: новое → загруженное; без него CoverEdit покажет обложку из набора или рисунок.
const shown = computed(() => photo.url || serverPhoto.value || undefined)

/* ---------- Фото: готовый кадр от CoverEdit уходит на сервер при сохранении ---------- */
function setPhoto(blob) {
    if (photo.url) URL.revokeObjectURL(photo.url)
    Object.assign(photo, { blob, url: URL.createObjectURL(blob), removed: false })
    dirty.value = true
    toast({ type: "success", title: "Фото готово", timeout: 2400 })
}
function removePhoto() {
    if (photo.url) URL.revokeObjectURL(photo.url)
    Object.assign(photo, { blob: null, url: "", removed: true })
    dirty.value = true
}
onBeforeUnmount(() => photo.url && URL.revokeObjectURL(photo.url))

/* ---------- Вид: название и обложка ---------- */
const kindOpen = ref(false)
function kindDone(name) {
    if (name !== d.category) d.category = name
}

/* ---------- Цели представителей (сводка складов) ---------- */
const { data: summary } = useQuery({ queryKey: ["cabinet-summary"], queryFn: async () => (await axiosInstance.get("/cabinet/summary")).data, staleTime: 60_000, enabled: computed(() => !isNew && can("view_cabinet_summary")) })
const goals = computed(() => (summary.value ? summary.value.find((r) => String(r.productId) === props.id) || { totalBaseQty: 0, totalCurrentQty: 0, usersCount: 0 } : null))

/* ---------- Сохранение и удаление ---------- */
// Заголовок — что не удалось, текст — ответ сервера (квота фото местности, товар удалён, инвентаризация…).
const failed = (e, title) => {
    const payload = e?.response?.data
    toast({ type: "error", title: payload?.code === "ACTIVE_INVENTORY" ? "Изменение товаров запрещено" : title, text: [].concat(payload?.message || e?.message || []).join(". "), timeout: 7000 })
}
const sheet = ref(null)
function done() {
    dirty.value = false
    sheet.value.close("save")
}
async function save() {
    for (const k of Object.keys(err)) delete err[k]
    const name = d.name.trim()
    if (!name) err.name = "Введите название товара"
    else if ((products.value || []).some((x) => x._id !== props.id && x.name.trim().toLowerCase() === name.toLowerCase())) err.name = "Товар с таким названием уже есть"
    if (!Number(d.price)) err.price = "Введите цену"
    if (!d.category.trim()) err.category = "Выберите или впишите вид"
    if (Object.keys(err).length) return toast({ type: "warning", title: "Проверьте поля", text: Object.values(err).join(". ") })

    const payload = { name, category: d.category.trim(), price: Number(d.price), targetQty: Number(d.targetQty) || 0, coverColor: d.color || null }
    // Подсказка сайта уходит вместе с сохранением — так она подтверждается.
    if (litnaOn.value && lit.id !== undefined) payload.litnaId = lit.id
    // Правка шлёт только изменённые поля: один цвет сервер считает косметикой (без истории, push и запрета при инвентаризации).
    if (!isNew) {
        const p = product.value
        const was = { name: p.name, category: p.category || "", price: p.price, targetQty: p.targetQty || 0, coverColor: p.coverColor || null, litnaId: p.litnaId }
        for (const k of Object.keys(payload)) if (payload[k] === was[k]) delete payload[k]
    }
    const photoChanged = !!photo.blob || (photo.removed && !!product.value?.photo)
    if (!isNew && !Object.keys(payload).length && !photoChanged) return done()
    if (inventory.value && Object.keys(payload).some((k) => k !== "coverColor" && k !== "litnaId")) return toast({ type: "error", title: "Изменение товаров запрещено", text: "Идёт инвентаризация" })

    saving.value = true
    let saved = product.value
    try {
        if (isNew) saved = (await axiosInstance.post("/products", { ...payload, quantity: 0 })).data
        else if (Object.keys(payload).length) saved = (await axiosInstance.put(`/products/${props.id}`, payload)).data
    } catch (e) {
        saving.value = false
        return failed(e, "Не удалось сохранить товар")
    }
    // Товар сохранён; фото — отдельным запросом: его неудача не отменяет сохранение.
    let photoFailed = false
    try {
        if (photo.blob) {
            const form = new FormData()
            form.append("file", photo.blob, "cover.webp")
            // Заголовок обязателен: у axiosInstance по умолчанию JSON, и без него FormData уйдёт как JSON.
            await axiosInstance.put(`/products/${saved._id}/photo`, form, { headers: { "Content-Type": "multipart/form-data" } })
        } else if (photo.removed && product.value?.photo) await axiosInstance.delete(`/products/${saved._id}/photo`)
    } catch (e) {
        photoFailed = true
        failed(e, "Не удалось сохранить фото")
    }
    saving.value = false
    queryClient.invalidateQueries({ queryKey: ["products"] })
    queryClient.invalidateQueries({ queryKey: ["product", saved._id] })
    // Правка остаётся открытой: «Сохранить» ещё раз отправит только фото — поля уже совпадут с сохранёнными.
    if (photoFailed && !isNew) return
    toast(isNew ? { type: "success", title: "Товар добавлен", text: `«${name}» уже в каталоге` } : { type: "success", title: "Сохранено", text: `«${name}» обновлён` })
    done()
}
async function remove() {
    if (inventory.value) return toast({ type: "error", title: "Изменение товаров запрещено", text: "Идёт инвентаризация" })
    const name = product.value.name
    if (!(await confirm({ title: `Удалить «${name}»?`, ok: "Удалить товар", tone: "danger" }))) return
    try {
        await axiosInstance.delete(`/products/${props.id}`)
    } catch (e) {
        return failed(e, "Не удалось удалить товар")
    }
    queryClient.invalidateQueries({ queryKey: ["products"] })
    toast({ type: "info", title: "Товар удалён", text: name })
    done()
}
const beforeClose = async () => !dirty.value || !!(await confirm({ title: "Закрыть без сохранения?", ok: "Закрыть", cancel: "Остаться", tone: "danger" }))
</script>

<template>
    <UiSheet v-if="allowed && (isNew || product)" ref="sheet" :title="isNew ? 'Новый товар' : 'Изменить товар'" :sub="isNew ? '' : product.name" size="lg" :before-close="beforeClose" @close="toCatalog">
        <form class="pform" novalidate @submit.prevent="save">
            <UiBtn v-if="isNew && litnaOn" label="Из lit-na.ru" icon="globe" kind="secondary" block :loading="fetching" @click="adding = true" />
            <CoverEdit
                :id="props.id"
                :name="d.name"
                :category="d.category"
                :price="d.price"
                :photo="shown"
                :color="d.color"
                :litna="litSite?.image ? litSite.id : null"
                @update:color="(d.color = $event), (dirty = true)"
                @photo="setPhoto"
                @remove="removePhoto"
                @kind="kindOpen = true"
            />
            <UiBanner v-if="inventory" tone="warning" title="Идёт инвентаризация" text="Изменение товаров запрещено" />
            <UiField :model-value="d.name" label="Название" name="name" :error="err.name" required autocomplete="off" maxlength="120" @update:model-value="(d.name = $event), touch('name')" />
            <div class="pform__row">
                <UiField :model-value="d.price" label="Цена" name="price" inputmode="numeric" suffix="₽" :error="err.price" required @update:model-value="(d.price = digits($event)), touch('price')" />
                <UiField :model-value="isNew ? '0' : String(physical(product))" label="Остаток" readonly hint="Меняют заказы, закупки и инвентаризация" tabindex="-1" />
            </div>
            <LitnaField v-if="litnaOn" :model-value="lit.id" :guess="lit.guess" :items="litCat?.items || []" :title="d.name" @update:model-value="setLit" />
            <div class="field">
                <span class="field__label">Вид <span class="req">*</span></span>
                <div class="kinds" role="group" aria-label="Вид"><UiChip v-for="k in kinds" :key="k" class="chip--sm" :label="k" :active="d.category === k" @click="(d.category = k), touch('category')" /></div>
                <UiField :model-value="d.category" name="category" placeholder="или впишите свой вид" :error="err.category" list="kinds-list" aria-label="Свой вид" maxlength="200" @update:model-value="(d.category = $event), touch('category')" />
                <datalist id="kinds-list"><option v-for="k in kinds" :key="k" :value="k"></option></datalist>
            </div>
            <UiField
                :model-value="d.targetQty"
                label="Цель закупки"
                name="targetQty"
                inputmode="numeric"
                suffix="шт."
                :readonly="!isSys"
                :hint="isSys ? 'Если 0 — нет ограничения. Больше цели в закупке — только с правом подтверждать превышение' : 'Цель закупки задаёт только главный администратор компании'"
                @update:model-value="(d.targetQty = digits($event)), touch('targetQty')"
            />
            <div v-if="goals" class="goals">
                <h4>Цели представителей</h4>
                <div>
                    <small>Суммарная цель</small><b>{{ goals.totalBaseQty }}</b>
                </div>
                <div>
                    <small>Сейчас у групп</small><b>{{ goals.totalCurrentQty }}</b>
                </div>
                <div>
                    <small>Групп с товаром</small><b>{{ goals.usersCount }}</b>
                </div>
            </div>
        </form>
        <template #footer="{ close }">
            <UiBtn v-if="!isNew && can('delete_products')" label="Удалить" icon="trash" kind="danger-ghost" size="lg" @click="remove" />
            <UiBtn label="Отмена" kind="secondary" size="lg" @click="close()" />
            <UiBtn :label="isNew ? 'Добавить' : 'Сохранить'" icon="check" size="lg" :loading="saving" @click="save" />
        </template>
    </UiSheet>
    <KindSheet v-if="kindOpen" :kind="d.category.trim()" @done="kindDone" @close="kindOpen = false" />
    <LitnaSiteSheet v-if="adding" title="Из lit-na.ru" :items="litCat?.items || []" :none="false" @pick="addFromSite" @close="adding = false" />
</template>
