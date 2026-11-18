/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Разбор метрик сервера: снимок GET /observability/live и точки GET /observability/history (перенесено из Observability.vue).
// В точках истории только метрики HISTORY_METRICS (skladan snapshot.service.ts) — новую метрику для графика добавить туда.

export const MB = 1048576

export function metricByPrefix(payload, prefix) {
    if (!payload) return null
    if (payload[prefix] != null) return payload[prefix]
    const key = Object.keys(payload).find((k) => k.startsWith(prefix + "{"))
    return key ? payload[key] : null
}
/** Сумма по меткам (по компаниям). Ключи `name{…}_peak_5m` не считаются: они есть в полной первой точке истории. */
export function sumByPrefix(payload, prefix) {
    if (!payload) return 0
    if (payload[prefix] != null) return payload[prefix]
    let sum = 0
    for (const k in payload) if (k.startsWith(prefix + "{") && k.endsWith("}")) sum += Number(payload[k] || 0)
    return sum
}
export function parseLabels(s) {
    const out = {}
    if (!s) return out
    for (const pair of s.split(",")) {
        const i = pair.indexOf("=")
        if (i >= 0) out[pair.slice(0, i)] = pair.slice(i + 1)
    }
    return out
}

/** min / avg / max по ряду; null и NaN пропускаются. */
export function stats(arr) {
    let min = Infinity
    let max = -Infinity
    let sum = 0
    let cnt = 0
    for (const v of arr) {
        if (typeof v !== "number" || Number.isNaN(v)) continue
        if (v < min) min = v
        if (v > max) max = v
        sum += v
        cnt++
    }
    return cnt ? { min, avg: sum / cnt, max } : { min: null, avg: null, max: null }
}

const CPU = [
    ["process_cpu_user_seconds_total", "cpuUser"],
    ["process_cpu_system_seconds_total", "cpuSystem"]
]

/**
 * Все ряды истории за один проход по точкам. CPU — сек/мин между соседними точками: для графика перезапуск
 * (счётчик пошёл вниз) — разрыв линии, для min/avg/max — ноль, как было.
 */
export function buildHistory(points) {
    const h = { at: [], rss: [], heapUsed: [], heapTotal: [], external: [], lag: [], lagPeak: [], sse: [], users: [], mongoUsed: [], mongoMax: [], handles: [], requests: [], fds: [], cpuUser: [], cpuSystem: [], cpuUserStat: [], cpuSystemStat: [] }
    for (let i = 0; i < points.length; i++) {
        const p = points[i].payload || {}
        const at = new Date(points[i].at).getTime()
        h.at.push(at)
        h.rss.push((metricByPrefix(p, "process_resident_memory_bytes") || 0) / MB)
        h.heapUsed.push((metricByPrefix(p, "nodejs_heap_size_used_bytes") || 0) / MB)
        h.heapTotal.push((metricByPrefix(p, "nodejs_heap_size_total_bytes") || 0) / MB)
        h.external.push((metricByPrefix(p, "nodejs_external_memory_bytes") || 0) / MB)
        h.lag.push(metricByPrefix(p, "skladan_event_loop_lag_ms") || 0)
        h.lagPeak.push(p["skladan_event_loop_lag_ms_peak_5m"] || 0)
        h.sse.push(sumByPrefix(p, "skladan_sse_connections_active"))
        h.users.push(sumByPrefix(p, "skladan_active_users_15m"))
        h.mongoUsed.push(metricByPrefix(p, "skladan_mongo_pool_used") || 0)
        h.mongoMax.push(metricByPrefix(p, "skladan_mongo_pool_max") || 0)
        h.handles.push(metricByPrefix(p, "nodejs_active_handles_total") || 0)
        h.requests.push(metricByPrefix(p, "nodejs_active_requests_total") || 0)
        h.fds.push(metricByPrefix(p, "process_open_fds") || 0)
        for (const [key, name] of CPU) {
            if (i === 0) {
                h[name].push(null)
                continue
            }
            const prev = Number(points[i - 1].payload?.[key] || 0)
            const cur = Number(p[key] || 0)
            const dt = (at - h.at[i - 1]) / 1000
            h[name].push(dt > 0.5 && cur >= prev ? ((cur - prev) / dt) * 60 : null)
            if (dt > 0.5) h[name + "Stat"].push((Math.max(0, cur - prev) / dt) * 60)
        }
    }
    return h
}

/** Доля запросов быстрее q по накопительным корзинам гистограммы, с линейной интерполяцией внутри корзины. */
function percentile(buckets, count, q) {
    if (!buckets.length) return null
    const target = q * count
    let lower = { le: 0, value: 0 }
    for (const b of buckets) {
        if (b.value >= target) {
            if (b.le === Infinity) return lower.le > 0 ? lower.le : null
            const range = b.value - lower.value
            if (range <= 0) return b.le
            return lower.le + (b.le - lower.le) * ((target - lower.value) / range)
        }
        lower = b
    }
    return buckets[buckets.length - 1]?.le ?? null
}

const HTTP = /^(http_request_duration_seconds_bucket|http_request_duration_seconds_count|http_request_duration_seconds_sum|http_request_duration_seconds|http_requests_total)\{(.+)\}$/

/**
 * Маршруты API из снимка: число запросов, среднее, p50/p95/p99 (сек), по убыванию числа запросов.
 * delta — запросов за окно истории: разница со счётчиком в первой точке истории (null — истории нет).
 */
export function httpRows(payload, first) {
    const groups = new Map()
    for (const [k, v] of Object.entries(payload || {})) {
        const m = k.match(HTTP)
        if (!m) continue
        const labels = parseLabels(m[2])
        const key = `${labels.method}|${labels.route}|${labels.status}`
        let g = groups.get(key)
        if (!g) groups.set(key, (g = { method: labels.method, route: labels.route, status: labels.status, buckets: [], count: 0, sum: 0, hasSum: false }))
        const kind = m[1]
        if (kind === "http_request_duration_seconds_bucket" || (kind === "http_request_duration_seconds" && labels.le !== undefined)) g.buckets.push({ le: labels.le === "+Inf" ? Infinity : Number(labels.le), value: Number(v) })
        else if (kind === "http_request_duration_seconds_sum") {
            g.sum = Number(v)
            g.hasSum = true
        } else g.count = Math.max(g.count, Number(v))
    }
    const rows = []
    for (const g of groups.values()) {
        if (g.count === 0) continue
        g.buckets.sort((a, b) => a.le - b.le)
        let delta = null
        if (first) {
            const d = g.count - Number(first[`http_requests_total{method=${g.method},route=${g.route},status=${g.status}}`] || 0)
            delta = d >= 0 ? d : g.count
        }
        rows.push({
            method: g.method,
            route: g.route,
            status: g.status,
            count: g.count,
            avg: g.hasSum ? g.sum / g.count : null,
            p50: percentile(g.buckets, g.count, 0.5),
            p95: percentile(g.buckets, g.count, 0.95),
            p99: percentile(g.buckets, g.count, 0.99),
            delta
        })
    }
    return rows.sort((a, b) => b.count - a.count)
}

/* ---------- Подсветка: ok | warn | crit, строго по выбранному окну истории ---------- */
const lvl = (crit, warn) => (crit ? "crit" : warn ? "warn" : "ok")
/** Пороги RSS: 70 % и 85 % бюджета backend; без бюджета (или меньше 200 MB) — 500 и 750 MB. */
export const rssThresholds = (budgetMb) => (!budgetMb || budgetMb < 200 ? { warn: 500, crit: 750 } : { warn: Math.round(budgetMb * 0.7), crit: Math.round(budgetMb * 0.85) })
export const sevRss = (max, t) => (max == null ? "ok" : lvl(max > t.crit, max > t.warn))
export const sevLag = (avg, peak) => lvl((avg != null && avg > 100) || (peak != null && peak > 500), (avg != null && avg > 50) || (peak != null && peak > 100))
export const sevMongo = (avgUsed, max) => (!max || max <= 0 || avgUsed == null ? "ok" : lvl(avgUsed / max >= 0.9, avgUsed / max >= 0.6))
export const sevHttp = (r) => (!r.p50 || !r.p95 || r.count < 1000 ? "ok" : lvl(r.p95 / r.p50 >= 20, r.p95 / r.p50 >= 10))
export const sevHandles = (cur, s) => (!s || !(s.min > 0) ? "ok" : lvl(cur / s.min >= 5 && s.max >= 50, cur / s.min >= 2.5 && s.max >= 30))
export const sevSse = (maxSse, maxUsers) => (!maxSse || !maxUsers ? "ok" : lvl(maxSse / maxUsers > 5, maxSse / maxUsers > 2.5))
export const sevCpu = (s) => lvl((s.max != null && s.max >= 54) || (s.avg != null && s.avg >= 54), (s.max != null && s.max >= 36) || (s.avg != null && s.avg >= 36))
export const worst = (...l) => (l.includes("crit") ? "crit" : l.includes("warn") ? "warn" : "ok")

/* ---------- Подписи ---------- */
export const fmt = (n, d = 1) => (n == null || Number.isNaN(n) ? "–" : Number(n).toFixed(d))
export const fmtInt = (n) => (n == null || Number.isNaN(n) ? "–" : String(Math.round(n)))
export const fmtMs = (s) => (s == null ? "–" : (s * 1000).toFixed(1) + " ms")
export const range = (s, d) => (s.min == null ? "" : d == null ? `мин ${fmtInt(s.min)} · сред ${fmtInt(s.avg)} · макс ${fmtInt(s.max)}` : `мин ${fmt(s.min, d)} · сред ${fmt(s.avg, d)} · макс ${fmt(s.max, d)}`)
export function uptime(seconds) {
    if (seconds == null || seconds < 0) return "–"
    const s = Math.floor(seconds)
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (d > 0) return `${d} дн ${h} ч ${m} мин`
    if (h > 0) return `${h} ч ${m} мин`
    if (m > 0) return `${m} мин ${s % 60} сек`
    return `${s % 60} сек`
}

/* ---------- Справка по метрике (окно /observability/help/:k): [заголовок, текст] ---------- */
export const HELP = {
    rss: [
        "Память процесса",
        "Resident Set Size — физическая RAM, которую процесс backend держит у системы прямо сейчас. Включает JS heap, native Buffer, V8 код, подгруженные библиотеки. То же, что docker stats показывает как memory usage.\n\n" +
            "Норма: пилообразный график (растёт → GC → падает), среднее стабильно неделями. Тревожно: монотонный рост среднего каждую неделю на 10–20 % — утечка в коде; лечится не железом, а heap snapshot и правкой кода. Если стабильно высокий и упирается в лимит хоста — пора больше RAM.\n\n" +
            "Жёлтым — от 70 % бюджета, красным — от 85 % (по максимуму за окно). Бюджет — лимит контейнера, если он есть, иначе половина RAM хоста, не больше 2 GB; без бюджета пороги 500 и 750 MB."
    ],
    heapUsed: ["JS heap used", "Сколько памяти под объекты JavaScript (объекты, массивы, строки) занято прямо сейчас. V8 garbage collector регулярно чистит этот блок. Это часть RSS — RSS включает ещё native heap, code, libraries поверх JS heap."],
    heapTotal: [
        "JS heap total",
        "Сколько V8 зарезервировал под heap (всегда ≥ heap used). Растёт, когда heap used приближается к лимиту. Лимит V8 по умолчанию — около 1,5 GB на 64-bit (можно увеличить через --max-old-space-size). При превышении лимита процесс падает с FATAL ERROR."
    ],
    external: ["External memory", "Native объекты вне V8 heap — Buffer (бинарные данные), ArrayBuffer от async I/O, буферы соединений mongoose, данные web-push. Считается отдельно от JS heap, но тоже занимает RAM (входит в RSS)."],
    cpuUserLive: [
        "CPU user / мин",
        "Сколько CPU-секунд процесс потратил на свой код за последнюю минуту: разница накопительного счётчика между двумя замерами.\n\n" +
            "60 сек/мин = 100 % одного ядра. Node.js однопоточный, поэтому потолок — 60 для одного процесса, даже если ядер 8.\n\n" +
            "Жёлтым — от 36 (60 % ядра), красным — от 54 (90 %), по среднему или максимуму за окно. При красном: быстрее CPU или cluster mode."
    ],
    cpuSystemLive: [
        "CPU system / мин",
        "CPU-секунды на системные вызовы (I/O, сеть, файловая система). Растёт при активных запросах к базе, работе с файлами, синхронном I/O. Высокое значение — узкое место на уровне ОС (медленный диск, сеть).\n\n" +
            "Та же шкала, что у user: 60 сек/мин = 100 % одного ядра. Жёлтым — от 36, красным — от 54."
    ],
    cpuUserCum: ["CPU user (cumulative)", "Накопленные секунды CPU user-режима с момента старта процесса. Только растёт.\n\nСам по себе мало что говорит — важен наклон графика, он и показан в «CPU user / мин» и на графике CPU."],
    cpuSystemCum: ["CPU system (cumulative)", "Накопленные секунды CPU system-режима с момента старта. Только растёт. Как и у CPU user (cumulative), важен наклон, а не значение."],
    eventLoop: [
        "Event loop lag",
        "Задержка между готовым callback'ом и его выполнением. Event loop — единственный поток Node.js, выполняющий код. Если задержка больше 50 ms — Node не успевает обрабатывать события вовремя, пользователи замечают тормоза.\n\n" +
            "Норма: меньше 5 ms почти всегда, пики меньше 20 ms редко. «Пик за 5 минут» — максимум между точками истории: короткие всплески, которые не попали в момент замера.\n\n" +
            "Жёлтым — среднее больше 50 ms или пик больше 100 ms, красным — среднее больше 100 ms или пик больше 500 ms. Лечение: профилировать горячий код (node --prof), убрать sync I/O, ускорить тяжёлые агрегации Mongo; если код оптимален — быстрее CPU или cluster mode."
    ],
    openFds: [
        "Open file descriptors",
        "Сколько файловых дескрипторов процесс открыл (TCP-сокеты, файлы, pipes). Лимит ulimit в Linux по умолчанию — 1024 на процесс. При превышении новые соединения отказываются (EMFILE), существующие работают и постепенно освобождают слоты.\n\nДоступно только на Linux — на Windows показывает «–»."
    ],
    activeHandles: [
        "Active handles",
        "Сколько активных «handles» держит libuv: TCP-сокеты, Server, Timer, FSEvent и т. п. Норма: 10–50.\n\n" +
            "Тревожно: монотонный рост без падения после GC — утечка. Источники: незакрытые SSE/WebSocket, забытые setInterval без clearInterval, http.Agent с keepAlive и большим maxSockets.\n\n" +
            "Жёлтым — текущее больше 2,5× минимума за окно (при максимуме от 30), красным — больше 5× (при максимуме от 50). При красном: снять heap snapshot, искать объекты Socket / TLSSocket."
    ],
    activeRequests: ["Active requests", "Активные I/O-запросы в полёте: операции Mongo, HTTP-запросы, чтение файлов. Норма 0–5. Если постоянно высокое — backend перегружен запросами и не успевает их обработать."],
    mongoPool: [
        "MongoDB pool",
        "Сколько соединений с Mongo используется сейчас и сколько можно. Used — db.command({ serverStatus: 1 }).connections.current: точное число от Mongo по всем клиентам сервера. Max — узкое место: min(maxPoolSize клиента, maxIncomingConnections Mongo).\n\n" +
            "Норма: в среднем меньше 30 % от max. Жёлтым — среднее за окно от 60 %, красным — от 90 %. При 100 % новые запросы падают с MongoServerSelectionError через 5 сек; короткий пик можно переждать. Лечение: поднять maxPoolSize или, если нагружен сам Mongo, — железо для базы (SSD, RAM, IOPS)."
    ],
    sse: [
        "SSE подключения",
        "Активные каналы Server-Sent Events — долгие HTTP-подключения, через которые backend присылает обновления на лету (новые заказы, изменения). Один канал на вкладку браузера, норма — 1–2 на активного пользователя.\n\n" +
            "Жёлтым — максимум подключений за окно больше 2,5 на активного пользователя, красным — больше 5: зомби-вкладки или EventSource, который не закрывается. Каждый канал — дескриптор файла, при 1000+ упрёмся в ulimit."
    ],
    users: ["Активные пользователи", "За последние 15 минут."],
    err: ["Ошибки сервера", "Ответы 5xx за выбранный период."],
    up: ["Работает без перезапуска", "С момента старта."],
    http: [
        "Самые частые запросы",
        "Топ-20 маршрутов API с момента старта процесса: число запросов, «за период» — сколько прошло за выбранное окно истории, среднее время и p50 / p95 / p99.\n\n" +
            "Жёлтым — p95 больше p50 в 10 раз и более (длинный хвост задержек) при 1000+ запросах, красным — в 20 раз и более. При красном: медленная агрегация или нет индекса."
    ]
}
