<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import axiosInstance from "@/service/axios"
import { putLitnaAccount } from "@/service/queries"
import { track } from "@/service/usage"
import { UiBtn, UiField } from "@/ui"
import { reactive } from "vue"

// Вход на lit-na.ru почтой и паролем сайта — карточка «Аккаунт» в админке и окно при заказе. Пароль у нас нигде не показывается.
// Ответ входа (аккаунт) кладётся в кэш; события done(аккаунт) и failed. Слот — кнопки рядом с «Войти» ({ busy }).
const props = defineProps({ login: { type: String, default: "" } })
const emit = defineEmits(["done", "failed"])
const f = reactive({ login: props.login, password: "", err: "", busy: false })
async function submit() {
    if (f.busy) return
    f.err = ""
    f.busy = true
    try {
        const { data } = await axiosInstance.post("/litna/account/login", { login: f.login.trim(), password: f.password })
        putLitnaAccount(data)
        f.password = ""
        emit("done", data)
    } catch (e) {
        f.err = e?.response?.data?.message || e?.message || "Не удалось войти"
        track("error", "Не удалось войти на lit-na.ru")
        emit("failed")
    } finally {
        f.busy = false
    }
}
</script>

<template>
    <form style="display: grid; gap: var(--sp-5)" @submit.prevent="submit">
        <UiField v-model="f.login" label="Почта" type="email" name="litna-login" inputmode="email" autocomplete="off" />
        <UiField v-model="f.password" label="Пароль" type="password" name="litna-password" autocomplete="new-password" :error="f.err" />
        <div v-if="$slots.default" class="co__acts">
            <slot :busy="f.busy" />
            <UiBtn type="submit" label="Войти" icon="check" :loading="f.busy" />
        </div>
        <UiBtn v-else type="submit" label="Войти" icon="check" size="lg" block :loading="f.busy" />
    </form>
</template>
