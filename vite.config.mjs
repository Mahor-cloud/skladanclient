import { fileURLToPath, URL } from "node:url"

import { PrimeVueResolver } from "@primevue/auto-import-resolver"
import vue from "@vitejs/plugin-vue"
import Components from "unplugin-vue-components/vite"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { icons } from "./public/icons.json"

// https://vitejs.dev/config/
export default defineConfig({
    optimizeDeps: {
        noDiscovery: true
    },
    plugins: [
        vue(),

        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "maskable-icon-512x512.png"],
            manifest: {
                name: "СкладАН PWA",
                short_name: "Склад",
                description: "Склад",
                theme_color: "#ffffff",
                icons: icons,
                display: "standalone",
                screenshots: [
                    {
                        src: "ios/540x720.png",
                        sizes: "540x720",
                        type: "image/png",
                        form_factor: "narrow",
                        label: "Склад"
                    },
                    {
                        src: "ios/720x540.png",
                        sizes: "720x540",
                        type: "image/png",
                        form_factor: "wide",
                        label: "Склад"
                    }
                ]
            },
            workbox: {
                importScripts: ["/service-worker.js"]
            },
            devOptions: {
                enabled: true
            }
        }),
        Components({
            resolvers: [PrimeVueResolver()]
        })
    ],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url))
        }
    }
})
