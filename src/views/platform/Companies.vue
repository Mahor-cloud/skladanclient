<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { date, plural } from "@/domain/format"
import { saveToStorage } from "@/service/auth/auth.helper"
import axiosInstance from "@/service/axios"
import { confirm, toast, UiAvatar, UiBtn, UiEmpty, UiError, UiField, UiIcon, UiIconBtn, UiPage, UiSheet, UiSk } from "@/ui"
import { useQueryClient } from "@tanstack/vue-query"
import { computed, reactive, ref } from "vue"
import { errText, useCompanies } from "./queries"

const queryClient = useQueryClient()
const { data: companies, isPending, isError, refetch } = useCompanies()
const list = computed(() => companies.value || [])
const sub = computed(() => `${list.value.length} ${plural(list.value.length, ["местность", "местности", "местностей"])} · ${list.value.filter((c) => c.isActive).length} активны`)
const mark = (co) => co.name.replace(/^Местность\s*/, "").slice(0, 1)

/* ---------- Пользователи компании: грузятся при первом раскрытии ---------- */
const open = ref(null)
const users = reactive({})
async function toggleUsers(co) {
    open.value = open.value === co._id ? null : co._id
    if (!open.value || users[co._id]) return
    try {
        // Председатель — первым; остальные в порядке сервера (сотрудники, затем по имени).
        users[co._id] = (await axiosInstance.get(`/companies/${co._id}/users`)).data.sort((a, b) => !!b.role?.isSystem - !!a.role?.isSystem)
    } catch (e) {
        open.value = null
        toast({ type: "error", title: "Ошибка", text: errText(e) })
    }
}

/* ---------- Отключить / включить ---------- */
const busy = ref(null)
async function setActive(co, on, undo = true) {
    busy.value = co._id
    try {
        if (on) await axiosInstance.put(`/companies/${co._id}/activate`)
        else await axiosInstance.delete(`/companies/${co._id}`)
    } catch (e) {
        return toast({ type: "error", title: "Ошибка", text: errText(e) })
    } finally {
        busy.value = null
        queryClient.invalidateQueries({ queryKey: ["companies"] })
    }
    const back = undo ? { label: "Вернуть", fn: () => setActive(co, !on, false) } : undefined
    toast(on ? { type: "success", title: "Компания включена", text: co.name, action: back } : { type: "warning", title: "Компания отключена", text: `Пользователи «${co.name}» вышли из системы`, action: back })
}

/* ---------- Войти под председателем: сессия супер-админа заменяется сессией админа ---------- */
async function loginAs(a, co) {
    if (!(await confirm({ title: "Войти под председателем?", text: "Сессия супер-админа завершится", ok: "Войти", okIcon: "logout" }))) return
    let data
    try {
        data = (await axiosInstance.post(`/companies/impersonate/${a._id}`)).data
    } catch (e) {
        return toast({ type: "error", title: "Ошибка входа", text: errText(e) })
    }
    queryClient.clear()
    localStorage.removeItem("cart")
    saveToStorage(data)
    toast({ type: "info", title: `Вход под ${data.user.name}`, text: co.name })
    // Полная перезагрузка, как раньше: каркас, меню и запросы собираются заново уже под админом.
    setTimeout(() => {
        window.location.href = window.location.origin + "/#/"
        window.location.reload()
    }, 400)
}

/* ---------- Пароль админа ---------- */
const pass = reactive({ admin: null, co: null, value: "", err: "", saving: false })
const passSheet = ref(null)
function openPass(a, co) {
    Object.assign(pass, { admin: a, co, value: "", err: "" })
}
async function changePass() {
    if (pass.value.length < 4) {
        pass.err = "Минимум 4 символа"
        return toast({ type: "warning", title: "Минимум 4 символа" })
    }
    pass.saving = true
    try {
        await axiosInstance.put(`/companies/admin/${pass.admin._id}/password`, { password: pass.value })
    } catch (e) {
        return toast({ type: "error", title: "Ошибка", text: errText(e) })
    } finally {
        pass.saving = false
    }
    toast({ type: "success", title: "Пароль изменён", text: "@" + pass.admin.login })
    passSheet.value.close("save")
}

/* ---------- Экспорт и импорт всей базы ---------- */
const exporting = ref(false)
const importing = ref(false)
async function exportDb() {
    exporting.value = true
    try {
        const { data } = await axiosInstance.get("/database/export")
        const name = `skladan-full-db-${new Date().toISOString().slice(0, 10)}.json`
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
        const a = document.createElement("a")
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast({ type: "success", title: "Экспорт всей БД готов", text: name })
    } catch (e) {
        toast({ type: "error", title: "Ошибка экспорта", text: errText(e) })
    } finally {
        exporting.value = false
    }
}
async function importDb(ev) {
    const file = ev.target.files?.[0]
    ev.target.value = ""
    if (!file) return
    const ok = await confirm({
        title: "Заменить всю базу всех местностей?",
        text: `Компании, пользователи, товары, заказы, закупки, инвентаризации и история всех местностей будут стёрты и заменены содержимым «${file.name}». Отменить импорт нельзя — сначала скачайте экспорт.`,
        ok: "Стереть и импортировать",
        okIcon: "install",
        tone: "danger"
    })
    if (!ok) return
    importing.value = true
    try {
        const fd = new FormData()
        fd.append("file", file)
        // Без этого параметра сервер полный импорт не выполняет.
        await axiosInstance.post("/database/import", fd, { params: { confirm: "i-know-what-i-am-doing" }, headers: { "Content-Type": "multipart/form-data" } })
        toast({ type: "success", title: "Импорт завершён", text: file.name })
        queryClient.invalidateQueries({ queryKey: ["companies"] })
    } catch (e) {
        toast({ type: "error", title: "Ошибка импорта", text: errText(e) })
    } finally {
        importing.value = false
    }
}
</script>

<template>
    <UiPage v-if="isError && !companies" title="Компании">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Компании»" @retry="refetch()" /></div>
    </UiPage>
    <UiPage v-else-if="isPending" title="Компании" sub="Загружаем…">
        <p class="loading-note" role="status"><span class="spin"></span>Загружаем компании…</p>
        <div class="cos">
            <div v-for="i in 3" :key="i" class="card co">
                <UiSk w="60%" :h="22" /><UiSk w="40%" :h="12" />
                <UiSk :h="44" :r="12" />
            </div>
        </div>
    </UiPage>
    <UiPage v-else title="Компании" :sub="sub">
        <template #actions><UiIconBtn icon="plus" label="Новая компания" kind="primary" :to="{ name: 'company-new' }" /></template>
        <template #deskActions>
            <UiBtn label="Экспорт всей БД" icon="download" kind="outline" :loading="exporting" @click="exportDb" />
            <label class="btn btn--outline btn--md"
                ><span v-if="importing" class="spin" aria-hidden="true"></span><UiIcon v-else name="install" /><span class="btn__l">Импорт всей БД</span
                ><input type="file" class="sr" accept="application/json,.json" :disabled="importing" @change="importDb"
            /></label>
            <UiBtn label="Новая компания" icon="plus" :to="{ name: 'company-new' }" />
        </template>

        <div v-if="!list.length" class="card"><UiEmpty art="box" title="Компаний пока нет" /></div>
        <div v-else class="cos">
            <article v-for="co in list" :key="co._id" class="card co" :class="{ 'co--off': !co.isActive }">
                <div class="co__top">
                    <span class="co__mark" :style="{ '--av': co.isActive ? 'var(--primary)' : 'var(--text-3)' }">{{ mark(co) }}</span>
                    <div class="co__t">
                        <h3>{{ co.name }}</h3>
                        <small
                            ><span v-if="co.isActive" class="tag tag--success"><UiIcon name="check" :size="14" />Активна</span><span v-else class="tag tag--neutral"><UiIcon name="lock" :size="14" />Отключена</span
                            ><span class="mono">{{ co.slug }}</span> · {{ date(co.createdAt) }}</small
                        >
                    </div>
                    <UiIconBtn icon="trash" label="Удалить компанию полностью" kind="danger" :to="{ name: 'company-delete', params: { id: co._id } }" />
                </div>
                <div class="co__acts">
                    <UiBtn :label="open === co._id ? 'Скрыть людей' : 'Пользователи'" :icon="open === co._id ? 'down' : 'users'" kind="secondary" :aria-expanded="open === co._id" @click="toggleUsers(co)" />
                    <UiBtn :label="co.isActive ? 'Отключить' : 'Включить'" :icon="co.isActive ? 'lock' : 'check'" :kind="co.isActive ? 'outline' : 'success'" :loading="busy === co._id" @click="setActive(co, !co.isActive)" />
                </div>
                <div v-if="open === co._id" class="co__users">
                    <h4>Пользователи компании</h4>
                    <p v-if="!users[co._id]" class="loading-note" role="status"><span class="spin"></span>Загрузка...</p>
                    <p v-else-if="!users[co._id].length" class="muted">Нет пользователей.</p>
                    <div v-for="a in users[co._id]" v-else :key="a._id" class="co__u">
                        <UiAvatar :user="a" />
                        <span
                            ><b>{{ a.name }}</b
                            ><small
                                ><span class="mono">@{{ a.login }}</span> · <span v-if="a.role?.isSystem" class="tag tag--info">ADMIN</span><template v-else>{{ a.role?.name || "—" }}</template></small
                            ></span
                        >
                        <!-- Вход и смена пароля — только у председателя, как раньше: сервер под остальными входить не даёт -->
                        <span v-if="a.role?.isSystem" class="co__ua">
                            <UiBtn label="Войти под ним" icon="logout" kind="secondary" size="sm" @click="loginAs(a, co)" />
                            <UiBtn label="Пароль" icon="lock" kind="ghost" size="sm" @click="openPass(a, co)" />
                        </span>
                    </div>
                </div>
            </article>
        </div>
        <div class="mobonly cos__db" style="flex-direction: column; gap: var(--sp-3)">
            <UiBtn label="Экспорт всей БД" icon="download" kind="outline" block :loading="exporting" @click="exportDb" />
            <label class="btn btn--outline btn--md btn--block"
                ><span v-if="importing" class="spin" aria-hidden="true"></span><UiIcon v-else name="install" /><span class="btn__l">Импорт всей БД</span
                ><input type="file" class="sr" accept="application/json,.json" :disabled="importing" @change="importDb"
            /></label>
        </div>
    </UiPage>

    <UiSheet v-if="pass.admin" ref="passSheet" title="Сменить пароль админа" :sub="`${pass.co.name} · @${pass.admin.login}`" size="sm" @close="pass.admin = null">
        <form class="pform" novalidate @submit.prevent="changePass">
            <UiField v-model="pass.value" label="Новый пароль" placeholder="Не меньше 4 символов" icon="lock" autocomplete="new-password" :error="pass.err" @input="pass.err = ''" />
        </form>
        <template #footer="{ close }">
            <UiBtn label="Отмена" kind="secondary" size="lg" @click="close()" />
            <UiBtn label="Сменить" icon="check" size="lg" :loading="pass.saving" @click="changePass" />
        </template>
    </UiSheet>
    <RouterView />
</template>
