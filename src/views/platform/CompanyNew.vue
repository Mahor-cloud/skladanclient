<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { plural } from "@/domain/format"
import axiosInstance from "@/service/axios"
import { backTo, toast, UiBtn, UiCheck, UiField, UiSheet } from "@/ui"
import { useQueryClient } from "@tanstack/vue-query"
import { computed, reactive, ref } from "vue"
import { errText, useCompanies, useSeeds } from "./queries"

// Новая компания и её первый админ — окно по адресу /companies/new.
// Подсказка адреса — тем же правилом, что сервер (company.service slugify), чтобы показать адрес, который получится.
const TR = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya"
}
const slugify = (s) =>
    [...s.trim().toLowerCase()]
        .map((ch) => TR[ch] ?? ch)
        .join("")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-")
        .slice(0, 60)
const queryClient = useQueryClient()
const { data: companies } = useCompanies()
const { data: seeds } = useSeeds()
const f = reactive({ name: "", slug: "", login: "", pass: "", admin: "Председатель", roles: true, products: true })
const err = reactive({ slug: "", login: "", pass: "" })
const saving = ref(false)
const sheet = ref(null)
const seedCount = computed(() => seeds.value?.products?.length)

async function create() {
    const slug = f.slug.trim()
    err.login = f.login.trim().length < 3 ? "Логин — минимум 3 символа" : ""
    err.pass = f.pass.length < 4 ? "Пароль — минимум 4 символа" : ""
    err.slug = slug && (companies.value || []).some((c) => c.slug === slug) ? `Компания с адресом «${slug}» уже есть` : ""
    const bad = [err.slug, err.login, err.pass].filter(Boolean)
    if (bad.length) return toast({ type: "warning", title: "Проверьте поля", text: bad.join(". ") })

    saving.value = true
    let data
    try {
        data = (
            await axiosInstance.post("/companies/with-admin", {
                name: f.name.trim() || undefined,
                slug: slug || undefined,
                adminLogin: f.login.trim(),
                adminPassword: f.pass,
                adminName: f.admin.trim() || undefined,
                seedRoles: f.roles,
                seedProducts: f.products
            })
        ).data
    } catch (e) {
        return toast({ type: "error", title: "Ошибка", text: errText(e) })
    } finally {
        saving.value = false
    }
    queryClient.invalidateQueries({ queryKey: ["companies"] })
    toast({ type: "success", title: "Компания создана", text: `${data.company.name} (логин админа: ${data.admin.login})` })
    // Компания создана, а семена сервер применить не смог: seedReport = { error }.
    if (data.seedReport?.error) toast({ type: "error", title: "Семена не применены", text: data.seedReport.error })
    sheet.value.close("save")
}
</script>

<template>
    <UiSheet ref="sheet" title="Новая компания" size="md" @close="backTo({ name: 'companies' })">
        <form class="pform" novalidate @submit.prevent="create">
            <UiField v-model="f.name" label="Название местности" name="name" autocomplete="off" maxlength="120" />
            <UiField
                v-model="f.slug"
                label="Адрес (slug)"
                name="slug"
                prefix="/"
                :placeholder="slugify(f.name) || 'nazvanie-latinicey'"
                :error="err.slug"
                autocapitalize="none"
                spellcheck="false"
                autocomplete="off"
                maxlength="60"
                @input="err.slug = ''"
            />
            <h4 class="formsec">Главный админ</h4>
            <div class="pform__row pform__row--stack">
                <UiField v-model="f.login" label="Логин админа" name="login" required :error="err.login" placeholder="admin_zavolzhye" autocapitalize="none" spellcheck="false" autocomplete="off" maxlength="60" @input="err.login = ''" />
                <UiField v-model="f.pass" label="Пароль" name="pass" required :error="err.pass" placeholder="Не меньше 4 символов" autocomplete="new-password" maxlength="120" @input="err.pass = ''" />
            </div>
            <UiField v-model="f.admin" label="Имя" name="admin" maxlength="120" />
            <h4 class="formsec">Засеять данные из «Семян»</h4>
            <UiCheck v-model="f.roles" label="Создать роли" />
            <UiCheck v-model="f.products" label="Заполнить склад наименованиями" :hint="seedCount != null ? `${seedCount} ${plural(seedCount, ['товар', 'товара', 'товаров'])} с ценами, остатки 0` : ''" />
            <p class="muted" style="font-size: var(--fs-13)">Шаблоны редактируются в разделе «Семена». Если галочка снята — эти данные не создаются.</p>
        </form>
        <template #footer="{ close }">
            <UiBtn label="Отмена" kind="secondary" size="lg" @click="close()" />
            <UiBtn label="Создать" icon="check" size="lg" :loading="saving" @click="create" />
        </template>
    </UiSheet>
</template>
