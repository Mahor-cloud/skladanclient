import { createApp } from "vue"
import App from "./App.vue"
import router from "./router"
import "./router/guard"

import { definePreset } from "@primevue/themes"
import Aura from "@primevue/themes/aura"
import PrimeVue from "primevue/config"
import ConfirmationService from "primevue/confirmationservice"
import ToastService from "primevue/toastservice"

import "@/assets/styles.scss"
import "@/assets/tailwind.css"
import { VueQueryPlugin } from "@tanstack/vue-query"

import { registerSW } from "virtual:pwa-register"

const MyPreset = definePreset(Aura, {
    semantic: {
        primary: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985", 900: "#0c4a6e", 950: "#082f49" },
        surface: { 0: "#ffffff", 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#09090b" },

        colorScheme: {
            light: {
                primary: {
                    color: "{primary.500}",
                    contrastColor: "#ffffff",
                    hoverColor: "{primary.600}",
                    activeColor: "{primary.700}"
                },
                highlight: {
                    background: "{primary.50}",
                    focusBackground: "{primary.100}",
                    color: "{primary.700}",
                    focusColor: "{primary.800}"
                }
            },
            dark: {
                primary: {
                    color: "{primary.400}",
                    contrastColor: "{surface.900}",
                    hoverColor: "{primary.300}",
                    activeColor: "{primary.200}"
                },
                highlight: {
                    background: "color-mix(in srgb, {primary.400}, transparent 84%)",
                    focusBackground: "color-mix(in srgb, {primary.400}, transparent 76%)",
                    color: "rgba(255,255,255,.87)",
                    focusColor: "rgba(255,255,255,.87)"
                }
            }
        }
    }
})

const app = createApp(App)

app.use(router)
app.use(PrimeVue, {
    theme: {
        preset: MyPreset,
        options: {
            darkModeSelector: ".app-dark"
        }
    }
})
app.use(VueQueryPlugin)
app.use(ToastService)
app.use(ConfirmationService)

registerSW({
    immediate: true, // Немедленно проверить обновления
    onNeedRefresh() {
        // Показать уведомление о новом обновлении
        confirm("Тест обновления приложения. Обновить страницу?")
        window.location.reload()
    },
    onOfflineReady() {
        console.log("Приложение готово для работы в оффлайн-режиме.")
    }
})

app.mount("#app")
