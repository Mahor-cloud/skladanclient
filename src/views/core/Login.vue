<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { isDesk } from "@/composables/useBreakpoint"
import { authService } from "@/service/auth/auth.service"
import { UiBtn, UiField, UiIcon, UiIconBtn, UiLogo, UiWordmark } from "@/ui"
import { onMounted, ref, watch } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()
const login = ref(localStorage.getItem("login") || "")
const password = ref("")
const show = ref(false)
const error = ref("")
const bad = ref([]) // какие поля подсветить
const submitting = ref(false)
const loginField = ref(null)
const passInput = ref(null)

watch([login, password], () => {
    error.value = ""
    bad.value = []
})
function fail(msg, fields = ["login", "password"]) {
    error.value = msg
    bad.value = fields
}

async function submit() {
    if (submitting.value) return
    login.value = String(login.value || "").trim()
    password.value = String(password.value || "").replace(/^\s+|\s+$/g, "")
    if (!login.value) return fail("Введите логин", ["login"])
    if (!password.value) return fail("Введите пароль", ["password"])
    if (password.value.length < 4) return fail("Пароль короче 4 символов", ["password"])
    submitting.value = true
    try {
        const response = await authService.login(login.value, password.value)
        if (!response.data.user?._id) return fail("Не удалось войти, попробуйте ещё раз")
        // Логин запоминается сам; пароль не хранится никогда.
        localStorage.setItem("login", login.value)
        localStorage.removeItem("password")
        router.push(authService.landingRoute())
    } catch (e) {
        const status = e?.response?.status
        const raw = e?.response?.data?.message
        const serverMsg = Array.isArray(raw) ? raw.filter(Boolean).join(". ") : typeof raw === "string" ? raw : ""
        // 429 с текстом — пауза после неудачных попыток (сервер называет срок); без текста — общий лимит запросов
        if (status === 429) fail(/[А-Яа-яЁё]/.test(serverMsg) ? serverMsg : "Слишком много попыток. Подождите минуту и попробуйте снова.")
        else if (status === 401) fail(/[А-Яа-яЁё]/.test(serverMsg) ? serverMsg : "Неверный логин или пароль")
        else if (serverMsg) fail(serverMsg)
        else if (!e?.response) fail("Нет связи с сервером. Проверьте интернет и попробуйте снова.")
        else fail(`Ошибка входа (код ${status || "?"})`)
    } finally {
        submitting.value = false
    }
}

onMounted(() => {
    if (isDesk.value) login.value ? passInput.value?.focus() : loginField.value?.focus()
})
</script>

<template>
    <div class="lgn">
        <form class="lgn__card" novalidate @submit.prevent="submit">
            <div class="lgn__logo"><UiLogo draw /></div>
            <h1 class="lgn__name"><UiWordmark /></h1>
            <p class="lgn__sub">Войдите, чтобы продолжить</p>
            <div v-if="error" id="lgn-err" class="login__err" role="alert">
                <UiIcon name="alert" /><span>{{ error }}</span>
            </div>
            <UiField
                ref="loginField"
                v-model="login"
                label="Логин"
                name="login"
                icon="user"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
                maxlength="64"
                :class="{ 'is-invalid': bad.includes('login') }"
                :aria-invalid="bad.includes('login') ? 'true' : null"
                :aria-describedby="bad.includes('login') ? 'lgn-err' : null"
            />
            <label class="field" :class="{ 'is-invalid': bad.includes('password') }" for="f-pass">
                <span class="field__label">Пароль</span>
                <span class="field__box">
                    <UiIcon name="lock" class="field__icon" />
                    <input
                        id="f-pass"
                        ref="passInput"
                        v-model="password"
                        class="field__input"
                        name="password"
                        :type="show ? 'text' : 'password'"
                        autocomplete="current-password"
                        maxlength="128"
                        :aria-invalid="bad.includes('password') ? 'true' : null"
                        :aria-describedby="bad.includes('password') ? 'lgn-err' : null"
                    />
                    <UiIconBtn :icon="show ? 'eyeoff' : 'eye'" :label="show ? 'Скрыть пароль' : 'Показать пароль'" @click="show = !show" />
                </span>
            </label>
            <UiBtn :label="submitting ? 'Входим…' : 'Войти'" type="submit" size="lg" block class="login__submit" :loading="submitting" />
        </form>
        <p class="lgn__foot">Литературный подкомитет АН г.Саратов</p>
    </div>
</template>
