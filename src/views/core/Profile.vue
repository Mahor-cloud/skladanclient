<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useNav } from "@/composables/useNav"
import { usePush } from "@/composables/usePush"
import { usePwaInstall } from "@/composables/usePwaInstall"
import { useSession } from "@/composables/useSession"
import { useTheme } from "@/composables/useTheme"
import { saveTokensStorage } from "@/service/auth/auth.helper"
import { authService } from "@/service/auth/auth.service"
import axiosInstance from "@/service/axios"
import { backTo, confirm, toast, UiAvatar, UiBadge, UiBtn, UiField, UiIcon, UiIconBtn, UiSeg, UiSheet } from "@/ui"
import { computed, onMounted, ref } from "vue"
import { useRoute } from "vue-router"
import { pushSummary } from "./push"

// Профиль — окно поверх любого экрана (?sheet=profile): уведомления, разделы (на телефоне), тема, размер текста, выход.
const route = useRoute()
const { user, isSuper, roleTitle, plain } = useSession()
const { items, badges } = useNav()
const { theme, setTheme, scale, setScale } = useTheme()
const { canInstall, isInstalled, isIOS, hidden: pwaHidden, promptInstall } = usePwaInstall()
const push = usePush()

const withSheet = (name) => ({ path: route.path, query: { ...route.query, sheet: name } })
const close = () => backTo({ path: route.path, query: { ...route.query, sheet: undefined } })
const groups = computed(() => [...new Set(items.value.map((n) => n.group))])
const summary = computed(() => pushSummary(plain.value, push.prefs))
onMounted(push.refresh)

function install() {
    if (canInstall.value) promptInstall()
    else toast({ type: "info", title: "Установка", text: "Меню «Поделиться» → «На экран „Домой“»", timeout: 6000 })
}
function hidePwa() {
    pwaHidden.value = true
    toast({ type: "info", title: "Плашка скрыта" })
}
function pickScale(v) {
    setScale(v)
    toast({ type: "info", title: v === "large" ? "Крупный текст включён" : "Обычный размер текста", timeout: 1800 })
}
async function logout() {
    if (await confirm({ title: "Выйти из аккаунта?", ok: "Выйти", tone: "danger", icon: "logout" })) authService.logout()
}

/* Смена своего пароля — только супер-админ (остальным пароль меняет администратор местности). */
const pwd = ref(null) // { current, next, again } пока окно открыто
const pwdSaving = ref(false)
async function changePassword() {
    const p = pwd.value
    if (!p.current || !p.next) return toast({ type: "warning", title: "Заполните все поля" })
    if (p.next !== p.again) return toast({ type: "warning", title: "Пароли не совпадают" })
    if (p.next.length < 4) return toast({ type: "warning", title: "Минимум 4 символа" })
    pwdSaving.value = true
    try {
        const { data } = await axiosInstance.put("/auth/me/password", { currentPassword: p.current, newPassword: p.next })
        if (data?.accessToken && data?.refreshToken) saveTokensStorage({ accessToken: data.accessToken, refreshToken: data.refreshToken })
        toast({ type: "success", title: "Пароль изменён" })
        pwd.value = null
    } catch (err) {
        toast({ type: "error", title: "Ошибка", text: err?.response?.data?.message || err.message || "Не удалось сменить пароль", timeout: 5000 })
    } finally {
        pwdSaving.value = false
    }
}

/* Обратная связь: сервер сохраняет текст, читает супер-админ в разделе «Обратная связь». При ошибке окно и текст остаются. */
const fb = ref(null) // { text, sending } пока окно открыто
const fbSheet = ref(null)
async function sendFeedback() {
    const f = fb.value
    const text = f.text.trim()
    if (!text || f.sending) return
    f.sending = true
    try {
        await axiosInstance.post("/feedback", { text })
        toast({ type: "success", title: "Отправлено" })
        fbSheet.value?.close("sent")
    } catch (err) {
        toast({ type: "error", title: "Не отправлено", text: [].concat(err?.response?.data?.message || err.message).join(". "), timeout: 5000 })
    } finally {
        f.sending = false
    }
}
</script>

<template>
    <UiSheet title="Профиль" size="md" @close="close">
        <div class="menu">
            <div class="me">
                <UiAvatar :user="user" size="lg" />
                <div>
                    <b>{{ user?.name }}</b
                    ><small
                        >{{ roleTitle }}<template v-if="user?.companyName"> · {{ user.companyName }}</template></small
                    >
                </div>
            </div>
            <div v-if="!pwaHidden && !isSuper && !isInstalled && (canInstall || isIOS)" class="pwa">
                <UiIcon name="install" :size="26" />
                <p>Установите «СкладАН» на телефон</p>
                <UiBtn label="Установить" kind="primary" size="sm" @click="install" />
                <UiIconBtn icon="x" label="Скрыть" @click="hidePwa" />
            </div>
            <div v-if="!isSuper" class="mrow" :class="{ 'mrow--on': push.subscribed.value }">
                <span class="mrow__i"><UiIcon :name="push.subscribed.value ? 'check' : 'bolt'" :size="22" /></span>
                <p>
                    {{ push.subscribed.value ? "Уведомления включены" : "Включить уведомления" }}<small v-if="push.subscribed.value">{{ summary || "ничего не выбрано" }}</small>
                </p>
                <UiBtn :label="push.subscribed.value ? 'Изменить' : 'Включить'" :kind="push.subscribed.value ? 'secondary' : 'primary'" size="sm" :to="withSheet('push')" replace />
            </div>
            <div v-if="isSuper" class="mrow">
                <span class="mrow__i"><UiIcon name="lock" :size="22" /></span>
                <p>Пароль</p>
                <UiBtn label="Сменить пароль" kind="secondary" size="sm" @click="pwd = { current: '', next: '', again: '' }" />
            </div>
            <section v-for="g in groups" :key="g" class="menu__nav">
                <h4>{{ g }}</h4>
                <div class="navgrid">
                    <RouterLink v-for="n in items.filter((x) => x.group === g)" :key="n.id" class="navtile" :to="n.path">
                        <span class="navtile__i"><UiIcon :name="n.icon" :size="22" /></span>{{ n.label }}<UiBadge v-if="badges[n.id] && n.id !== 'storage'" :n="badges[n.id].n" :tone="badges[n.id].tone" />
                    </RouterLink>
                </div>
            </section>
            <section>
                <h4>Тема оформления</h4>
                <UiSeg
                    :model-value="theme"
                    label="Тема"
                    :options="[
                        { value: 'system', label: 'Системная' },
                        { value: 'light', label: 'Светлая', icon: 'sun' },
                        { value: 'dark', label: 'Тёмная', icon: 'moon' }
                    ]"
                    @update:model-value="setTheme"
                />
            </section>
            <section>
                <h4>Размер текста</h4>
                <UiSeg
                    :model-value="scale"
                    label="Размер текста"
                    :options="[
                        { value: 'normal', label: 'Обычный', icon: 'type' },
                        { value: 'large', label: 'Крупный', icon: 'type' }
                    ]"
                    @update:model-value="pickScale"
                />
            </section>
            <div class="menu__acts">
                <UiBtn label="Обратная связь" icon="chat" kind="secondary" block size="lg" @click="fb = { text: '', sending: false }" />
                <UiBtn label="Выйти из аккаунта" icon="logout" kind="danger-ghost" block size="lg" @click="logout" />
            </div>
            <p class="menu__foot">Литературный подкомитет АН г.Саратов</p>
        </div>
    </UiSheet>
    <UiSheet v-if="pwd" title="Сменить пароль" size="sm" @close="pwd = null">
        <form id="pwd-form" class="pform" @submit.prevent="changePassword">
            <UiField v-model="pwd.current" label="Текущий пароль" type="password" autocomplete="current-password" maxlength="128" />
            <UiField v-model="pwd.next" label="Новый пароль" type="password" autocomplete="new-password" maxlength="128" />
            <UiField v-model="pwd.again" label="Повторите новый пароль" type="password" autocomplete="new-password" maxlength="128" />
        </form>
        <template #footer>
            <UiBtn label="Отмена" kind="secondary" size="lg" :disabled="pwdSaving" @click="pwd = null" />
            <UiBtn label="Сменить" icon="check" kind="success" size="lg" type="submit" form="pwd-form" :loading="pwdSaving" />
        </template>
    </UiSheet>
    <UiSheet v-if="fb" ref="fbSheet" title="Обратная связь" sub="Баги, пожелания, предложения" size="sm" @close="fb = null">
        <form id="fb-form" class="pform" @submit.prevent="sendFeedback">
            <UiField v-model="fb.text" :rows="6" aria-label="Сообщение" maxlength="2000" autofocus />
        </form>
        <template #footer>
            <UiBtn label="Отправить" size="lg" type="submit" form="fb-form" :loading="fb.sending" :disabled="!fb.text.trim()" />
        </template>
    </UiSheet>
</template>
