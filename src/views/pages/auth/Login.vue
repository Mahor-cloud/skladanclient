<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { authService } from '@/service/auth/auth.service'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const login = ref('')
const password = ref('')
const checked = ref(false)
const router = useRouter()
const handle = ref(false)
const errorMessage = ref('')
const submitting = ref(false)

const saveCredentials = () => {
    if (checked.value) {
        localStorage.setItem('login', login.value)
    } else {
        localStorage.removeItem('login')
    }
    localStorage.removeItem('password')
}

const loadCredentials = () => {
    const savedLogin = localStorage.getItem('login')
    if (savedLogin) {
        login.value = savedLogin
        checked.value = true
    }
    localStorage.removeItem('password')
}

const trimEdges = () => {
    login.value = String(login.value || '').trim()
    password.value = String(password.value || '').replace(/^\s+|\s+$/g, '')
}

const handleLogin = async () => {
    if (submitting.value) return
    submitting.value = true
    try {
        handle.value = true
        trimEdges()
        const response = await authService.login(login.value, password.value)
        const userData = response.data.user
        if (userData?._id) {
            saveCredentials()
            router.push(authService.landingRoute())
        } else {
            errorMessage.value = 'Не удалось войти, попробуйте ещё раз'
        }
    } catch (e) {
        const status = e?.response?.status
        const serverMsg = e?.response?.data?.message
        if (status === 429) {
            errorMessage.value = 'Слишком много попыток. Подождите минуту и попробуйте снова.'
        } else if (status === 401) {
            const ru = typeof serverMsg === 'string' && /[А-Яа-яЁё]/.test(serverMsg) ? serverMsg : null
            errorMessage.value = ru || 'Неверный логин или пароль'
        } else {
            errorMessage.value = (typeof serverMsg === 'string' && serverMsg) || 'Ошибка входа'
        }
    } finally {
        submitting.value = false
    }
}

watch([login, password], () => {
    if (errorMessage.value) errorMessage.value = ''
})

onMounted(() => {
    loadCredentials()
})
</script>

<template>
    <main class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, rgb(10, 90, 185) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <picture>
                            <source srcset="/demo/images/litkom.webp" type="image/webp" />
                            <img src="/demo/images/litkom.png" width="200" height="200" class="mb-8 w-20 h-auto shrink-0 mx-auto" alt="logo" fetchpriority="high" />
                        </picture>
                        <span class="text-muted-color font-medium">Войдите чтобы продолжить</span>
                    </div>

                    <form @submit.prevent="handleLogin">
                        <label for="login" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Логин</label>
                        <InputText
                            :invalid="handle && errorMessage.length > 0"
                            id="login"
                            type="text"
                            autocomplete="username"
                            placeholder="Введите логин"
                            class="w-full md:w-[30rem] mb-8"
                            v-model="login"
                            @blur="login = (login || '').trim()"
                            :style="{ fontSize: '16px', minHeight: '44px' }"
                        />

                        <label for="password" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Пароль</label>
                        <Password
                            :invalid="handle && errorMessage.length > 0"
                            v-model="password"
                            placeholder="Введите пароль"
                            input-id="password"
                            autocomplete="current-password"
                            :toggleMask="true"
                            class="mb-4"
                            fluid
                            :feedback="false"
                            @blur="password = (password || '').replace(/^\s+|\s+$/g, '')"
                            :inputStyle="{ fontSize: '16px', minHeight: '44px' }"
                        />

                        <div class="flex items-center justify-between mt-2 mb-8 gap-8">
                            <div class="flex items-center">
                                <Checkbox v-model="checked" inputId="rememberme" @change="saveCredentials" binary class="mr-2"></Checkbox>
                                <label for="rememberme">Запомнить меня?</label>
                            </div>
                        </div>
                        <Button
                            type="submit"
                            label="Войти"
                            style="background: rgb(10, 90, 185); min-height: 48px; font-size: 16px;"
                            class="w-full"
                            :loading="submitting"
                        ></Button>
                        <small v-if="handle && errorMessage" class="text-red-500 block mt-2">{{ errorMessage }}</small>
                    </form>
                </div>
            </div>
        </div>
    </main>
</template>

<style scoped>
.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}
</style>
