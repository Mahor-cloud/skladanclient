import { fileURLToPath, URL } from "node:url"

import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
    optimizeDeps: {
        noDiscovery: true,
        // pako (внутри pdf-lib) — CommonJS: без предсборки накладная в dev не загрузится.
        include: ["pako"]
    },
    plugins: [
        vue(),

        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.ico"],
            // Значки манифеста браузер берёт сам при установке; в предкэше они были 7 МБ из 9.
            includeManifestIcons: false,
            manifest: {
                name: "СкладАН PWA",
                short_name: "Склад",
                description: "Склад",
                // Цвет фона заставки: системный экран запуска установленного приложения переходит в заставку из index.html без вспышки.
                theme_color: "#EEF1F6",
                background_color: "#EEF1F6",
                // Android и установка с компьютера берут 192 и 512; iOS — apple-touch-icon из index.html, вкладка — favicon.ico.
                icons: [
                    { src: "android/android-launchericon-192-192.png", sizes: "192x192", type: "image/png" },
                    { src: "android/android-launchericon-512-512.png", sizes: "512x512", type: "image/png" }
                ],
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
                // Накладная (pdf-lib + шрифт, ≈1 МБ) нужна единицам — качается по нажатию, а не при установке.
                globIgnores: ["assets/invoice-*.js"],
                importScripts: ["/service-worker.js"],
                runtimeCaching: [
                    {
                        // Картинки (включая обложки /covers/*.webp) и шрифты — из кэша: имена шрифтов с хэшем, обложки не меняются.
                        urlPattern: /\.(png|jpg|jpeg|svg|webp|woff2)$/,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "static-assets",
                            expiration: {
                                maxEntries: 160,
                                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 неделя
                            }
                        }
                    }
                ]
            }
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
    test: {
        environment: "happy-dom"
    },
    build: {
        // invoice.js (pdf-lib + fontkit + шрифт ≈ 1 МБ) грузится лениво, только при печати накладной;
        // лимит поднят выше его размера, чтобы сборка не предупреждала о нём каждый раз.
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            input: {
                application: "./index.html"
            },
            // Рисованные обложки без побочных эффектов: иначе каждый экран, импортирующий "@/ui", тянул бы их, даже без обложек.
            treeshake: { moduleSideEffects: (id) => !/\/src\/domain\/(covers|stockCovers)\.js$/.test(id) },
            output: {
                // Общий набор (основа, домен, запросы, составные функции) — во входном файле, а не россыпью кусков по 0,3–3 КБ
                // на каждый экран; обычный статический импорт этого не даёт: Rollup раскладывает модули по тому, кто их использует.
                // Вход (index.html со всеми статическими зависимостями) в том же куске — значит, это один файл, а не цепочка
                // vendor-чанков, которая раньше роняла первую загрузку. Обложки — отдельно: нужны не всем экранам.
                manualChunks: (id) => (/\/src\/(ui\/(UiCover|UiLines)|domain\/(covers|stockCovers))/.test(id) ? "covers" : /\/index\.html$|\/src\/(ui|domain|composables|service)\//.test(id) ? "application" : undefined)
            }
        }
    }
})
