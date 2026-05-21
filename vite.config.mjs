import { fileURLToPath, URL } from "node:url"

import { PrimeVueResolver } from "@primevue/auto-import-resolver"
import vue from "@vitejs/plugin-vue"
import Components from "unplugin-vue-components/vite"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { icons } from "./public/icons.json"

export default defineConfig({
    optimizeDeps: {
        noDiscovery: true,
        include: ["pako"]
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
                importScripts: ["/service-worker.js"],
                runtimeCaching: [
                    {
                        urlPattern: /\.(json|html|htm|js|css)$/,
                        handler: "NetworkOnly", // Всегда загружать HTML из сети
                        options: {
                            cacheName: "html-cache",
                            expiration: {
                                maxEntries: 30,
                                maxAgeSeconds: 60 // 1 минута
                            }
                        }
                    },
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
            // PWA в dev мешает HMR из-за устаревших кэшей. Включается только в build.
            devOptions: {
                enabled: false
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
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:4300",
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: "dist",
        // invoice.js (pdf-lib + fontkit + шрифт ≈ 1.1 МБ) — лениво грузится
        // только при печати накладной (см. dynamic import в OrderDialog), не
        // на critical path. Чтобы Vite не выводил warning на каждой сборке —
        // поднимаем лимит выше его размера. На реальную загрузку влияния
        // нет, это только настройка warning.
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            cache: false,
            input: {
                application: "./index.html"
            },
            output: {
                // Контент-хэш в имени точки входа: раньше был неизменный
                // /application.js — браузер/SW кэшировали его «вечно» и не
                // видели новые деплои без hard-refresh, а Lighthouse штрафовал
                // cache-insight (~1.1 МБ). Теперь хэш → файл в /assets/,
                // nginx отдаёт его immutable на год, при изменении кода имя
                // меняется само (index.html подставляет новое). Логика не
                // затронута — Vite сам прописывает правильный <script src>.
                entryFileNames: "assets/[name]-[hash].js"
                // manualChunks намеренно НЕ используется: разбиение монолита
                // на vendor/primevue-чанки добавляло цепочку запросов
                // (waterfall) и стабильно роняло Lighthouse-производительность
                // на ~5–15 пунктов при том же объёме JS. Единственный реальный
                // выигрыш — ленивый pdf-lib — реализован через dynamic import
                // в OrderDialog (вне critical-path), без manualChunks.
            }
        }
    }
})
