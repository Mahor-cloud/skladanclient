<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { plural } from "@/domain/format"
import { ownerId } from "@/domain/orders"
import axiosInstance from "@/service/axios"
import { useActiveOrders } from "@/service/queries"
import { backTo, confirm, copyText, toast, UiAvatar, UiBanner, UiBtn, UiField, UiIcon, UiIconBtn, UiSheet, UiSwitch } from "@/ui"
import { useQueryClient } from "@tanstack/vue-query"
import { computed, nextTick, reactive, ref, watch } from "vue"
import { errText, roleBrief, roleId, rolePerms, STRENGTH, strength, useRoles, useUsers } from "./admin"

// Карточка пользователя: создание (admin-user-new) и правка (admin-user) — окно поверх списка.
const props = defineProps({ id: { type: String, default: "" } })
const queryClient = useQueryClient()
const { user, can } = useSession()
const { data: users } = useUsers()
const { data: rolesData } = useRoles()
const { data: orders } = useActiveOrders()

const isNew = !props.id
const u = computed(() => (users.value || []).find((x) => x._id === props.id))
const sys = computed(() => !!u.value?.role?.isSystem)
// Сервер меняет пользователей только при флаге «Служащий» (AdminGuard) и праве; иначе карточка — для просмотра.
const ro = computed(() => !user.value?.isAdmin || !can(isNew ? "create_users" : "edit_users"))
const roles = computed(() => rolesData.value || [...new Map((users.value || []).filter((x) => x.role?._id).map((x) => [x.role._id, x.role])).values()])
const toList = () => backTo({ name: "admin" })
let leaving = false
watch(
    () => [users.value, u.value],
    () => {
        if (!isNew && !leaving && users.value && !u.value) {
            toast({ type: "error", title: "Пользователь не найден" })
            toList()
        }
    },
    { immediate: true }
)

const d = reactive({ name: "", login: "", role: "", isAdmin: false, pass: "", passOpen: isNew })
const err = reactive({})
const dirty = ref(false)
const saving = ref(false)
// Список пользователей обновляется (realtime, таймер) — форма заполняется один раз и правки не перетирает.
watch(
    u,
    (x) => {
        if (x && !dirty.value) Object.assign(d, { name: x.name || "", login: x.login || "", role: roleId(x) || "", isAdmin: !!x.isAdmin })
    },
    { immediate: true }
)
const touch = (key) => {
    dirty.value = true
    delete err[key]
}
const str = computed(() => strength(d.pass))
const passInput = ref(null)

async function openPass() {
    // Смена пароля — через подтверждение, как в прежней карточке.
    if (!(await confirm({ title: "Вы уверены, что хотите поменять пароль?", ok: "Да", cancel: "Нет", icon: "lock" }))) return
    d.passOpen = true
    d.pass = ""
    await nextTick()
    passInput.value?.focus()
}
function closePass() {
    d.passOpen = false
    d.pass = ""
    delete err.pass
}

const sheet = ref(null)
function done() {
    leaving = true
    dirty.value = false
    sheet.value.close("save")
}
async function save() {
    for (const k of Object.keys(err)) delete err[k]
    const login = d.login.trim()
    if (!d.name.trim()) err.name = "Укажите имя"
    if (!login) err.login = "Укажите логин"
    if (d.passOpen && d.pass.length < 4) err.pass = "Пароль — минимум 4 символа"
    if (!d.role) err.role = "Выберите роль"
    if (Object.keys(err).length) return toast({ type: "warning", title: "Проверьте поля", text: Object.values(err).join(". ") })

    const payload = { name: d.name.trim(), login, role: d.role }
    if (d.passOpen) payload.password = d.pass
    // «Служащий» сервер даёт задать при создании; менять у существующего может только супер-админ.
    if (isNew) payload.isAdmin = d.isAdmin
    saving.value = true
    try {
        await (isNew ? axiosInstance.post("/auth/create", payload) : axiosInstance.put(`/auth/${props.id}`, payload))
    } catch (e) {
        saving.value = false
        const msg = errText(e, "Не удалось сохранить пользователя")
        if (/логин/i.test(msg) && /занят/i.test(msg)) err.login = msg
        return toast({ type: "error", title: "Не удалось сохранить пользователя", text: msg })
    }
    saving.value = false
    queryClient.invalidateQueries({ queryKey: ["users"] })
    const pass = d.pass
    if (isNew) toast({ type: "success", title: "Пользователь создан", text: `${payload.name} · логин ${login}`, action: { label: "Скопировать", fn: () => copyText(`Логин: ${login}\nПароль: ${pass}`, "Логин и пароль") } })
    else toast({ type: "success", title: "Пользователь обновлён", text: d.passOpen ? "Новый пароль сохранён" : payload.name })
    done()
}

async function remove() {
    const x = u.value
    const n = (orders.value || []).filter((o) => !o.isCompleted && ownerId(o) === x._id).length
    if (!(await confirm({ title: `Удалить «${x.name}»?`, text: n ? `У него ${n} ${plural(n, ["активный заказ", "активных заказа", "активных заказов"])}` : "", ok: "Удалить", tone: "danger" }))) return
    try {
        await axiosInstance.delete(`/auth/${props.id}`)
    } catch (e) {
        return toast({ type: "error", title: "Не удалось удалить пользователя", text: errText(e, "Ошибка сервера") })
    }
    queryClient.invalidateQueries({ queryKey: ["users"] })
    toast({ type: "info", title: "Пользователь удалён", text: x.name })
    done()
}
const beforeClose = async () => !dirty.value || !!(await confirm({ title: "Закрыть без сохранения?", ok: "Закрыть", cancel: "Остаться", tone: "danger" }))
</script>

<template>
    <UiSheet v-if="isNew || u" ref="sheet" :title="isNew ? 'Новый пользователь' : u.name" :sub="isNew ? '' : `${u.role?.name || ''} · @${u.login}`" size="md" :before-close="beforeClose" @close="toList">
        <form class="pform" novalidate @submit.prevent="save">
            <div class="ucard">
                <UiAvatar :user="{ _id: id || 'new', name: d.name || '?' }" size="lg" />
                <div>
                    <b>{{ d.name || "Новый пользователь" }}</b
                    ><small>{{ d.login ? "@" + d.login : "логин не задан" }}</small>
                </div>
            </div>
            <UiBanner v-if="sys" tone="neutral" icon="lock" title="Главный администратор" />
            <UiField :model-value="d.name" label="Имя или название группы" name="name" :error="err.name" required maxlength="80" autocomplete="off" :readonly="ro" @update:model-value="(d.name = $event), touch('name')" />
            <div class="pform__row pform__row--stack">
                <UiField
                    :model-value="d.login"
                    label="Логин"
                    name="login"
                    placeholder="латиницей, например rassvet"
                    :error="err.login"
                    required
                    :readonly="sys || ro"
                    autocapitalize="none"
                    spellcheck="false"
                    autocomplete="off"
                    maxlength="40"
                    @update:model-value="(d.login = $event), touch('login')"
                />
                <div class="field" :class="{ 'is-invalid': err.pass }">
                    <span class="field__label">Пароль <span v-if="isNew" class="req">*</span></span>
                    <template v-if="d.passOpen">
                        <span class="field__box"
                            ><UiIcon name="lock" class="field__icon" /><input
                                ref="passInput"
                                v-model="d.pass"
                                class="field__input"
                                name="pass"
                                type="text"
                                placeholder="Не меньше 4 символов"
                                autocomplete="new-password"
                                maxlength="64"
                                aria-label="Пароль"
                                :aria-invalid="!!err.pass"
                                @input="touch('pass')" /><UiIconBtn v-if="!isNew" icon="x" label="Не менять пароль" @click="closePass"
                        /></span>
                        <span class="pstr"
                            ><template v-if="str != null"
                                ><span class="pstr__bar" :data-s="str"><i></i><i></i><i></i></span><span>{{ STRENGTH[str] }}</span></template
                            ></span
                        >
                        <span v-if="err.pass" class="field__msg field__msg--err"><UiIcon name="alert" :size="16" />{{ err.pass }}</span>
                    </template>
                    <UiBtn v-else label="Задать новый пароль" icon="lock" kind="outline" size="lg" block :disabled="ro" @click="openPass" />
                </div>
            </div>
            <div class="field" :class="{ 'is-invalid': err.role }">
                <span class="field__label">Роль</span>
                <div class="rpicks" role="radiogroup" aria-label="Роль" data-track="Роль пользователя">
                    <label v-for="r in roles" :key="r._id" class="rpick" :class="{ 'is-disabled': sys && r._id !== d.role }"
                        ><input v-model="d.role" type="radio" name="role" :value="r._id" :disabled="sys || ro" @change="touch('role')" /><span class="rpick__b"
                            ><b>{{ r.isSystem ? r.name + " · председатель" : r.name }}</b
                            ><small>{{ roleBrief(r).join(" · ") }}</small></span
                        ><span class="rpick__n">{{ rolePerms(r).length }}</span></label
                    >
                </div>
                <span v-if="err.role" class="field__msg field__msg--err"><UiIcon name="alert" :size="16" />{{ err.role }}</span>
            </div>
            <UiSwitch :model-value="d.isAdmin" label="Служащий склада" hint="Доступ к служебным разделам" :disabled="!isNew || ro" @update:model-value="(d.isAdmin = $event), touch('isAdmin')" />
        </form>
        <template #footer="{ close }">
            <UiBtn v-if="!isNew && !ro && !sys && can('delete_users')" label="Удалить" icon="trash" kind="danger-ghost" size="lg" @click="remove" />
            <UiBtn :label="ro ? 'Закрыть' : 'Отмена'" kind="secondary" size="lg" @click="close()" />
            <UiBtn v-if="!ro" :label="isNew ? 'Создать' : 'Сохранить'" icon="check" size="lg" :loading="saving" @click="save" />
        </template>
    </UiSheet>
</template>
