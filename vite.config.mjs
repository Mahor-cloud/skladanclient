import { fileURLToPath, URL } from "node:url"

import { PrimeVueResolver } from "@primevue/auto-import-resolver"
import vue from "@vitejs/plugin-vue"
import Components from "unplugin-vue-components/vite"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { icons } from "./public/icons.json"

export default defineConfig({
    optimizeDeps: {
        noDiscovery: true
    },
    plugins: [
        vue(),

        VitePWA({
            registerType: "autoUpdate",
            injectRegister: "auto",
            includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "maskable-icon-512x512.png"],
            manifest: {
                name: "СкладАН PWA",
                short_name: "Склад",
                description: "Склад",
                theme_color: "#312f2f",
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
                cleanupOutdatedCaches: true,
                importScripts: ["/service-worker.js", "./service-worker2.js"],
                runtimeCaching: [
                    // {
                    //     urlPattern: /\.(json|html|htm|js|css)$/,
                    //     handler: "NetworkOnly", // Всегда загружать HTML из сети
                    //     options: {
                    //         cacheName: "html-cache",
                    //         expiration: {
                    //             maxEntries: 30,
                    //             maxAgeSeconds: 60 * 10 // 1 мин
                    //         }
                    //     }
                    // },
                    {
                        urlPattern: /\.(png|jpg|jpeg|svg|webp)$/,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "static-assets",
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 неделя
                            }
                        }
                    }
                ]
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
    },
    build: {
        outDir: "dist",
        rollupOptions: {
            cache: false,
            input: {
                appMain: "./index.html",
                "service-worker2": "./src/service-worker2.ts"
            },
            output: {
                entryFileNames: "[name].js"
            }
        }
    }
})
