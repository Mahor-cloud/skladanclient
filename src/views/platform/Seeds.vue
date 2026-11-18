<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { money, plural } from "@/domain/format"
import { ALL, PERMS } from "@/domain/perms"
import axiosInstance from "@/service/axios"
import { toast, UiBanner, UiBtn, UiCheck, UiCover, UiEmpty, UiError, UiField, UiIcon, UiIconBtn, UiLazy, UiPage, UiSheet, UiSkPage } from "@/ui"
import { KIND_COVERS } from "@/ui/keys"
import CoverEdit from "@/views/core/CoverEdit.vue"
import KindSheet from "@/views/core/KindSheet.vue"
import { useQueryClient } from "@tanstack/vue-query"
import { computed, nextTick, provide, reactive, ref, watch } from "vue"
import { useRoute } from "vue-router"
import { errText, useSeeds } from "./queries"

// Шаблон ролей и товаров для новых компаний. Правки живут здесь до «Сохранить шаблон»; новый ответ сервера не перетирает несохранённую часть.
const route = useRoute()
const queryClient = useQueryClient()
const { data, isPending, isError, refetch } = useSeeds()
const roles = ref([])
const products = ref([])
// Типы обложек видов шаблона ({ [вид]: тип }) — сохраняются вместе с товарами; обложки на этой странице рисуются по ним.
const covers = ref({})
provide(KIND_COVERS, covers)
const dirty = reactive({ roles: false, products: false })
let seq = 0
watch(
    data,
    (val) => {
        if (!val) return
        if (!dirty.roles) roles.value = (val.roles || []).map((r) => ({ name: r.name, permissions: [...(r.permissions || [])] }))
        if (dirty.products) return
        products.value = (val.products || []).map((p) => ({ _id: ++seq, name: p.name, category: p.category || "", price: Number(p.price) || 0, targetQty: Number(p.targetQty) || 0, coverColor: p.coverColor || "", photo: p.photo || "" }))
        covers.value = Object.fromEntries((val.kindCovers || []).map((k) => [k.category, k.cover]))
    },
    { immediate: true }
)
const isDirty = computed(() => dirty.roles || dirty.products)
const tab = computed(() => (route.query.tab === "products" ? "products" : "roles"))
const tabs = computed(() => [
    { id: "roles", label: "Роли", icon: "shield", count: roles.value.length },
    { id: "products", label: "Товары", icon: "grid", count: products.value.length }
])
const tabTo = (id) => ({ name: "seeds", query: { ...route.query, tab: id === "products" ? "products" : undefined } })

/* ---------- Роли ---------- */
const open = ref(0)
const nameField = ref([])
const PERM_CODES = new Set(ALL)
const permCount = (r) => r.permissions.filter((p) => PERM_CODES.has(p)).length
function setPerm(r, code, on) {
    r.permissions = on ? [...new Set([...r.permissions, code])] : r.permissions.filter((p) => p !== code)
    dirty.roles = true
}
function setName(r, v) {
    r.name = v
    dirty.roles = true
}
function addRole() {
    roles.value.push({ name: "", permissions: [] })
    open.value = roles.value.length - 1
    dirty.roles = true
    nextTick(() => nameField.value[0]?.focus())
}
function removeRole(i) {
    roles.value.splice(i, 1)
    open.value = null
    dirty.roles = true
}

/* ---------- Товары ---------- */
const q = ref("")
const shown = computed(() => {
    const s = q.value.trim().toLowerCase()
    return s ? products.value.filter((p) => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s)) : products.value
})
const kinds = computed(() => [...new Set(products.value.map((p) => p.category).filter(Boolean))])
// Фото шаблона лежат отдельно от фото местностей — у них свой адрес; undefined — фото нет, UiCover берёт обложку из набора или рисунок.
const seedPhoto = (p) => (p.photo ? `/api/seeds/photo/${p.photo}` : undefined)
const ed = ref(null)
const edSheet = ref(null)
const kindOpen = ref(false)
const uploading = ref(false)
function edit(item) {
    ed.value = { item, name: item?.name || "", category: item?.category || "", price: item ? String(item.price) : "", coverColor: item?.coverColor || "", photo: item?.photo || "", err: "" }
}
// Кадр уходит на сервер сразу, в товар попадает его ключ; не вошедшие в сохранённый шаблон фото сервер убирает сам.
async function setPhoto(blob) {
    const target = ed.value // окно могут закрыть или открыть другой товар раньше ответа: ключ пишется в тот товар, чьё фото
    const form = new FormData()
    form.append("file", blob, "cover.webp")
    uploading.value = true
    try {
        // Заголовок обязателен: у axiosInstance по умолчанию JSON, и без него FormData уйдёт как JSON.
        target.photo = (await axiosInstance.put("/seeds/photo", form, { headers: { "Content-Type": "multipart/form-data" } })).data.token
        if (ed.value === target) toast({ type: "success", title: "Фото готово", timeout: 2400 })
    } catch (e) {
        toast({ type: "error", title: "Не удалось сохранить фото", text: errText(e), timeout: 7000 })
    } finally {
        uploading.value = false
    }
}
// Вид в шаблоне: новое название получают все его товары, обложка вида — запись в covers.
function kindDone(name, cover) {
    const from = ed.value.category.trim()
    const next = { ...covers.value, [name]: cover }
    if (name !== from) {
        for (const p of products.value) if (p.category === from) p.category = name
        delete next[from]
    }
    covers.value = next
    ed.value.category = name
    dirty.products = true
}
function applyEdit() {
    if (uploading.value) return
    const e = ed.value
    const name = e.name.trim()
    e.err = !name ? "Введите название товара" : products.value.some((p) => p !== e.item && p.name.trim() === name) ? "Товар с таким названием уже есть" : ""
    if (e.err) return
    const next = { name, category: e.category.trim(), price: Number(e.price) || 0, coverColor: e.coverColor, photo: e.photo }
    if (e.item) Object.assign(e.item, next)
    else products.value.unshift({ _id: ++seq, targetQty: 0, ...next })
    dirty.products = true
    edSheet.value.close("save")
}
function removeProduct() {
    products.value.splice(products.value.indexOf(ed.value.item), 1)
    dirty.products = true
    edSheet.value.close("save")
}

/* ---------- Сохранение: роли и товары — разными запросами, как раньше ---------- */
const saving = ref(false)
async function save() {
    if (!isDirty.value) return toast({ type: "info", title: "Изменений нет" })
    saving.value = true
    try {
        if (dirty.roles) {
            await axiosInstance.put("/seeds/roles", { roles: roles.value })
            dirty.roles = false
        }
        if (dirty.products) {
            await axiosInstance.put("/seeds/products", {
                products: products.value.map(({ name, category, price, targetQty, coverColor, photo }) => ({ name, category, price, targetQty, coverColor, photo })),
                kindCovers: Object.entries(covers.value).map(([category, cover]) => ({ category, cover }))
            })
            dirty.products = false
        }
        toast({ type: "success", title: "Шаблон сохранён" })
    } catch (e) {
        toast({ type: "error", title: "Ошибка", text: errText(e) })
    } finally {
        saving.value = false
        queryClient.invalidateQueries({ queryKey: ["seeds"] })
    }
}
</script>

<template>
    <UiPage v-if="isError && !data" title="Семена">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Семена»" @retry="refetch()" /></div>
    </UiPage>
    <UiSkPage v-else-if="isPending" title="Семена" />
    <UiPage v-else title="Семена">
        <template #actions><UiIconBtn icon="check" label="Сохранить шаблон" :kind="isDirty ? 'primary' : 'soft'" @click="save" /></template>
        <template #deskActions><UiBtn :label="isDirty ? 'Сохранить шаблон' : 'Шаблон сохранён'" icon="check" :disabled="!isDirty" :loading="saving" @click="save" /></template>

        <nav class="ptabs" aria-label="Разделы страницы">
            <RouterLink v-for="t in tabs" :key="t.id" class="ptab" :class="{ 'is-on': tab === t.id }" :to="tabTo(t.id)" :aria-current="tab === t.id ? 'page' : null" replace>
                <UiIcon :name="t.icon" :size="18" /><span>{{ t.label }}</span
                ><b>{{ t.count }}</b>
            </RouterLink>
        </nav>
        <div v-if="isDirty" style="margin-bottom: var(--sp-5)"><UiBanner tone="warning" icon="edit" title="Шаблон изменён" /></div>

        <template v-if="tab === 'roles'">
            <div class="seeds">
                <article v-for="(r, i) in roles" :key="i" class="card seedr" :class="{ 'is-open': open === i }">
                    <button type="button" class="seedr__h" :aria-expanded="open === i" @click="open = open === i ? null : i">
                        <span class="rcard__i"><UiIcon name="users" /></span><b>{{ r.name || "Новая роль" }}</b
                        ><span class="muted">{{ permCount(r) }} {{ plural(permCount(r), ["право", "права", "прав"]) }}</span
                        ><UiIcon name="down" class="grp__chev" />
                    </button>
                    <div v-if="open === i" class="seedr__b">
                        <div class="pform__row pform__row--stack" style="grid-column: 1 / -1; align-items: end">
                            <UiField ref="nameField" :model-value="r.name" label="Название роли" placeholder="Название роли" autocomplete="off" maxlength="60" @update:model-value="setName(r, $event)" />
                            <UiBtn label="Удалить роль" icon="trash" kind="danger-ghost" @click="removeRole(i)" />
                        </div>
                        <div v-for="[title, , list] in PERMS" :key="title" class="seedg">
                            <h4>{{ title }}</h4>
                            <UiCheck v-for="[code, label] in list" :key="code" :model-value="r.permissions.includes(code)" :label="label" @update:model-value="setPerm(r, code, $event)" />
                        </div>
                    </div>
                </article>
            </div>
            <UiBtn label="Добавить роль" icon="plus" kind="secondary" style="margin-top: var(--sp-5)" @click="addRole" />
        </template>

        <template v-else>
            <div class="listtools">
                <span class="listtools__t" style="display: flex; align-items: center; gap: var(--sp-4); flex-wrap: wrap"
                    >{{ products.length }} {{ plural(products.length, ["товар", "товара", "товаров"]) }}<UiBtn label="Добавить товар" icon="plus" kind="secondary" size="sm" @click="edit(null)"
                /></span>
                <form class="msearch__f lsearch" role="search" @submit.prevent>
                    <UiIcon name="search" />
                    <input v-model="q" type="search" name="q" placeholder="Найти товар" aria-label="Найти товар" autocomplete="off" />
                    <button v-if="q" type="button" class="msearch__x" aria-label="Очистить поиск" @click="q = ''"><UiIcon name="x" :size="18" /></button>
                </form>
            </div>
            <div v-if="!shown.length" class="card"><UiEmpty art="search" :title="q ? 'Ничего не нашли' : 'Товаров нет'" /></div>
            <div v-else class="card tbl tbl--seed" style="--cols: 52px minmax(0, 3fr) minmax(0, 1.2fr) 110px">
                <div class="tbl__h" aria-hidden="true"><span></span><span>Товар</span><span>Категория</span><span>Цена</span></div>
                <UiLazy :items="shown" :size="40" :reset-key="q">
                    <template #default="{ item: p }">
                        <button type="button" class="trow" style="width: 100%; text-align: left" @click="edit(p)">
                            <span class="trow__cov"><UiCover :product="p" size="sm" :photo="seedPhoto(p)" /></span>
                            <span class="trow__main"
                                ><span class="trow__n">{{ p.name }}</span
                                ><span class="trow__m"
                                    ><span class="mob">{{ p.category }} · {{ money(p.price) }}</span></span
                                ></span
                            >
                            <span class="trow__c">{{ p.category }}</span>
                            <span class="trow__c">{{ money(p.price) }}</span>
                        </button>
                    </template>
                </UiLazy>
            </div>
        </template>
    </UiPage>

    <UiSheet v-if="ed" ref="edSheet" :title="ed.item ? 'Изменить товар' : 'Новый товар'" size="lg" @close="ed = null">
        <form class="pform" novalidate @submit.prevent="applyEdit">
            <CoverEdit
                :id="ed.item?._id"
                v-model:color="ed.coverColor"
                :name="ed.name"
                :category="ed.category"
                :price="ed.price"
                :photo="seedPhoto(ed)"
                @photo="setPhoto"
                @remove="ed.photo = ''"
                @kind="kindOpen = true"
            />
            <UiField v-model="ed.name" label="Название" name="name" required :error="ed.err" autocomplete="off" maxlength="120" @input="ed.err = ''" />
            <div class="pform__row">
                <UiField v-model="ed.category" label="Категория" name="category" list="seed-kinds" autocomplete="off" maxlength="200" />
                <UiField :model-value="ed.price" label="Цена" name="price" inputmode="numeric" suffix="₽" maxlength="7" @update:model-value="ed.price = $event.replace(/\D/g, '')" />
            </div>
            <datalist id="seed-kinds"><option v-for="k in kinds" :key="k" :value="k"></option></datalist>
        </form>
        <template #footer="{ close }">
            <UiBtn v-if="ed.item" label="Удалить" icon="trash" kind="danger-ghost" size="lg" @click="removeProduct" />
            <UiBtn label="Отмена" kind="secondary" size="lg" @click="close()" />
            <UiBtn label="Готово" icon="check" size="lg" :loading="uploading" @click="applyEdit" />
        </template>
    </UiSheet>
    <KindSheet v-if="kindOpen" :kind="ed.category.trim()" :local="{ products, covers }" @done="kindDone" @close="kindOpen = false" />
</template>
