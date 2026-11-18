<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { num } from "@/domain/format"
import axiosInstance from "@/service/axios"
import { UiEmpty, UiError, UiIconBtn, UiPage, UiSeg, UiSk } from "@/ui"
import { useQuery } from "@tanstack/vue-query"
import { computed, onBeforeUnmount, ref, watch } from "vue"
import MetricChart from "./MetricChart.vue"
import { buildHistory, fmt, fmtMs, httpRows, MB, metricByPrefix, parseLabels, range, rssThresholds, sevCpu, sevHandles, sevHttp, sevLag, sevMongo, sevRss, sevSse, stats, sumByPrefix, uptime, worst } from "./metrics"

// Снимок — раз в 5 секунд, история — раз в 30 секунд (cron пишет точку в базу раз в 5 минут, хранится 14 дней).
const live = useQuery({
    queryKey: ["observability-live"],
    queryFn: async () => (await axiosInstance.get("/observability/live")).data,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    staleTime: 4000
})
const hours = ref(24)
const hist = useQuery({
    queryKey: ["observability-history", hours],
    queryFn: async () => (await axiosInstance.get("/observability/history", { params: { hours: hours.value } })).data,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 20000
})
const WINDOWS = [
    { value: 24, label: "24 часа" },
    { value: 168, label: "7 дней" },
    { value: 336, label: "14 дней" }
]
const windowLabel = computed(() => WINDOWS.find((w) => w.value === hours.value).label)

const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(timer))
const ago = computed(() => {
    const sec = Math.max(0, Math.floor((now.value - live.dataUpdatedAt.value) / 1000))
    return sec < 60 ? `${sec} сек назад` : `${Math.floor(sec / 60)} мин ${sec % 60} сек назад`
})

/* ---------- Снимок ---------- */
const snap = computed(() => live.data.value)
const p = computed(() => snap.value?.payload || {})
const mb = (name) => Math.round((metricByPrefix(p.value, name) || 0) / MB)
// CPU за минуту — по разнице накопительных счётчиков между двумя соседними снимками.
const cpuLive = ref({ user: null, system: null })
let prevSnap = null
watch(snap, (cur) => {
    if (!cur) return
    if (prevSnap && cur.createdAt !== prevSnap.createdAt) {
        const dt = (new Date(cur.createdAt) - new Date(prevSnap.createdAt)) / 1000
        if (dt > 0.1) {
            const d = (k) => (cur.payload[k] || 0) - (prevSnap.payload[k] || 0)
            const u = d("process_cpu_user_seconds_total")
            const s = d("process_cpu_system_seconds_total")
            cpuLive.value = { user: u >= 0 ? (u / dt) * 60 : null, system: s >= 0 ? (s / dt) * 60 : null }
        }
    }
    prevSnap = cur
})
const host = computed(() => {
    const v = (kind) => Number(p.value[`skladan_host_info{kind=${kind}}`] || 0)
    const toMb = (b) => (b > 0 ? Math.round(b / MB) : null)
    const verKey = Object.keys(p.value).find((k) => k.startsWith("nodejs_version_info{"))
    return { totalMb: toMb(v("total_memory_bytes")), budgetMb: toMb(v("memory_budget_bytes")), constrainedMb: toMb(v("constrained_memory_bytes")), cpu: v("cpu_count") || null, node: verKey ? parseLabels(verKey.slice(20, -1)).version : null }
})
const upSec = computed(() => {
    const start = p.value.process_start_time_seconds
    return start ? Math.max(0, now.value / 1000 - Number(start)) : null
})

/* ---------- История ---------- */
const points = computed(() => hist.data.value?.points || [])
const h = computed(() => buildHistory(points.value))
const st = computed(() => {
    const x = h.value
    return {
        rss: stats(x.rss),
        heapUsed: stats(x.heapUsed),
        heapTotal: stats(x.heapTotal),
        external: stats(x.external),
        lag: stats(x.lag),
        lagPeak: stats(x.lagPeak),
        sse: stats(x.sse),
        users: stats(x.users),
        mongo: stats(x.mongoUsed),
        handles: stats(x.handles),
        requests: stats(x.requests),
        fds: stats(x.fds),
        cpuUser: stats(x.cpuUserStat),
        cpuSystem: stats(x.cpuSystemStat)
    }
})
const routes = computed(() => httpRows(p.value, points.value[0]?.payload))
// Среднее есть, только если сервер отдал сумму времени (http_request_duration_seconds_sum).
const routeLine = (r) => [r.delta && `+${num(r.delta)} за ${windowLabel.value}`, r.avg != null && `сред ${fmtMs(r.avg)}`, `p50 ${fmtMs(r.p50)}`, `p99 ${fmtMs(r.p99)}`].filter(Boolean).join(" · ")
const errors5xx = computed(() => routes.value.reduce((a, r) => a + (String(r.status).startsWith("5") ? (r.delta ?? r.count) : 0), 0))

/* ---------- Подсветка ---------- */
const thr = computed(() => rssThresholds(host.value.budgetMb))
const handlesNow = computed(() => metricByPrefix(p.value, "nodejs_active_handles_total") || 0)
const mongoMax = computed(() => metricByPrefix(p.value, "skladan_mongo_pool_max") || 0)
const sev = computed(() => {
    const s = st.value
    return {
        rss: sevRss(s.rss.max, thr.value),
        lag: sevLag(s.lag.avg, s.lagPeak.max),
        mongo: sevMongo(s.mongo.avg, mongoMax.value),
        handles: sevHandles(handlesNow.value, s.handles),
        sse: sevSse(s.sse.max, s.users.max),
        cpuUser: sevCpu(s.cpuUser),
        cpuSystem: sevCpu(s.cpuSystem)
    }
})

/* ---------- Карточки ---------- */
const tiles = computed(() => {
    const s = st.value
    const l = sev.value
    const rss = mb("process_resident_memory_bytes")
    const budget = host.value.budgetMb
    const pct = budget ? Math.round((rss / budget) * 100) : null
    const lag = Math.round((metricByPrefix(p.value, "skladan_event_loop_lag_ms") || (metricByPrefix(p.value, "nodejs_eventloop_lag_seconds") || 0) * 1000 || 0) * 10) / 10
    const sec = (name) => Math.round((metricByPrefix(p.value, name) || 0) * 10) / 10
    const hostLine = [
        host.value.node && `Node.js ${host.value.node}`,
        host.value.cpu && `${host.value.cpu} vCPU`,
        host.value.totalMb && `host ${host.value.totalMb} MB RAM` + (host.value.constrainedMb ? ` (контейнер ${host.value.constrainedMb} MB)` : "")
    ]
        .filter(Boolean)
        .join(" · ")
    return [
        { k: "rss", t: "Память", v: rss, u: "MB", sub: pct != null ? `${pct}% бюджета ${budget} MB` : range(s.rss), note: pct != null ? range(s.rss) : "", l: l.rss, bar: pct },
        { k: "heapUsed", t: "JS heap used", v: mb("nodejs_heap_size_used_bytes"), u: "MB", sub: range(s.heapUsed) },
        { k: "heapTotal", t: "JS heap total", v: mb("nodejs_heap_size_total_bytes"), u: "MB", sub: range(s.heapTotal) },
        { k: "external", t: "External memory", v: mb("nodejs_external_memory_bytes"), u: "MB", sub: range(s.external) },
        { k: "cpuUserLive", t: "CPU user / мин", v: fmt(cpuLive.value.user), u: "сек/мин", sub: range(s.cpuUser, 1), l: l.cpuUser },
        { k: "cpuSystemLive", t: "CPU system / мин", v: fmt(cpuLive.value.system), u: "сек/мин", sub: range(s.cpuSystem, 1), l: l.cpuSystem },
        { k: "cpuUserCum", t: "CPU user (cumulative)", v: sec("process_cpu_user_seconds_total"), u: "сек", sub: "с момента старта" },
        { k: "cpuSystemCum", t: "CPU system (cumulative)", v: sec("process_cpu_system_seconds_total"), u: "сек", sub: "с момента старта" },
        { k: "eventLoop", t: "Event loop lag", v: lag, u: "ms", sub: range(s.lag, 1), note: s.lagPeak.max != null ? `пик-окна: макс ${fmt(s.lagPeak.max)} ms` : "", l: l.lag },
        { k: "openFds", t: "Open file descriptors", v: metricByPrefix(p.value, "process_open_fds") ?? "–", sub: range(s.fds) },
        { k: "activeHandles", t: "Active handles", v: handlesNow.value, sub: range(s.handles), l: l.handles },
        { k: "activeRequests", t: "Active requests", v: metricByPrefix(p.value, "nodejs_active_requests_total") || 0, sub: range(s.requests) },
        { k: "mongoPool", t: "MongoDB pool", v: metricByPrefix(p.value, "skladan_mongo_pool_used") || 0, u: `/ ${mongoMax.value || "–"}`, sub: range(s.mongo), l: l.mongo },
        { k: "sse", t: "SSE подключения", v: sumByPrefix(p.value, "skladan_sse_connections_active"), sub: range(s.sse), l: l.sse },
        { k: "users", t: "Активны сейчас", v: sumByPrefix(p.value, "skladan_active_users_15m"), u: "чел.", sub: s.users.max != null ? `макс. ${s.users.max} за период` : "" },
        { k: "err", t: "Ошибки сервера", v: errors5xx.value, sub: "ответы 5xx за период", l: errors5xx.value ? "warn" : "ok" },
        { k: "up", t: "Без перезапуска", v: uptime(upSec.value), sub: hostLine }
    ]
})

/* ---------- Графики ---------- */
const mbFmt = (v) => `${Math.round(v)} MB`
const msFmt = (v) => `${fmt(v)} ms`
const cpuFmt = (v) => `${fmt(v)} сек/мин`
const charts = computed(() => {
    const x = h.value
    const l = sev.value
    return [
        {
            id: "mem",
            title: "Память, MB",
            wide: true,
            h: 200,
            l: l.rss,
            fmt: mbFmt,
            series: [
                { v: x.rss, tone: "primary", name: "RSS" },
                { v: x.heapUsed, tone: "teal", name: "JS heap used" },
                { v: x.heapTotal, tone: "warning", name: "JS heap total" }
            ]
        },
        {
            id: "lag",
            title: "Event loop, ms",
            l: l.lag,
            fmt: msFmt,
            series: [
                { v: x.lag, tone: "primary", name: "Event loop" },
                { v: x.lagPeak, tone: "warning", name: "Пик за 5 мин" }
            ]
        },
        {
            id: "cpu",
            title: "CPU, сек/мин",
            l: worst(l.cpuUser, l.cpuSystem),
            fmt: cpuFmt,
            series: [
                { v: x.cpuUser, tone: "primary", name: "CPU user" },
                { v: x.cpuSystem, tone: "warning", name: "CPU system" }
            ]
        },
        { id: "sse", title: "SSE подключения", note: "сумма по всем компаниям", l: l.sse, fill: true, fmt: num, series: [{ v: x.sse, tone: "primary", name: "" }] },
        { id: "users", title: "Активные пользователи", note: "окно 15 минут", l: "ok", fill: true, fmt: num, series: [{ v: x.users, tone: "teal", name: "" }] },
        {
            id: "mongo",
            title: "MongoDB pool",
            l: l.mongo,
            fmt: num,
            series: [
                { v: x.mongoUsed, tone: "primary", name: "Используется" },
                { v: x.mongoMax, tone: "warning", name: "Pool max" }
            ]
        },
        {
            id: "handles",
            title: "Active handles / requests",
            wide: true,
            l: l.handles,
            fmt: num,
            series: [
                { v: x.handles, tone: "primary", name: "Active handles" },
                { v: x.requests, tone: "teal", name: "Active requests" }
            ]
        }
    ]
})
</script>

<template>
    <UiPage v-if="live.isError.value && !snap" title="Метрики">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Метрики»" @retry="live.refetch()" /></div>
    </UiPage>
    <UiPage v-else-if="!snap" title="Метрики" sub="Загрузка снимка метрик…">
        <p class="loading-note" role="status"><span class="spin"></span>Загрузка снимка метрик…</p>
        <div class="mtiles">
            <div v-for="i in 7" :key="i" class="card mtile"><UiSk w="60%" :h="12" /><UiSk w="50%" :h="28" :r="8" /><UiSk w="70%" :h="12" /></div>
        </div>
    </UiPage>
    <UiPage v-else title="Метрики" :sub="`обновлено ${ago} · раз в 5 секунд`">
        <template #actions
            ><span class="live" aria-label="Обновляется вживую"><i></i>онлайн</span></template
        >
        <template #deskActions
            ><span class="live"><i></i>обновляется вживую</span><UiSeg v-model="hours" :options="WINDOWS" label="Окно истории"
        /></template>
        <div class="mobonly mtools"><UiSeg v-model="hours" :options="WINDOWS" label="Окно истории" /></div>

        <div class="mtiles">
            <div v-for="x in tiles" :key="x.k" class="card mtile" :class="'mtile--' + (x.l || 'ok')">
                <div class="mtile__h">
                    <small>{{ x.t }}</small
                    ><UiIconBtn icon="info" :label="'Что это: ' + x.t" :to="{ name: 'metrics-help', params: { k: x.k } }" :size="18" class="mtile__q" />
                </div>
                <b
                    >{{ x.l === "crit" ? "● " : x.l === "warn" ? "▲ " : "" }}{{ x.v }}<em v-if="x.u">{{ x.u }}</em></b
                >
                <span v-if="x.sub">{{ x.sub }}</span>
                <span v-if="x.note">{{ x.note }}</span>
                <span v-if="x.bar != null" class="bar" :class="'bar--' + x.l"><i :style="{ width: Math.min(100, x.bar) + '%' }"></i></span>
            </div>
        </div>

        <div class="sgrid">
            <section v-if="hist.isError.value && !hist.data.value" class="card sblk sblk--wide"><UiError title="Не удалось загрузить историю" @retry="hist.refetch()" /></section>
            <section v-else-if="hist.isPending.value" class="card sblk sblk--wide">
                <p class="loading-note" role="status"><span class="spin"></span>Загрузка истории…</p>
            </section>
            <section v-else-if="!points.length" class="card sblk sblk--wide"><UiEmpty art="box" title="История пуста" text="Первая запись будет добавлена в течение 5 минут после старта backend" /></section>
            <template v-else>
                <section v-for="c in charts" :key="c.id" class="card sblk" :class="{ 'sblk--wide': c.wide }">
                    <header class="sblk__h">
                        <h3>{{ c.title }}</h3>
                        <span v-if="c.l === 'crit'" class="tag tag--danger">● Критично</span>
                        <span v-else-if="c.l === 'warn'" class="tag tag--warning">▲ Внимание</span>
                        <span v-if="c.note" class="muted">{{ c.note }}</span>
                        <div v-if="c.series.length > 1" class="clegend">
                            <span v-for="s in c.series" :key="s.name"><i :class="'sw sw--' + s.tone"></i>{{ s.name }}</span>
                        </div>
                    </header>
                    <MetricChart :at="h.at" :series="c.series" :fill="c.fill" :long="hours > 48" :h="c.h || 180" :label="c.title" :fmt="c.fmt" />
                </section>
            </template>

            <section class="card sblk mlegend">
                <header class="sblk__h"><h3>Что означает подсветка</h3></header>
                <div class="mlegend__g">
                    <span class="mlg mlg--ok"><b>Норма</b>нейтральная карточка</span><span class="mlg mlg--warn"><b>▲ Внимание</b>тренд требует наблюдения</span><span class="mlg mlg--crit"><b>● Критично</b>действовать сейчас</span>
                </div>
                <p class="muted">Подсветка считается строго по выбранному окну ({{ windowLabel }}). Старые проблемы вне окна не светятся. История хранится 14 дней.</p>
            </section>

            <section class="card sblk sblk--wide">
                <header class="sblk__h">
                    <h3>Самые частые запросы</h3>
                    <span class="muted">с момента старта · p95</span>
                    <UiIconBtn icon="info" label="Что это: Самые частые запросы" :to="{ name: 'metrics-help', params: { k: 'http' } }" :size="18" class="mtile__q" />
                </header>
                <p v-if="!routes.length" class="muted">Пока не зафиксировано HTTP-запросов. Метрики появятся после первых обращений к API.</p>
                <div v-else class="mroutes">
                    <div v-for="r in routes.slice(0, 20)" :key="r.method + r.route + r.status" class="mroute" :class="'mroute--' + sevHttp(r)">
                        <span class="mroute__m" :class="'mroute__m--' + String(r.method).toLowerCase()">{{ r.method }}</span>
                        <code class="mroute__p"
                            >{{ r.route }} <span class="muted">· {{ r.status }}</span
                            ><br /><small class="muted">{{ routeLine(r) }}</small></code
                        >
                        <span class="mroute__n"
                            ><b>{{ num(r.count) }}</b
                            ><small>запросов</small></span
                        >
                        <span class="mroute__l"
                            ><b>{{ fmtMs(r.p95) }}</b
                            ><small>p95</small><span class="bar" :class="'bar--' + sevHttp(r)"><i :style="{ width: Math.min(100, ((r.p95 || 0) / 0.3) * 100) + '%' }"></i></span
                        ></span>
                    </div>
                </div>
            </section>
        </div>
        <p class="foot-note">
            <span>Сырой Prometheus-формат: <code>GET /api/observability/metrics</code> · Автор: <a href="https://t.me/Lord_mahor" target="_blank" rel="noopener noreferrer">Lord_mahor</a></span>
        </p>
    </UiPage>
    <RouterView />
</template>
