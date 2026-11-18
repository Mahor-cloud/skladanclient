/* eslint-disable */
// Тема и размер текста до первой отрисовки — без вспышки. Отдельный файл: политика безопасности прода (script-src 'self') не пускает встроенные скрипты.
;(function () {
    var pref = null,
        scale = null
    try {
        pref = localStorage.getItem("skladan-theme")
        scale = localStorage.getItem("skladan-scale")
    } catch (e) {}
    if (pref !== "light" && pref !== "dark") pref = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    document.documentElement.dataset.theme = pref
    if (pref === "dark") document.querySelector('meta[name="theme-color"]').content = "#0D1A30"
    if (scale === "large") document.documentElement.dataset.scale = "large"
})()
