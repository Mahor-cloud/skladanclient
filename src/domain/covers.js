/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

/* Рисованные обложки товаров. Тип обложки задаётся у ВИДА (kindCovers: { [вид]: тип }), цвет — у товара (p.coverColor).
   Все рисунки в одном стиле: плоские формы, блик, тень, viewBox 120×140. Название товара — данные пользователей: в SVG только через esc(). */
import { esc, hash } from "./format"
import { STOCK_COVERS } from "./stockCovers"

const KEYTAG = [
    [/только сегодня/i, "#F3F2EE", "ТОЛЬКО|СЕГОДНЯ", "#2A2B31"],
    [/с возвращением/i, "#F3F2EE", "С ВОЗ-|ВРАЩЕНИЕМ", "#2A2B31"],
    [/30 дней/i, "#FF7A1A", "30|дней"],
    [/60 дней/i, "#1FA463", "60|дней"],
    [/90 дней/i, "#E5323B", "90|дней"],
    [/^6 мес/i, "#2B6DE0", "6|мес"],
    [/^9 мес/i, "#F2C200", "9|мес", "#2A2B31"],
    [/^1 год/i, "#DDF7C2", "1|год", "#2E5E19", true],
    [/^18 мес/i, "#9AA0AB", "18|мес"],
    [/несколько/i, "#17181D", "НЕСКОЛЬКО|ЛЕТ", "#E8C26A"]
]
const BOOKS = ["#2C3E9E", "#1D2B6B", "#7A2140", "#0F5A5E", "#4B2D84", "#8C5A12", "#294D8F"]
const IPC = ["#E8902B", "#D9534F", "#3E8ED0", "#2FA37A", "#8E5CC7", "#C2577F"]
export const COVER_COLORS = [
    ["#2C3E9E", "Индиго"],
    ["#0147B9", "Синий"],
    ["#3C6E9E", "Стальной"],
    ["#0F5A5E", "Морской"],
    ["#2F7D5B", "Зелёный"],
    ["#6B7F3A", "Оливковый"],
    ["#B8862F", "Охра"],
    ["#C4674E", "Терракота"],
    ["#7A2140", "Бордо"],
    ["#8E5C8A", "Сливовый"],
    ["#5A5F73", "Сланец"],
    ["#3A3D4A", "Графит"]
]
const PAL = COVER_COLORS.map((x) => x[0])
const KIND_COVER = { Книга: "book", Буклет: "booklet", ИП: "leaflet", Брелок: "keytag", БУ: "booklet", СП: "brochure", Тетрадь: "notebook", Прочее: "box" }
const ink = "#2A2B31"
const paper = "#FFFDF7"

const wrap = (txt, max, lines) => {
    const out = []
    const words = String(txt).split(/\s+/)
    let cur = ""
    for (const w of words) {
        if ((cur + " " + w).trim().length <= max) cur = (cur + " " + w).trim()
        else {
            if (cur) out.push(cur)
            cur = w.length > max ? w.slice(0, max - 1) + "…" : w
        }
        if (out.length === lines) break
    }
    if (out.length < lines && cur) out.push(cur)
    if (out.length === lines && words.join(" ").length > out.join(" ").length + 1) out[lines - 1] = out[lines - 1].replace(/.?$/, "…")
    return out.slice(0, lines)
}
const T = (lines, x, y, size, lh, fill, weight = 800, anchor = "start", extra = "") =>
    lines.map((l, i) => `<text x="${x}" y="${y + i * lh}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${esc(l)}</text>`).join("")
const lines4 = (x, y, w) => [0, 1, 2, 3].map((i) => `<rect x="${x}" y="${y + i * 8}" width="${[w, w - 8, w, w - 14][i]}" height="3" rx="1.5" fill="#000" opacity=".11"/>`).join("")
const rhomb = (cx, cy, r, stroke, sw = 2, extra = "") => `<path d="M${cx} ${cy - r}l${r} ${r}-${r} ${r}-${r}-${r}z" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`
const plain = (name) => String(name || "").replace(/["«»]/g, "")

function bookSVG(p, c, hard) {
    const title = wrap(plain(String(p.name || "").replace(/\(.*?\)/g, "")).toUpperCase(), 12, 4)
    const tx = hard ? 39 : 35
    // Кегль подгоняется под самую длинную строку, чтобы название не вылезало за обложку.
    const fs = Math.min(7.4, (84 - tx) / (Math.max(1, ...title.map((l) => l.length)) * 0.78)).toFixed(2)
    return `<rect x="30" y="16" width="64" height="108" rx="3" fill="#EFE9DC"/>
      <path d="M90 18v104" stroke="#D8CFBD" stroke-width="1"/>
      <rect x="24" y="12" width="64" height="108" rx="${hard ? 3 : 2}" fill="${c}"/>
      <rect x="24" y="12" width="${hard ? 9 : 5}" height="108" rx="2" fill="#000" opacity=".24"/>
      <rect x="${hard ? 33 : 29}" y="12" width="1.2" height="108" fill="#fff" opacity=".2"/>
      ${T(title, tx, 33, fs, 9.2, "#fff", 800, "start", 'letter-spacing=".3"')}
      <rect x="${tx}" y="100" width="18" height="2.4" rx="1.2" fill="#fff" opacity=".55"/>
      <circle cx="76" cy="105" r="4.5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.4"/>
      ${hard ? `<path d="M70 12v26l-4-4-4 4V12z" fill="#D9B45A"/>` : ""}`
}
function keytagSVG(p, c, own) {
    const n = String(p.name || "")
    const m = own ? null : KEYTAG.find((x) => x[0].test(n))
    const years = n.match(/(\d+)\s*(?:лет|года|год)/i)
    const [, , lbl, inkc, glow] =
        m || (years ? [0, c, `${years[1]}|${/год/i.test(n) && +years[1] < 5 ? "года" : "лет"}`, own ? "#fff" : "#E8C26A"] : [0, c, (KEYTAG.find((x) => x[0].test(n)) || [0, 0, n.toUpperCase().slice(0, 9)])[2], own ? "#fff" : "#2A2B31"])
    const [big, small] = String(lbl).split("|")
    const numeric = /^\d+$/.test(big)
    const fg = inkc || "#fff"
    return `${glow ? '<rect x="35" y="35" width="50" height="88" rx="21" fill="#C6F59A" opacity=".55"/>' : ""}
      <circle cx="60" cy="31" r="13" fill="none" stroke="#B7BCC7" stroke-width="3.2"/>
      <rect x="40" y="40" width="40" height="78" rx="17" fill="${c}"/>
      <rect x="40" y="40" width="40" height="78" rx="17" fill="none" stroke="#000" stroke-opacity=".1"/>
      <circle cx="60" cy="52" r="4.6" fill="var(--cover-bg)"/>
      <path d="M53.5 41.5a13 13 0 0 0 13 0" fill="none" stroke="#B7BCC7" stroke-width="3.2" stroke-linecap="round"/>
      <rect x="44" y="60" width="4" height="48" rx="2" fill="#fff" opacity=".22"/>
      ${
          numeric
              ? `<text x="60" y="${big.length > 1 ? 89 : 90}" font-size="${big.length > 1 ? 21 : 24}" font-weight="800" fill="${fg}" text-anchor="middle">${big}</text>
           <text x="60" y="102" font-size="7.6" font-weight="800" fill="${fg}" text-anchor="middle" opacity=".88" letter-spacing=".5">${esc((small || "").toUpperCase())}</text>`
              : T([big, small || ""], 60, 84, 5.6, 8, fg, 800, "middle", 'letter-spacing=".2"')
      }`
}

export const COVERS = {
    book: { label: "Книга", draw: (p, c) => bookSVG(p, c, false) },
    hardbook: { label: "Книга в твёрдой обложке", draw: (p, c) => bookSVG(p, c, true) },
    brochure: {
        label: "Брошюра",
        draw(p, c) {
            const title = wrap(plain(p.name), 12, 4)
            const tag = (String(p.category || "").split(/\s+/)[0] || "").toUpperCase().slice(0, 10)
            return `<rect x="34" y="17" width="58" height="104" rx="2" fill="#D3D8E0"/>
        <rect x="30" y="14" width="58" height="104" rx="2" fill="${c}"/>
        <rect x="30" y="14" width="58" height="16" fill="#fff" opacity=".14"/>
        <text x="36" y="25" font-size="6" font-weight="800" fill="#fff" letter-spacing=".8">${esc(tag)}</text>
        ${T(title, 36, 44, 7, 8.6, "#fff", 800)}
        <rect x="29" y="38" width="3" height="10" rx="1" fill="#C9CED8"/><rect x="29" y="88" width="3" height="10" rx="1" fill="#C9CED8"/>`
        }
    },
    booklet: {
        label: "Буклет",
        draw(p, c) {
            const bu = p.category === "БУ"
            return `<g transform="rotate(${bu ? 2.5 : -2.5} 60 70)">
        <rect x="37" y="19" width="56" height="102" rx="2" fill="#DADDE3"/>
        <rect x="32" y="16" width="56" height="102" rx="2" fill="#FBFBF8"/>
        <rect x="32" y="16" width="56" height="54" rx="2" fill="${c}"/>
        ${bu ? `<path d="M32 58 88 40v12L32 70z" fill="#fff" opacity=".16"/>` : ""}
        ${T(wrap(plain(p.name), 13, 3), 38, 31, 7, 8.6, "#fff", 800)}
        ${lines4(38, 80, 42)}
      </g>`
        }
    },
    leaflet: {
        label: "Листок",
        draw(p, c) {
            const num = (String(p.name || "").match(/IP\s*#\s*(\d+)/i) || [])[1]
            return `<g transform="rotate(-3 60 70)">
        <path d="M33 14h44l13 13v95H33z" fill="${paper}"/>
        <path d="M77 14v13h13z" fill="#E7E0D0"/>
        <path d="M33 14h44l13 13v95H33z" fill="none" stroke="#000" stroke-opacity=".08"/>
        <rect x="33" y="32" width="57" height="34" fill="${c}"/>
        ${num ? `<text x="40" y="45" font-size="8" font-weight="800" fill="#fff" opacity=".85" letter-spacing="1">IP</text><text x="40" y="60" font-size="15" font-weight="800" fill="#fff">№${esc(num)}</text>` : T(wrap(plain(p.name), 11, 3), 39, 43, 6.6, 8.2, "#fff", 800)}
        ${lines4(40, 76, 42)}
      </g>`
        }
    },
    notebook: {
        label: "Тетрадь",
        draw(p, c) {
            const name = String(p.name || "")
            const title = wrap(name.replace(/^Тетрадь\s*/i, "").replace(/^./, (x) => x.toUpperCase()) || name, 11, 2)
            let rings = ""
            for (let i = 0; i < 11; i++) rings += `<rect x="23" y="${20 + i * 9.3}" width="12" height="4.4" rx="2.2" fill="none" stroke="#BFC4CE" stroke-width="2"/>`
            return `<rect x="29" y="14" width="64" height="108" rx="5" fill="${c}"/>
        <rect x="42" y="32" width="42" height="30" rx="3" fill="${paper}"/>
        <text x="47" y="42" font-size="5.6" font-weight="800" fill="${c}" letter-spacing=".6">ТЕТРАДЬ</text>
        ${T(title, 47, 51, 6.4, 7.6, ink, 800)}
        <rect x="42" y="104" width="42" height="2" rx="1" fill="#fff" opacity=".35"/>${rings}`
        }
    },
    notepad: {
        label: "Блокнот",
        draw(p, c) {
            let rings = ""
            for (let i = 0; i < 7; i++) rings += `<rect x="${35.8 + i * 7.4}" y="16" width="4.4" height="13" rx="2.2" fill="none" stroke="#BFC4CE" stroke-width="2"/>`
            return `<rect x="30" y="24" width="60" height="98" rx="5" fill="${c}"/>
        <rect x="30" y="24" width="60" height="15" rx="5" fill="#000" opacity=".2"/>${rings}
        <rect x="38" y="52" width="44" height="28" rx="3" fill="${paper}"/>
        ${T(wrap(plain(p.name), 11, 2), 43, 64, 6.2, 7.6, ink, 800)}
        <rect x="38" y="104" width="44" height="2" rx="1" fill="#fff" opacity=".35"/>`
        }
    },
    bookmark: {
        label: "Закладка",
        draw: (p, c) => `<path d="M60 9c-7 5-9 10-7 16" fill="none" stroke="#B7BCC7" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M44 22h32v98l-16-13-16 13z" fill="${c}"/>
        <path d="M44 22h32v98l-16-13-16 13z" fill="none" stroke="#000" stroke-opacity=".1"/>
        <circle cx="60" cy="31" r="3.2" fill="var(--cover-bg)"/>
        <rect x="48.5" y="42" width="2.6" height="58" rx="1.3" fill="#fff" opacity=".26"/>
        ${rhomb(62, 56, 7, "#fff", 1.8, 'stroke-opacity=".8"')}
        <rect x="56" y="72" width="12" height="2.2" rx="1.1" fill="#fff" opacity=".5"/><rect x="56" y="78" width="12" height="2.2" rx="1.1" fill="#fff" opacity=".5"/><rect x="56" y="84" width="8" height="2.2" rx="1.1" fill="#fff" opacity=".5"/>`
    },
    pen: {
        label: "Ручка",
        draw: (p, c) => `<g transform="rotate(32 60 70)">
        <rect x="54" y="18" width="12" height="76" rx="4" fill="${c}"/>
        <rect x="54" y="18" width="12" height="13" rx="4" fill="#000" opacity=".25"/>
        <rect x="64.5" y="22" width="3" height="30" rx="1.5" fill="#B7BCC7"/>
        <rect x="56" y="36" width="2.4" height="52" rx="1.2" fill="#fff" opacity=".3"/>
        <path d="M54 94h12l-4 16h-4z" fill="#C9CED8"/><path d="M58 110h4l-2 8z" fill="${ink}"/>
      </g>`
    },
    postcard: {
        label: "Открытка",
        draw: (p, c) => `<g transform="rotate(-5 60 70)">
        <rect x="16" y="38" width="88" height="62" rx="4" fill="${paper}"/>
        <rect x="16" y="38" width="88" height="62" rx="4" fill="none" stroke="#000" stroke-opacity=".1"/>
        <rect x="21" y="43" width="38" height="52" rx="2" fill="${c}"/>
        <circle cx="48" cy="55" r="6" fill="#fff" opacity=".55"/>
        <path d="M21 95l13-18 9 10 7-7 9 15z" fill="#fff" opacity=".3"/>
        <rect x="86" y="44" width="12" height="14" rx="1.5" fill="none" stroke="${c}" stroke-width="1.6"/>
        <rect x="66" y="68" width="32" height="2.4" rx="1.2" fill="#000" opacity=".12"/><rect x="66" y="76" width="32" height="2.4" rx="1.2" fill="#000" opacity=".12"/><rect x="66" y="84" width="22" height="2.4" rx="1.2" fill="#000" opacity=".12"/>
      </g>`
    },
    poster: {
        label: "Плакат",
        draw: (p, c) => `<rect x="26" y="14" width="68" height="104" rx="2" fill="${paper}"/>
        <rect x="26" y="14" width="68" height="104" rx="2" fill="none" stroke="#000" stroke-opacity=".1"/>
        <rect x="32" y="20" width="56" height="58" fill="${c}"/>
        <circle cx="60" cy="49" r="16" fill="#fff" opacity=".2"/>${rhomb(60, 49, 11, "#fff", 2, 'stroke-opacity=".85"')}
        ${T(wrap(plain(p.name).toUpperCase(), 13, 2), 33, 90, 6.2, 8, ink, 800)}
        <rect x="33" y="108" width="26" height="2.4" rx="1.2" fill="#000" opacity=".14"/>
        <circle cx="31" cy="18" r="2.4" fill="#B6493C"/><circle cx="89" cy="18" r="2.4" fill="#B6493C"/>`
    },
    calendar: {
        label: "Календарь",
        draw(p, c) {
            let cells = ""
            for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) cells += `<rect x="${32 + k * 11.6}" y="${58 + r * 13.5}" width="8" height="9" rx="2" fill="${r === 1 && k === 2 ? c : "#000"}" ${r === 1 && k === 2 ? "" : 'opacity=".1"'}/>`
            return `<rect x="24" y="26" width="72" height="92" rx="7" fill="${paper}"/>
        <rect x="24" y="26" width="72" height="92" rx="7" fill="none" stroke="#000" stroke-opacity=".1"/>
        <path d="M24 33a7 7 0 0 1 7-7h58a7 7 0 0 1 7 7v16H24z" fill="${c}"/>
        <rect x="40" y="18" width="5" height="16" rx="2.5" fill="#B7BCC7"/><rect x="75" y="18" width="5" height="16" rx="2.5" fill="#B7BCC7"/>
        <text x="60" y="44" font-size="7.4" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing=".8">${esc((String(p.name || "").match(/20\d\d/) || ["2027"])[0])}</text>${cells}`
        }
    },
    keytag: { label: "Брелок", draw: (p, c, own) => keytagSVG(p, c, own) },
    medal: {
        label: "Жетон / медаль",
        draw: (p, c) => `<path d="M46 12h12l8 36H54z" fill="${c}"/><path d="M74 12H62l-8 36h12z" fill="${c}" opacity=".72"/>
        <circle cx="60" cy="84" r="30" fill="#D9B45A"/>
        <circle cx="60" cy="84" r="30" fill="none" stroke="#000" stroke-opacity=".12"/>
        <circle cx="60" cy="84" r="23" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
        ${rhomb(60, 84, 14, "#7A5A12", 2.4)}
        <path d="M40 72a24 24 0 0 1 14-13" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>`
    },
    badge: {
        label: "Значок",
        draw: (p, c) => `<circle cx="60" cy="70" r="36" fill="${c}"/>
        <circle cx="60" cy="70" r="36" fill="none" stroke="#000" stroke-opacity=".12"/>
        <circle cx="60" cy="70" r="28" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.4"/>
        ${rhomb(60, 70, 15, "#fff", 3)}
        <path d="M35 56a28 28 0 0 1 16-15" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>`
    },
    stickers: {
        label: "Наклейки",
        draw: (p, c) => `<path d="M34 18h52a8 8 0 0 1 8 8v78l-14 14H34a8 8 0 0 1-8-8V26a8 8 0 0 1 8-8z" fill="${paper}"/>
        <path d="M34 18h52a8 8 0 0 1 8 8v78l-14 14H34a8 8 0 0 1-8-8V26a8 8 0 0 1 8-8z" fill="none" stroke="#000" stroke-opacity=".1"/>
        <path d="M94 104H86a6 6 0 0 0-6 6v8z" fill="#E7E0D0"/>
        <circle cx="46" cy="42" r="13" fill="${c}"/>${rhomb(46, 42, 6, "#fff", 1.6, 'stroke-opacity=".8"')}
        <rect x="64" y="30" width="24" height="24" rx="7" fill="${c}" opacity=".55"/>
        <path d="M36 72h22a8 8 0 0 1 0 16H36a8 8 0 0 1 0-16z" fill="${c}" opacity=".8"/>
        <path d="M77 66l4.4 8.6 9.6 1.4-7 6.6 1.7 9.4-8.7-4.5-8.7 4.5 1.7-9.4-7-6.6 9.6-1.4z" fill="#D9B45A"/>`
    },
    mug: {
        label: "Кружка",
        draw: (p, c) => `<path d="M82 60h6a12 12 0 0 1 0 24h-6" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
        <path d="M34 48h50v48a14 14 0 0 1-14 14H48a14 14 0 0 1-14-14z" fill="${c}"/>
        <ellipse cx="59" cy="48" rx="25" ry="5" fill="#000" opacity=".22"/>
        <rect x="40" y="58" width="4" height="36" rx="2" fill="#fff" opacity=".28"/>
        <path d="M50 37c-4-6 4-8 0-14M63 37c-4-6 4-8 0-14" fill="none" stroke="#B7BCC7" stroke-width="2.4" stroke-linecap="round"/>
        ${rhomb(60, 78, 9, "#fff", 2, 'stroke-opacity=".75"')}`
    },
    bag: {
        label: "Сумка",
        draw: (p, c) => `<path d="M44 52c0-24 32-24 32 0" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" opacity=".7"/>
        <path d="M30 48h60l-5 68a6 6 0 0 1-6 5H41a6 6 0 0 1-6-5z" fill="${c}"/>
        <path d="M30 48h60l-.8 10H30.8z" fill="#000" opacity=".18"/>
        <rect x="46" y="70" width="28" height="26" rx="3" fill="#fff" opacity=".92"/>${rhomb(60, 83, 8, c, 2)}`
    },
    candle: {
        label: "Свеча",
        draw: (p, c) => `<path d="M60 20c7 9 9 14 9 19a9 9 0 0 1-18 0c0-5 2-10 9-19z" fill="#F2C200"/>
        <path d="M60 31c3 4 4 6 4 9a4 4 0 0 1-8 0c0-3 1-5 4-9z" fill="#FF8A1A"/>
        <rect x="59" y="46" width="2" height="10" fill="${ink}"/>
        <ellipse cx="60" cy="118" rx="24" ry="4" fill="#C9CED8"/>
        <rect x="44" y="56" width="32" height="60" rx="5" fill="${c}"/>
        <path d="M44 61a5 5 0 0 1 5-5h22a5 5 0 0 1 5 5v7c-5 3-8-2-12 1s-8 4-11 0-6-1-9 1z" fill="#fff" opacity=".32"/>
        <rect x="49" y="74" width="3.4" height="36" rx="1.7" fill="#fff" opacity=".25"/>`
    },
    box: {
        label: "Набор в коробке",
        draw: (p, c) => `<rect x="40" y="30" width="14" height="42" rx="2" fill="#2C3E9E" transform="rotate(-6 47 50)"/>
        <rect x="56" y="25" width="13" height="46" rx="2" fill="#0E8F80"/>
        <rect x="71" y="34" width="12" height="36" rx="6" fill="#E8902B" transform="rotate(8 77 52)"/>
        <path d="M24 62h72v48a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6z" fill="${c}"/>
        <path d="M24 62h72v9H24z" fill="#000" opacity=".2"/>
        <rect x="40" y="82" width="40" height="20" rx="3" fill="${paper}"/>
        <text x="60" y="95" font-size="6.6" font-weight="800" fill="${ink}" text-anchor="middle" letter-spacing=".6">${esc(wrap(String(p.name || "").toUpperCase(), 9, 1)[0] || "НАБОР")}</text>`
    },
    cards: {
        label: "Карточки",
        draw: (p, c) => `<rect x="30" y="30" width="62" height="84" rx="6" fill="#C9CCD6" transform="rotate(-9 60 72)"/>
        <rect x="30" y="30" width="62" height="84" rx="6" fill="#E9EAF0" transform="rotate(-3 60 72)"/>
        <rect x="30" y="30" width="62" height="84" rx="6" fill="${c}" transform="rotate(4 60 72)"/>
        <g transform="rotate(4 60 72)">${T(wrap(String(p.name || "").toUpperCase(), 10, 2), 37, 50, 6.6, 9, "#fff", 800)}<rect x="37" y="96" width="30" height="2.4" rx="1.2" fill="#fff" opacity=".5"/></g>`
    }
}

/** Тип обложки вида: настройка местности или значение по умолчанию. */
// Ключи — данные пользователей: вид или тип «constructor» не должен находить свойства прототипа.
const has = (o, k) => !!o && Object.hasOwn(o, k)
export const kindCover = (kind, kindCovers = {}) => {
    const t = has(kindCovers, kind) ? kindCovers[kind] : null
    return has(COVERS, t) ? t : has(KIND_COVER, kind) ? KIND_COVER[kind] : "box"
}

/** Тип обложки товара: по виду; «твёрдая» книга и «карточки» узнаются по названию. type — принудительно (предпросмотр). */
export const coverType = (p, kindCovers = {}, type) => {
    if (type) return has(COVERS, type) ? type : "box"
    const t = kindCover(p.category, kindCovers)
    if (t === "book" && /тверд/i.test(p.name)) return "hardbook"
    if (t === "box" && /карточ/i.test(p.name)) return "cards"
    return t
}

const HEX = /^#[0-9a-f]{6}$/i
const defaultColor = (p, t) => {
    const h = hash(p._id)
    const name = String(p.name || "")
    if (t === "keytag") return (KEYTAG.find((x) => x[0].test(name)) || [0, "#17181D"])[1]
    if (t === "book" || t === "hardbook") return BOOKS[h % BOOKS.length]
    if (t === "booklet") return p.category === "БУ" ? "#2F7D5B" : ["#0E8F80", "#127A9E", "#0B6E62"][h % 3]
    if (t === "leaflet") return IPC[(+(name.match(/IP\s*#\s*(\d+)/i) || [])[1] || h) % IPC.length]
    return { notebook: "#A23B72", brochure: "#4F6D8F", cards: "#3A3D4A", box: "#3A3D4A" }[t] || PAL[h % PAL.length]
}
// Цвет приходит с сервера и попадает в разметку: принимаем только #RRGGBB.
const ownColor = (p, color) => [color, p.coverColor].find((c) => HEX.test(c || "")) || ""

/** Цвет подложки обложки (и цвет вида в списках). */
export const coverColor = (p, { kindCovers, type, color } = {}) => {
    const c = ownColor(p, color) || defaultColor(p, coverType(p, kindCovers, type))
    return c === "#F3F2EE" ? "#8A8F9E" : c === "#DDF7C2" ? "#6BBF3A" : c
}

/** Рисунок обложки строкой SVG. */
export const coverSVG = (p, { kindCovers, type, color } = {}) => {
    const t = coverType(p, kindCovers, type)
    const own = ownColor(p, color)
    return `<svg viewBox="0 0 120 140" aria-hidden="true" focusable="false" font-family="Jost, sans-serif"><ellipse cx="60" cy="130" rx="36" ry="5" fill="#000" opacity=".13"/>${COVERS[t].draw(p, own || defaultColor(p, t), !!own)}</svg>`
}

const normName = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/["«»]/g, "")
        .replace(/\s+/g, " ")
        .trim()
/** Настоящая обложка из набора public/covers — по названию товара. */
export const stockCover = (p) => {
    const k = normName(p?.name)
    const id = has(STOCK_COVERS, k) && STOCK_COVERS[k]
    return id ? `/covers/${id}.webp` : null
}

/** Фото, загруженное на сервер: в товаре лежит неугадываемый ключ, картинка отдаётся без авторизации и кэшируется навсегда. */
export const photoUrl = (p) => (/^[a-f0-9]{16,64}$/i.test(p?.photo || "") ? `/api/products/photo/${p.photo}` : null)
