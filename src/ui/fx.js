/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
const visible = (el) => !!el && el.getClientRects().length > 0

function bump() {
    document.querySelectorAll("[data-fly-target]").forEach((el) => {
        el.classList.remove("bump")
        void el.offsetWidth
        el.classList.add("bump")
    })
}

/**
 * Полёт товара в корзину: обложка fromEl летит в toEl (строка корзины справа) или, если её не видно, в полосу корзины
 * ([data-fly-target]). При «уменьшить движение» — только отметка новой строки и счётчика.
 */
export function fly(fromEl, toEl) {
    const flash = () => {
        const line = visible(toEl) && toEl.closest(".line")
        if (line) {
            line.classList.remove("is-new")
            void line.offsetWidth
            line.classList.add("is-new")
        }
        bump()
    }
    if (!fromEl || !fromEl.animate || calm()) return flash()
    const target = visible(toEl) ? toEl : [...document.querySelectorAll("[data-fly-target]")].find(visible)
    if (!target) return
    const a = fromEl.getBoundingClientRect()
    const b = target.getBoundingClientRect()
    const ghost = fromEl.cloneNode(true)
    ghost.className = fromEl.className + " fly"
    Object.assign(ghost.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" })
    document.body.appendChild(ghost)
    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height / 2 - (a.top + a.height / 2)
    const s = Math.max(0.12, 28 / a.width)
    ghost.animate(
        [
            { transform: "translate(0,0) scale(1)", opacity: 1 },
            { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 60}px) scale(${(1 + s) / 2.2})`, opacity: 1, offset: 0.55 },
            { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.2 }
        ],
        { duration: 620, easing: "cubic-bezier(.5,0,.3,1)" }
    ).onfinish = () => {
        ghost.remove()
        flash()
    }
}

/** Блик и лёгкий наклон карточки за курсором — у элементов с data-tilt; только мышь, не при «уменьшить движение». */
export function installTilt() {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)")
    let cur = null
    document.addEventListener(
        "pointermove",
        (e) => {
            if (!fine.matches || calm()) return
            const t = e.target.closest ? e.target.closest("[data-tilt]") : null
            if (cur && cur !== t) {
                cur.style.removeProperty("--rx")
                cur.style.removeProperty("--ry")
                cur.classList.remove("is-tilt")
            }
            cur = t
            if (!t) return
            const r = t.getBoundingClientRect()
            const x = (e.clientX - r.left) / r.width
            const y = (e.clientY - r.top) / r.height
            const k = Math.max(0.5, Math.min(2, 300 / Math.max(r.width, r.height))) // крупные карточки наклоняются меньше
            t.classList.add("is-tilt")
            t.style.setProperty("--rx", ((0.5 - y) * 2 * k).toFixed(2) + "deg")
            t.style.setProperty("--ry", ((x - 0.5) * 2 * k).toFixed(2) + "deg")
            t.style.setProperty("--gx", (x * 100).toFixed(1) + "%")
            t.style.setProperty("--gy", (y * 100).toFixed(1) + "%")
        },
        { passive: true }
    )
}
