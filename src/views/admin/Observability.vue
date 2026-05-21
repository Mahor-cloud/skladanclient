<script setup>
import axiosInstance from "@/service/axios"
import { useQuery } from "@tanstack/vue-query"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"

const { data: snapshotData, isSuccess: isSnapshotReady, dataUpdatedAt } = useQuery({
    queryKey: ["observability-live"],
    queryFn: async () => (await axiosInstance.get("/observability/live")).data,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    staleTime: 4000,

    meta: { silent: true }
})

const historyHours = ref(24)
const { data: historyData, isSuccess: isHistoryReady } = useQuery({
    queryKey: ["observability-history", historyHours],
    queryFn: async () =>
        (
            await axiosInstance.get("/observability/history", {
                params: { hours: historyHours.value }
            })
        ).data,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 20000,

    meta: { silent: true }
})

const nowTs = ref(Date.now())
let nowTimer = null
onMounted(() => {
    nowTimer = setInterval(() => {
        nowTs.value = Date.now()
    }, 1000)
})
onBeforeUnmount(() => {
    if (nowTimer) clearInterval(nowTimer)
})
const updatedAgo = computed(() => {
    if (!dataUpdatedAt?.value) return null
    const sec = Math.max(0, Math.floor((nowTs.value - dataUpdatedAt.value) / 1000))
    if (sec < 60) return sec + " сек назад"
    const m = Math.floor(sec / 60)
    return m + " мин " + (sec % 60) + " сек назад"
})

const cpuUserPerMin = ref(null)
const cpuSystemPerMin = ref(null)
let prevSnap = null
watch(
    () => snapshotData.value,
    (cur) => {
        if (!cur) return
        if (prevSnap && cur.createdAt !== prevSnap.createdAt) {
            const dtSec = (new Date(cur.createdAt).getTime() - new Date(prevSnap.createdAt).getTime()) / 1000
            if (dtSec > 0.1) {
                const ud = (cur.payload["process_cpu_user_seconds_total"] || 0) - (prevSnap.payload["process_cpu_user_seconds_total"] || 0)
                const sd =
                    (cur.payload["process_cpu_system_seconds_total"] || 0) -
                    (prevSnap.payload["process_cpu_system_seconds_total"] || 0)

                cpuUserPerMin.value = ud >= 0 ? (ud / dtSec) * 60 : null
                cpuSystemPerMin.value = sd >= 0 ? (sd / dtSec) * 60 : null
            }
        }
        prevSnap = { createdAt: cur.createdAt, payload: { ...cur.payload } }
    }
)

onBeforeUnmount(() => {
    prevSnap = null
    cpuUserPerMin.value = null
    cpuSystemPerMin.value = null
})

function metricByPrefix(payload, prefix) {
    if (!payload) return null
    if (payload[prefix] != null) return payload[prefix]
    const key = Object.keys(payload).find((k) => k.startsWith(prefix + "{"))
    return key ? payload[key] : null
}
function sumByPrefix(payload, prefix) {
    if (!payload) return 0
    if (payload[prefix] != null) return payload[prefix]
    return Object.entries(payload)
        .filter(([k]) => k.startsWith(prefix + "{") || k === prefix)
        .reduce((sum, [, v]) => sum + Number(v || 0), 0)
}
function parseLabels(labelsStr) {
    const out = {}
    if (!labelsStr) return out
    for (const pair of labelsStr.split(",")) {
        const i = pair.indexOf("=")
        if (i < 0) continue
        out[pair.slice(0, i)] = pair.slice(i + 1)
    }
    return out
}

function stats(points, fn) {
    if (!points || points.length === 0) return { min: null, avg: null, max: null }
    let min = Infinity,
        max = -Infinity,
        sum = 0,
        cnt = 0
    for (const pt of points) {
        const v = fn(pt.payload)
        if (typeof v !== "number" || Number.isNaN(v)) continue
        if (v < min) min = v
        if (v > max) max = v
        sum += v
        cnt++
    }
    if (cnt === 0) return { min: null, avg: null, max: null }
    return { min, avg: sum / cnt, max }
}

const kpis = computed(() => {
    const p = snapshotData.value?.payload || {}
    return {
        rssMb: Math.round((metricByPrefix(p, "process_resident_memory_bytes") || 0) / 1048576),
        heapUsedMb: Math.round((metricByPrefix(p, "nodejs_heap_size_used_bytes") || 0) / 1048576),
        heapTotalMb: Math.round((metricByPrefix(p, "nodejs_heap_size_total_bytes") || 0) / 1048576),
        externalMb: Math.round((metricByPrefix(p, "nodejs_external_memory_bytes") || 0) / 1048576),
        cpuUserSec: Math.round((metricByPrefix(p, "process_cpu_user_seconds_total") || 0) * 10) / 10,
        cpuSystemSec: Math.round((metricByPrefix(p, "process_cpu_system_seconds_total") || 0) * 10) / 10,
        eventLoopMs:
            Math.round(
                ((metricByPrefix(p, "skladan_event_loop_lag_ms") ||
                    (metricByPrefix(p, "nodejs_eventloop_lag_seconds") || 0) * 1000) || 0) * 10
            ) / 10,
        openFds: metricByPrefix(p, "process_open_fds") ?? "–",
        activeHandles: metricByPrefix(p, "nodejs_active_handles_total") || 0,
        activeRequests: metricByPrefix(p, "nodejs_active_requests_total") || 0,
        mongoUsed: metricByPrefix(p, "skladan_mongo_pool_used") || 0,
        mongoMax: metricByPrefix(p, "skladan_mongo_pool_max") || 0,
        sseClients: sumByPrefix(p, "skladan_sse_connections_active"),
        snapshotAt: snapshotData.value?.createdAt ? new Date(snapshotData.value.createdAt) : null
    }
})

const nodeVersion = computed(() => {
    const p = snapshotData.value?.payload || {}
    const entry = Object.keys(p).find((k) => k.startsWith("nodejs_version_info{"))
    if (!entry) return null
    const labels = parseLabels(entry.replace(/^nodejs_version_info\{(.*)\}$/, "$1"))
    return labels.version || null
})

const activeUsersNow = computed(() => sumByPrefix(snapshotData.value?.payload, "skladan_active_users_15m"))

function formatUptime(seconds) {
    if (seconds == null || seconds < 0) return "–"
    const s = Math.floor(seconds)
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (d > 0) return `${d} дн ${h} ч ${m} мин`
    if (h > 0) return `${h} ч ${m} мин`
    if (m > 0) return `${m} мин ${sec} сек`
    return `${sec} сек`
}
const uptimeSeconds = computed(() => {
    const startSec = snapshotData.value?.payload?.process_start_time_seconds
    if (!startSec) return null
    return Math.max(0, nowTs.value / 1000 - Number(startSec))
})
const uptimeHuman = computed(() => formatUptime(uptimeSeconds.value))

const hostInfo = computed(() => {
    const p = snapshotData.value?.payload || {}
    const totalBytes = Number(p["skladan_host_info{kind=total_memory_bytes}"] || 0)
    const budgetBytes = Number(p["skladan_host_info{kind=memory_budget_bytes}"] || 0)
    const constrainedBytes = Number(p["skladan_host_info{kind=constrained_memory_bytes}"] || 0)
    const cpuCount = Number(p["skladan_host_info{kind=cpu_count}"] || 0)
    return {
        totalMb: totalBytes > 0 ? Math.round(totalBytes / 1048576) : null,
        budgetMb: budgetBytes > 0 ? Math.round(budgetBytes / 1048576) : null,
        constrainedMb: constrainedBytes > 0 ? Math.round(constrainedBytes / 1048576) : null,
        cpuCount: cpuCount > 0 ? cpuCount : null
    }
})

const rssThresholds = computed(() => {
    const budget = hostInfo.value.budgetMb
    if (!budget || budget < 200) return { warn: 500, crit: 750 }
    return {
        warn: Math.round(budget * 0.7),
        crit: Math.round(budget * 0.85)
    }
})

const historyPoints = computed(() => historyData.value?.points || [])

const rssStats = computed(() =>
    stats(historyPoints.value, (p) => (metricByPrefix(p, "process_resident_memory_bytes") || 0) / 1048576)
)
const heapStats = computed(() =>
    stats(historyPoints.value, (p) => (metricByPrefix(p, "nodejs_heap_size_used_bytes") || 0) / 1048576)
)
const heapTotalStats = computed(() =>
    stats(historyPoints.value, (p) => (metricByPrefix(p, "nodejs_heap_size_total_bytes") || 0) / 1048576)
)
const externalStats = computed(() =>
    stats(historyPoints.value, (p) => (metricByPrefix(p, "nodejs_external_memory_bytes") || 0) / 1048576)
)
const eventLoopStats = computed(() =>
    stats(historyPoints.value, (p) => metricByPrefix(p, "skladan_event_loop_lag_ms") || 0)
)
const eventLoopPeakStats = computed(() => stats(historyPoints.value, (p) => p["skladan_event_loop_lag_ms_peak_5m"] || 0))
const sseStats = computed(() => stats(historyPoints.value, (p) => sumByPrefix(p, "skladan_sse_connections_active")))
const mongoUsedStats = computed(() => stats(historyPoints.value, (p) => metricByPrefix(p, "skladan_mongo_pool_used") || 0))
const handlesStats = computed(() => stats(historyPoints.value, (p) => metricByPrefix(p, "nodejs_active_handles_total") || 0))
const requestsStats = computed(() => stats(historyPoints.value, (p) => metricByPrefix(p, "nodejs_active_requests_total") || 0))
const openFdsStats = computed(() => stats(historyPoints.value, (p) => metricByPrefix(p, "process_open_fds") || 0))

const httpStats = computed(() => {
    const p = snapshotData.value?.payload || {}
    const groups = new Map()
    for (const [k, v] of Object.entries(p)) {

        let m = k.match(/^http_request_duration_seconds_bucket\{(.+)\}$/)
        if (m) {
            const labels = parseLabels(m[1])
            const key = `${labels.method}|${labels.route}|${labels.status}`
            const g = groups.get(key) || mkGroup(labels)
            g.buckets.push({ le: labels.le === "+Inf" ? Infinity : Number(labels.le), value: Number(v) })
            groups.set(key, g)
            continue
        }

        m = k.match(/^http_request_duration_seconds_count\{(.+)\}$/)
        if (m) {
            const labels = parseLabels(m[1])
            const key = `${labels.method}|${labels.route}|${labels.status}`
            const g = groups.get(key) || mkGroup(labels)
            g.count = Math.max(g.count, Number(v))
            groups.set(key, g)
            continue
        }
        m = k.match(/^http_request_duration_seconds_sum\{(.+)\}$/)
        if (m) {
            const labels = parseLabels(m[1])
            const key = `${labels.method}|${labels.route}|${labels.status}`
            const g = groups.get(key) || mkGroup(labels)
            g.sum = Number(v)
            g.hasSum = true
            groups.set(key, g)
            continue
        }

        m = k.match(/^http_request_duration_seconds\{(.+)\}$/)
        if (m) {
            const labels = parseLabels(m[1])
            const key = `${labels.method}|${labels.route}|${labels.status}`
            const g = groups.get(key) || mkGroup(labels)
            if (labels.le !== undefined) {
                g.buckets.push({ le: labels.le === "+Inf" ? Infinity : Number(labels.le), value: Number(v) })
            } else {
                g.count = Math.max(g.count, Number(v))
            }
            groups.set(key, g)
            continue
        }

        m = k.match(/^http_requests_total\{(.+)\}$/)
        if (m) {
            const labels = parseLabels(m[1])
            const key = `${labels.method}|${labels.route}|${labels.status}`
            const g = groups.get(key) || mkGroup(labels)
            g.count = Math.max(g.count, Number(v))
            groups.set(key, g)
        }
    }
    function mkGroup(labels) {
        return {
            method: labels.method,
            route: labels.route,
            status: labels.status,
            buckets: [],
            count: 0,
            sum: 0,
            hasSum: false
        }
    }
    const rows = []
    for (const g of groups.values()) {
        if (g.count === 0) continue
        const buckets = g.buckets.sort((a, b) => a.le - b.le)
        const pct = (q) => {
            if (buckets.length === 0) return null
            const target = q * g.count
            let lower = { le: 0, value: 0 }
            for (const b of buckets) {
                if (b.value >= target) {
                    if (b.le === Infinity) {
                        return lower.le > 0 ? lower.le : null
                    }
                    const range = b.value - lower.value
                    if (range <= 0) return b.le
                    const fraction = (target - lower.value) / range
                    return lower.le + (b.le - lower.le) * fraction
                }
                lower = b
            }

            return buckets[buckets.length - 1]?.le ?? null
        }
        rows.push({
            method: g.method,
            route: g.route,
            status: g.status,
            count: g.count,
            avg: g.hasSum && g.count > 0 ? g.sum / g.count : null,
            p50: pct(0.5),
            p95: pct(0.95),
            p99: pct(0.99)
        })
    }
    rows.sort((a, b) => b.count - a.count)
    return rows
})

const httpStatsWithDelta = computed(() => {
    const cur = httpStats.value
    const firstPoint = historyPoints.value[0]?.payload
    return cur.map((r) => {
        if (!firstPoint) return { ...r, delta: null }
        const key = `http_requests_total{method=${r.method},route=${r.route},status=${r.status}}`
        const startCount = Number(firstPoint[key] || 0)
        const delta = r.count - startCount
        return { ...r, delta: delta >= 0 ? delta : r.count }
    })
})

function evtLoopSeverity(avgMs, peakMs) {
    if ((avgMs != null && avgMs > 100) || (peakMs != null && peakMs > 500)) return "crit"
    if ((avgMs != null && avgMs > 50) || (peakMs != null && peakMs > 100)) return "warn"
    return "normal"
}

function mongoPoolSeverity(avgUsed, curMax) {
    if (!curMax || curMax <= 0 || avgUsed == null) return "normal"
    const ratio = avgUsed / curMax
    if (ratio >= 0.9) return "crit"
    if (ratio >= 0.6) return "warn"
    return "normal"
}

function httpRowSeverity(row) {
    if (!row.p50 || !row.p95 || row.count < 100) return "normal"
    const ratio = row.p95 / row.p50
    if (ratio >= 20 && row.count >= 1000) return "crit"
    if (ratio >= 10 && row.count >= 1000) return "warn"
    return "normal"
}

function rssSeverity(maxStat, thresholds) {
    if (maxStat == null) return "normal"
    if (maxStat > thresholds.crit) return "crit"
    if (maxStat > thresholds.warn) return "warn"
    return "normal"
}

function handlesSeverity(curr, minMaxStat) {
    if (!minMaxStat || minMaxStat.min == null) return "normal"
    if (minMaxStat.min > 0 && curr / minMaxStat.min >= 5 && minMaxStat.max >= 50) return "crit"
    if (minMaxStat.min > 0 && curr / minMaxStat.min >= 2.5 && minMaxStat.max >= 30) return "warn"
    return "normal"
}

function sseSeverity(maxSseStat, maxUsersStat) {
    const maxSse = maxSseStat?.max
    const maxUsers = maxUsersStat?.max
    if (!maxSse || !maxUsers || maxUsers === 0) return "normal"
    const ratio = maxSse / maxUsers
    if (ratio > 5) return "crit"
    if (ratio > 2.5) return "warn"
    return "normal"
}

function cpuPerMinSeverity(avgStat, maxStat) {
    const cmpMax = maxStat
    const cmpAvg = avgStat
    if ((cmpMax != null && cmpMax >= 54) || (cmpAvg != null && cmpAvg >= 54)) return "crit"
    if ((cmpMax != null && cmpMax >= 36) || (cmpAvg != null && cmpAvg >= 36)) return "warn"
    return "normal"
}

function cpuPerMinSeries(points, key) {
    const result = []
    for (let i = 1; i < points.length; i++) {
        const prev = Number(points[i - 1].payload[key] || 0)
        const cur = Number(points[i].payload[key] || 0)
        const dtSec = (new Date(points[i].at).getTime() - new Date(points[i - 1].at).getTime()) / 1000
        if (dtSec > 0.5) {
            const delta = Math.max(0, cur - prev)
            result.push((delta / dtSec) * 60)
        }
    }
    return result
}
function statsFromSeries(arr) {
    if (!arr || arr.length === 0) return { min: null, avg: null, max: null }
    let min = Infinity,
        max = -Infinity,
        sum = 0
    for (const v of arr) {
        if (v < min) min = v
        if (v > max) max = v
        sum += v
    }
    return { min, avg: sum / arr.length, max }
}
const cpuUserPerMinStats = computed(() => statsFromSeries(cpuPerMinSeries(historyPoints.value, "process_cpu_user_seconds_total")))
const cpuSystemPerMinStats = computed(() => statsFromSeries(cpuPerMinSeries(historyPoints.value, "process_cpu_system_seconds_total")))

const sseStatsForSev = computed(() => stats(historyPoints.value, (p) => sumByPrefix(p, "skladan_sse_connections_active")))
const activeUsersStatsForSev = computed(() => stats(historyPoints.value, (p) => sumByPrefix(p, "skladan_active_users_15m")))

const sevRss = computed(() => rssSeverity(rssStats.value.max, rssThresholds.value))
const sevEvtLoop = computed(() => evtLoopSeverity(eventLoopStats.value.avg, eventLoopPeakStats.value.max))
const sevMongo = computed(() => mongoPoolSeverity(mongoUsedStats.value.avg, kpis.value.mongoMax))
const sevHandles = computed(() => handlesSeverity(kpis.value.activeHandles, handlesStats.value))
const sevSse = computed(() => sseSeverity(sseStatsForSev.value, activeUsersStatsForSev.value))
const sevCpuUser = computed(() => cpuPerMinSeverity(cpuUserPerMinStats.value.avg, cpuUserPerMinStats.value.max))
const sevCpuSystem = computed(() => cpuPerMinSeverity(cpuSystemPerMinStats.value.avg, cpuSystemPerMinStats.value.max))

const chartLabels = computed(() => {
    const pts = historyPoints.value
    const long = historyHours.value > 48
    return pts.map((pt) => {
        const d = new Date(pt.at)
        return long
            ? d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) +
                  " " +
                  d.toLocaleTimeString("ru-RU", { hour: "2-digit" }) +
                  "ч"
            : d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    })
})

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { intersect: false, mode: "index" },
    plugins: { legend: { display: true, position: "bottom" } },
    scales: {
        x: { ticks: { maxTicksLimit: 8, maxRotation: 0 } },
        y: { beginAtZero: true }
    }
}

function mbFromBytes(p, name) {
    return Math.round((metricByPrefix(p, name) || 0) / 1048576)
}

const memoryChart = computed(() => ({
    labels: chartLabels.value,
    datasets: [
        {
            label: "RSS (MB)",
            data: historyPoints.value.map((pt) => mbFromBytes(pt.payload, "process_resident_memory_bytes")),
            borderColor: "#0ea5e9",
            backgroundColor: "#0ea5e920",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        },
        {
            label: "JS heap used (MB)",
            data: historyPoints.value.map((pt) => mbFromBytes(pt.payload, "nodejs_heap_size_used_bytes")),
            borderColor: "#a855f7",
            backgroundColor: "#a855f720",
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        },
        {
            label: "JS heap total (MB)",
            data: historyPoints.value.map((pt) => mbFromBytes(pt.payload, "nodejs_heap_size_total_bytes")),
            borderColor: "#94a3b8",
            backgroundColor: "transparent",
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [4, 4]
        }
    ]
}))

const eventLoopChart = computed(() => ({
    labels: chartLabels.value,
    datasets: [
        {
            label: "Event loop (ms)",
            data: historyPoints.value.map(
                (pt) => Math.round((metricByPrefix(pt.payload, "skladan_event_loop_lag_ms") || 0) * 10) / 10
            ),
            borderColor: "#f59e0b",
            backgroundColor: "#f59e0b20",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        },
        {
            label: "Пик за 5 мин (ms)",
            data: historyPoints.value.map((pt) => Math.round((pt.payload["skladan_event_loop_lag_ms_peak_5m"] || 0) * 10) / 10),
            borderColor: "#ef4444",
            backgroundColor: "transparent",
            fill: false,
            tension: 0,
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [4, 4]
        }
    ]
}))

const sseChart = computed(() => ({
    labels: chartLabels.value,
    datasets: [
        {
            label: "SSE подключения",
            data: historyPoints.value.map((pt) => sumByPrefix(pt.payload, "skladan_sse_connections_active")),
            borderColor: "#22c55e",
            backgroundColor: "#22c55e20",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        }
    ]
}))

const activeUsersChart = computed(() => ({
    labels: chartLabels.value,
    datasets: [
        {
            label: "Активные за 15 минут",
            data: historyPoints.value.map((pt) => sumByPrefix(pt.payload, "skladan_active_users_15m")),
            borderColor: "#3b82f6",
            backgroundColor: "#3b82f620",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        }
    ]
}))

const mongoPoolChart = computed(() => ({
    labels: chartLabels.value,
    datasets: [
        {
            label: "Mongo используется",
            data: historyPoints.value.map((pt) => metricByPrefix(pt.payload, "skladan_mongo_pool_used") || 0),
            borderColor: "#06b6d4",
            backgroundColor: "#06b6d420",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        },
        {
            label: "Pool max",
            data: historyPoints.value.map((pt) => metricByPrefix(pt.payload, "skladan_mongo_pool_max") || 0),
            borderColor: "#94a3b8",
            backgroundColor: "transparent",
            fill: false,
            tension: 0,
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [4, 4]
        }
    ]
}))

const handlesChart = computed(() => ({
    labels: chartLabels.value,
    datasets: [
        {
            label: "Active handles",
            data: historyPoints.value.map((pt) => metricByPrefix(pt.payload, "nodejs_active_handles_total") || 0),
            borderColor: "#ec4899",
            backgroundColor: "#ec489920",
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        },
        {
            label: "Active requests",
            data: historyPoints.value.map((pt) => metricByPrefix(pt.payload, "nodejs_active_requests_total") || 0),
            borderColor: "#8b5cf6",
            backgroundColor: "#8b5cf620",
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        }
    ]
}))

function cpuPerMinDeltaSeries(points, key) {
    const result = [null]
    for (let i = 1; i < points.length; i++) {
        const prev = Number(points[i - 1].payload[key] || 0)
        const cur = Number(points[i].payload[key] || 0)
        const dtSec = (new Date(points[i].at).getTime() - new Date(points[i - 1].at).getTime()) / 1000
        if (dtSec > 0.5 && cur >= prev) {
            result.push(((cur - prev) / dtSec) * 60)
        } else {
            result.push(null)
        }
    }
    return result
}
const cpuChart = computed(() => ({
    labels: chartLabels.value,
    datasets: [
        {
            label: "CPU user (сек/мин)",
            data: cpuPerMinDeltaSeries(historyPoints.value, "process_cpu_user_seconds_total"),
            borderColor: "#10b981",
            backgroundColor: "#10b98120",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
            spanGaps: false
        },
        {
            label: "CPU system (сек/мин)",
            data: cpuPerMinDeltaSeries(historyPoints.value, "process_cpu_system_seconds_total"),
            borderColor: "#f43f5e",
            backgroundColor: "#f43f5e20",
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
            spanGaps: false
        }
    ]
}))

function fmt(n, digits = 1) {
    if (n == null || Number.isNaN(n)) return "–"
    return Number(n).toFixed(digits)
}
function fmtInt(n) {
    if (n == null || Number.isNaN(n)) return "–"
    return Math.round(n).toString()
}
function fmtMs(s) {
    if (s == null) return "–"
    return (s * 1000).toFixed(1) + " ms"
}
function fmtRangeInt(s) {
    if (!s || s.min == null) return ""
    return `мин ${fmtInt(s.min)} · сред ${fmtInt(s.avg)} · макс ${fmtInt(s.max)}`
}
function fmtRange(s, digits = 1) {
    if (!s || s.min == null) return ""
    return `мин ${fmt(s.min, digits)} · сред ${fmt(s.avg, digits)} · макс ${fmt(s.max, digits)}`
}
function rangeLabel(h) {
    if (h === 24) return "24 часа"
    if (h === 168) return "7 дней"
    if (h === 720) return "30 дней"
    if (h === 2160) return "90 дней"
    return h + " ч"
}

const metricInfo = {
    rss: {
        title: "RSS память",
        body:
            "Resident Set Size — физическая RAM, которую процесс backend держит у системы прямо " +
            "сейчас. Включает JS heap, native Buffer, V8 код, подгруженные библиотеки. То же что " +
            "вы видите в docker stats как memory usage.\n\n" +
            "Норма: пилообразный график (растёт → GC → падает), avg стабильный неделями.\n" +
            "Тревожно: монотонный рост avg каждую неделю +10-20 % — утечка в коде. Лечится не " +
            "железом, а heap snapshot + фикс кода. Если стабильно высокий и упирается в лимит хоста " +
            "(~RAM сервера) — пора больше RAM."
    },
    heapUsed: {
        title: "JS heap used",
        body:
            "Сколько памяти под объекты JavaScript (объекты, массивы, строки) занято прямо сейчас. " +
            "V8 garbage collector регулярно чистит этот блок. Это часть RSS — RSS включает ещё " +
            "native heap, code, libraries поверх JS heap."
    },
    heapTotal: {
        title: "JS heap total",
        body:
            "Сколько V8 зарезервировал под heap (всегда ≥ heap used). Растёт когда heap used " +
            "приближается к лимиту. Default лимит V8 — около 1.5 GB на 64-bit (можно увеличить " +
            "через --max-old-space-size). При превышении лимита процесс падает с FATAL ERROR."
    },
    external: {
        title: "External memory",
        body:
            "Native объекты вне V8 heap — Buffer (бинарные данные), ArrayBuffer от async I/O, " +
            "mongoose connection buffers, web-push payloads. Считается отдельно от JS heap, но " +
            "тоже занимает RAM (входит в RSS)."
    },
    cpuUserLive: {
        title: "CPU user / мин (live)",
        body:
            "Сколько CPU-секунд процесс реально потратил на USER-код за последнюю минуту. " +
            "Считается как delta cumulative-счётчика между двумя замерами /live.\n\n" +
            "60 сек/мин = 100 % одного ядра. Node.js однопоточный, поэтому потолок = 60 для " +
            "одного процесса (даже если CPU 8 ядер). > 36 — ядро загружено больше чем на 60 %, " +
            "пора готовиться к оптимизации или cluster mode."
    },
    cpuSystemLive: {
        title: "CPU system / мин (live)",
        body:
            "CPU секунд на системные вызовы (I/O, network, fs syscalls). Растёт при активных " +
            "DB-запросах, file operations, sync I/O. Высокое значение указывает на bottleneck " +
            "на уровне OS/kernel (медленный диск, network).\n\n" +
            "Та же шкала что у user — 60 сек/мин = 100 % одного ядра."
    },
    cpuUserCum: {
        title: "CPU user (cumulative)",
        body:
            "Накопленные секунды CPU user-режима с момента старта процесса. Только растёт.\n\n" +
            "Сам по себе мало информативен — важен наклон графика (производная), которая и " +
            "показывается в KPI «CPU user / мин» и в графике CPU sec/min."
    },
    cpuSystemCum: {
        title: "CPU system (cumulative)",
        body:
            "Накопленные секунды CPU system-режима с момента старта. Только растёт. См. CPU " +
            "user (cumulative) — важен наклон, не значение."
    },
    eventLoop: {
        title: "Event loop lag",
        body:
            "Задержка между готовым callback'ом и его выполнением. Event loop — единственный " +
            "поток Node.js, выполняющий ваш код. Если lag > 50 ms — Node не успевает обработать " +
            "события вовремя, пользователи замечают тормоза.\n\n" +
            "Норма: < 5 ms почти всегда, пики < 20 ms редко.\n" +
            "Тревожно: avg > 50 ms (⚠) или > 100 ms (🔴). Лечение: профилировать горячий код " +
            "(node --prof), убрать sync I/O, оптимизировать тяжёлые mongo aggregations. Если код " +
            "оптимален — нужен более быстрый CPU или cluster mode."
    },
    openFds: {
        title: "Open file descriptors",
        body:
            "Сколько файловых дескрипторов процесс открыл (TCP sockets + open files + pipes). " +
            "Default ulimit на Linux = 1024 на процесс. При превышении новые соединения " +
            "отказываются (EMFILE), но существующие работают и постепенно освобождают слоты.\n\n" +
            "Доступно только на Linux — на Windows показывает «–»."
    },
    activeHandles: {
        title: "Active handles",
        body:
            "Сколько активных «handles» держит libuv: TCP sockets, Server, Timer, FSEvent, и т.п.\n\n" +
            "Норма: 10-50.\n" +
            "Тревожно: монотонный рост во времени без падения после GC — утечка. Источники: " +
            "незакрытые SSE/WebSocket, забытые setInterval без clearInterval, http.Agent с " +
            "keepAlive и большим maxSockets. Снять heap snapshot, искать объекты Socket / TLSSocket."
    },
    activeRequests: {
        title: "Active requests",
        body:
            "Активные I/O-запросы в полёте: Mongo операции, HTTP requests, file reads. Норма 0-5. " +
            "Если постоянно высокое — backend перегружен запросами, не успевает их обработать."
    },
    mongoPool: {
        title: "MongoDB pool",
        body:
            "Сколько коннектов к Mongo сейчас используется / максимум.\n\n" +
            "Used получаем через db.command({serverStatus:1}).connections.current — точное число " +
            "от Mongo по ВСЕМ клиентам на сервере (на нашем сервере крутится только этот проект, " +
            "поэтому это и есть наши коннекты).\n" +
            "Max — узкое место: min(client maxPoolSize, mongo maxIncomingConnections).\n\n" +
            "Норма: used < 30 % от max в среднем.\n" +
            "Тревожно: avg > 60 % (⚠) или > 90 % (🔴). При 100 % новые запросы валятся с " +
            "MongoServerSelectionError через 5 сек. Лечение: поднять maxPoolSize (бесплатно) или, " +
            "если Mongo сам нагружен, — железо для БД (SSD/RAM/IOPS)."
    },
    sse: {
        title: "SSE подключения",
        body:
            "Активные Server-Sent Events каналы — long-lived HTTP подключения, через которые " +
            "backend пушит realtime обновления на фронт (новые заказы, изменения и т.п.).\n\n" +
            "Один канал на вкладку браузера. Норма: 1-2 на active user.\n" +
            "Тревожно: ratio SSE/active_users > 2.5 (⚠) или > 5 (🔴) — зомби-табы или баг во " +
            "фронте (EventSource не закрывается при unmount). Каждый канал = 1 file descriptor, " +
            "при 1000+ упрёмся в ulimit."
    }
}

const metricPopover = ref(null)
const popoverInfo = ref({ title: "", body: "" })
function showMetricInfo(key, event) {
    const info = metricInfo[key]
    if (!info) return
    popoverInfo.value = info
    metricPopover.value?.toggle(event)
}
</script>

<template>
    <div class="card">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
                <h2 class="text-xl font-semibold m-0 flex items-center gap-2">
                    Метрики системы
                    <span class="live-dot" v-if="isSnapshotReady" title="live режим" />
                </h2>
                <p class="m-0 text-sm text-muted-color">
                    KPI обновляются live раз в 5 сек · история раз в 30 сек · cron-snapshot пишется в БД каждые 5 минут
                    <span v-if="nodeVersion"> · Node.js {{ nodeVersion }}</span>
                    <span v-if="hostInfo.cpuCount"> · {{ hostInfo.cpuCount }} vCPU</span>
                    <span v-if="hostInfo.totalMb">
                        · host {{ hostInfo.totalMb }} MB RAM<span v-if="hostInfo.constrainedMb">
                            (контейнер {{ hostInfo.constrainedMb }} MB)</span
                        >
                    </span>
                    <span v-if="hostInfo.budgetMb"> · бюджет backend {{ hostInfo.budgetMb }} MB</span>
                    <span v-if="uptimeSeconds != null"> · backend работает <b>{{ uptimeHuman }}</b></span>
                    <span v-if="updatedAgo" class="ml-2"
                        >· последний refresh: <b>{{ updatedAgo }}</b></span
                    >
                </p>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-sm text-muted-color">История за:</span>
                <SelectButton
                    v-model="historyHours"
                    :options="[
                        { label: '24 ч', value: 24 },
                        { label: '7 дн', value: 168 },
                        { label: '30 дн', value: 720 },
                        { label: '90 дн', value: 2160 }
                    ]"
                    optionLabel="label"
                    optionValue="value"
                    :allowEmpty="false"
                    size="small"
                />
            </div>
        </div>

        <Message v-if="!isSnapshotReady" severity="info" :closable="false">Загрузка снимка метрик…</Message>

        <div v-else>

            <h3 class="section-title">Системные ресурсы (Node.js / процесс)</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
                <div class="kpi-card" :class="'kpi-card--' + sevRss">
                    <div class="kpi-label">RSS память
                        <button class="info-btn" @click="showMetricInfo('rss', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.rssMb }} <span>MB</span></div>
                    <div class="kpi-stats">{{ fmtRangeInt(rssStats) }}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">JS heap used
                        <button class="info-btn" @click="showMetricInfo('heapUsed', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.heapUsedMb }} <span>MB</span></div>
                    <div class="kpi-stats">{{ fmtRangeInt(heapStats) }}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">JS heap total
                        <button class="info-btn" @click="showMetricInfo('heapTotal', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.heapTotalMb }} <span>MB</span></div>
                    <div class="kpi-stats">{{ fmtRangeInt(heapTotalStats) }}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">External memory
                        <button class="info-btn" @click="showMetricInfo('external', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.externalMb }} <span>MB</span></div>
                    <div class="kpi-stats">{{ fmtRangeInt(externalStats) }}</div>
                </div>

                <div class="kpi-card" :class="'kpi-card--' + sevCpuUser">
                    <div class="kpi-label">CPU user / мин
                        <button class="info-btn" @click="showMetricInfo('cpuUserLive', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ cpuUserPerMin != null ? fmt(cpuUserPerMin, 1) : "–" }} <span>сек/мин live</span></div>
                    <div class="kpi-stats">{{ fmtRange(cpuUserPerMinStats) }}</div>
                    <small class="text-muted-color">100 % одного ядра = 60 сек/мин</small>
                </div>
                <div class="kpi-card" :class="'kpi-card--' + sevCpuSystem">
                    <div class="kpi-label">CPU system / мин
                        <button class="info-btn" @click="showMetricInfo('cpuSystemLive', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ cpuSystemPerMin != null ? fmt(cpuSystemPerMin, 1) : "–" }} <span>сек/мин live</span></div>
                    <div class="kpi-stats">{{ fmtRange(cpuSystemPerMinStats) }}</div>
                    <small class="text-muted-color">syscalls + I/O</small>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">CPU user (cumulative)
                        <button class="info-btn" @click="showMetricInfo('cpuUserCum', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.cpuUserSec }} <span>сек</span></div>
                    <small class="text-muted-color">с момента старта</small>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">CPU system (cumulative)
                        <button class="info-btn" @click="showMetricInfo('cpuSystemCum', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.cpuSystemSec }} <span>сек</span></div>
                    <small class="text-muted-color">с момента старта</small>
                </div>

                <div class="kpi-card" :class="'kpi-card--' + sevEvtLoop">
                    <div class="kpi-label">Event loop lag
                        <button class="info-btn" @click="showMetricInfo('eventLoop', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.eventLoopMs }} <span>ms</span></div>
                    <div class="kpi-stats">{{ fmtRange(eventLoopStats) }}</div>
                    <small v-if="eventLoopPeakStats.max != null" class="text-muted-color">
                        пик-окна: макс {{ fmt(eventLoopPeakStats.max) }} ms
                    </small>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Open file descriptors
                        <button class="info-btn" @click="showMetricInfo('openFds', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.openFds }}</div>
                    <div class="kpi-stats">{{ fmtRangeInt(openFdsStats) }}</div>
                </div>
                <div class="kpi-card" :class="'kpi-card--' + sevHandles">
                    <div class="kpi-label">Active handles
                        <button class="info-btn" @click="showMetricInfo('activeHandles', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.activeHandles }}</div>
                    <div class="kpi-stats">{{ fmtRangeInt(handlesStats) }}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Active requests
                        <button class="info-btn" @click="showMetricInfo('activeRequests', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.activeRequests }}</div>
                    <div class="kpi-stats">{{ fmtRangeInt(requestsStats) }}</div>
                </div>

                <div class="kpi-card" :class="'kpi-card--' + sevMongo">
                    <div class="kpi-label">MongoDB pool
                        <button class="info-btn" @click="showMetricInfo('mongoPool', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.mongoUsed }} <span>/ {{ kpis.mongoMax || "–" }}</span></div>
                    <div class="kpi-stats">{{ fmtRangeInt(mongoUsedStats) }}</div>
                </div>
                <div class="kpi-card" :class="'kpi-card--' + sevSse">
                    <div class="kpi-label">SSE подключения
                        <button class="info-btn" @click="showMetricInfo('sse', $event)" aria-label="что это?">?</button>
                    </div>
                    <div class="kpi-value">{{ kpis.sseClients }}</div>
                    <div class="kpi-stats">{{ fmtRangeInt(sseStats) }}</div>
                </div>
            </div>


            <h3 class="section-title">HTTP-эндпоинты (топ-20 с момента старта процесса, p50/p95/p99)</h3>
            <div v-if="httpStats.length === 0" class="text-muted-color text-sm mb-5">
                Пока не зафиксировано HTTP-запросов. Метрики появятся после первых обращений к API.
            </div>
            <div v-else class="mb-5 http-table">
                <DataTable
                    :value="httpStatsWithDelta.slice(0, 20)"
                    size="small"
                    stripedRows
                    responsiveLayout="scroll"
                    :rowClass="(row) => 'http-row http-row--' + httpRowSeverity(row)"
                >
                    <Column field="method" header="Метод" style="width: 78px" />
                    <Column field="route" header="Маршрут" />
                    <Column field="status" header="Status" style="width: 90px" />
                    <Column field="count" header="Запросов" sortable style="width: 110px" />
                    <Column :header="'За период (' + rangeLabel(historyHours) + ')'" style="width: 140px">
                        <template #body="{ data }">
                            <span v-if="data.delta == null" class="text-muted-color">–</span>
                            <span v-else-if="data.delta === 0" class="text-muted-color">0</span>
                            <span v-else class="delta-positive">+{{ data.delta }}</span>
                        </template>
                    </Column>
                    <Column header="Средн.">
                        <template #body="{ data }">{{ fmtMs(data.avg) }}</template>
                    </Column>
                    <Column header="p50">
                        <template #body="{ data }">{{ fmtMs(data.p50) }}</template>
                    </Column>
                    <Column header="p95">
                        <template #body="{ data }">{{ fmtMs(data.p95) }}</template>
                    </Column>
                    <Column header="p99">
                        <template #body="{ data }">{{ fmtMs(data.p99) }}</template>
                    </Column>
                </DataTable>
                <p class="text-xs text-muted-color mt-2 mb-0">
                    🟡 жёлтым — маршруты где p95/p50 ≥ 10× (длинный хвост латенси) с количеством ≥ 1000 запросов.
                    🔴 красным — p95/p50 ≥ 20× при тех же условиях. «За период» — сколько запросов прошло за выбранное окно истории.
                </p>
            </div>

            <!-- Графики -->
            <h3 class="section-title">Графики истории за {{ rangeLabel(historyHours) }}</h3>
            <Message v-if="!isHistoryReady" severity="info" :closable="false">Загрузка истории…</Message>
            <div v-else-if="historyPoints.length === 0" class="text-muted-color text-sm mb-3">
                История пуста. Первая запись будет добавлена в течение 5 минут после старта backend (snapshot-cron).
            </div>
            <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="chart-wrap" :class="'chart-wrap--' + sevRss">
                    <h4>Память: RSS · JS heap used · JS heap total (MB)</h4>
                    <Chart type="line" :data="memoryChart" :options="chartOptions" style="height: 260px" />
                </div>
                <div class="chart-wrap" :class="'chart-wrap--' + sevEvtLoop">
                    <h4>Event loop задержка (ms) — текущее vs пик за 5 мин</h4>
                    <Chart type="line" :data="eventLoopChart" :options="chartOptions" style="height: 260px" />
                </div>
                <div
                    class="chart-wrap"
                    :class="
                        'chart-wrap--' + (sevCpuUser === 'crit' || sevCpuSystem === 'crit' ? 'crit' : sevCpuUser === 'warn' || sevCpuSystem === 'warn' ? 'warn' : 'normal')
                    "
                >
                    <h4>CPU user / system (сек/мин — реальная нагрузка ядра)</h4>
                    <Chart type="line" :data="cpuChart" :options="chartOptions" style="height: 260px" />
                </div>
                <div class="chart-wrap" :class="'chart-wrap--' + sevSse">
                    <h4>SSE подключения (sum по всем компаниям)</h4>
                    <Chart type="line" :data="sseChart" :options="chartOptions" style="height: 260px" />
                </div>
                <div class="chart-wrap">
                    <h4>Активные пользователи (15-минутное окно)</h4>
                    <Chart type="line" :data="activeUsersChart" :options="chartOptions" style="height: 260px" />
                </div>
                <div class="chart-wrap" :class="'chart-wrap--' + sevMongo">
                    <h4>MongoDB connection pool</h4>
                    <Chart type="line" :data="mongoPoolChart" :options="chartOptions" style="height: 260px" />
                </div>
                <div class="chart-wrap lg:col-span-2" :class="'chart-wrap--' + sevHandles">
                    <h4>Active handles / Active requests</h4>
                    <Chart type="line" :data="handlesChart" :options="chartOptions" style="height: 260px" />
                </div>
            </div>

            <!-- Легенда подсветки -->
            <div class="legend-card mt-5">
                <h4>Что означает подсветка карточек</h4>
                <ul>
                    <li>
                        <span class="legend-badge legend-badge--warn">⚠ жёлтый</span> — внимание, тренд требует наблюдения.
                    </li>
                    <li>
                        <span class="legend-badge legend-badge--crit">🔴 красный</span> — критично, действовать сейчас.
                    </li>
                </ul>
                <h4 class="mt-3">Правила срабатывания (за выбранный период истории)</h4>
                <p class="text-xs mb-2">
                    Подсветка считается строго по выбранному окну (24 ч / 7 дн / 30 дн / 90 дн). Старые проблемы вне
                    окна не светятся. Конфиг хоста определяется <b>автоматически</b> — см. шапку («host N MB RAM, бюджет
                    backend M MB»). Пороги ниже физические или относительные к бюджету.
                </p>
                <ul class="rules-list">
                    <li>
                        <b>Event loop lag</b> (avg + peak за период): ⚠ avg &gt; 50 ms или пик &gt; 100 ms · 🔴 avg &gt; 100 ms
                        или пик &gt; 500 ms.
                        <br />
                        <span class="rec">💡 При 🔴: быстрее CPU или cluster mode.</span>
                    </li>
                    <li>
                        <b>MongoDB pool</b> (avg used за период / текущий max): ⚠ &gt; 60 % · 🔴 &gt; 90 %.
                        Если pool ПОЛНОСТЬЮ забит дольше 5 сек — запросы валятся с
                        <code>MongoServerSelectionError</code>; короткий пик можно просто переждать (само пройдёт когда pool
                        освободится).
                        <br />
                        <span class="rec">💡 При 🔴: поднять <code>maxPoolSize</code>; или железо БД (SSD/RAM/IOPS).</span>
                    </li>
                    <li>
                        <b>HTTP p95 / p50</b> (cumulative, при count ≥ 1000): ⚠ &gt; 10× · 🔴 &gt; 20× — длинный хвост латенси
                        на конкретном маршруте.
                        <br />
                        <span class="rec">💡 При 🔴: медленный aggregate / отсутствующий индекс.</span>
                    </li>
                    <li>
                        <b>CPU sec/мин</b> (avg или max за период, на одно ядро): ⚠ &gt; 36 (60 % одного ядра) ·
                        🔴 &gt; 54 (90 % одного ядра).
                        <br />
                        <span class="rec">💡 При 🔴: быстрее CPU или cluster mode.</span>
                    </li>
                    <li>
                        <b>RSS память</b> (max за период): ⚠ &gt; {{ rssThresholds.warn }} MB · 🔴 &gt;
                        {{ rssThresholds.crit }} MB. Пороги вычисляются автоматически от <b>бюджета backend</b>
                        ({{ hostInfo.budgetMb || "?" }} MB):
                        ⚠ = 70 % бюджета, 🔴 = 85 %. Бюджет = runtime-лимит (если есть) ИЛИ половина host RAM с
                        потолком 2 GB (другие сервисы хоста забирают остальное).
                        <br />
                        <span class="rec">💡 При 🔴: больше RAM серверу или найти утечку памяти в коде.</span>
                    </li>
                    <li>
                        <b>Active handles</b> (текущее vs минимум за окно): ⚠ &gt; 2.5× минимума (max за окно ≥ 30) ·
                        🔴 &gt; 5× минимума (max ≥ 50) — вероятная утечка сокетов.
                        <br />
                        <span class="rec">
                            💡 При 🔴: ищем незакрытые SSE / <code>setInterval</code> / <code>http.Agent</code> keepAlive;
                            heap snapshot, искать Socket objects.
                        </span>
                    </li>
                    <li>
                        <b>SSE / active_users ratio</b> (max за период): ⚠ &gt; 2.5 · 🔴 &gt; 5 (зомби-табы).
                    </li>
                </ul>
                <p class="mt-3 mb-0">
                    Если <b>красная</b> — требуются меры.
                </p>
            </div>

            <div class="mt-5 text-sm text-muted-color">
                <p>
                    <b>Min / Avg / Max</b> вычисляются по всем snapshot-точкам в выбранном окне (24 ч / 7 дн / 30 дн / 90 дн).
                    «Пик за 5 минут» — максимум между snapshot-точками: показывает короткие всплески, которые не успели
                    попасть в момент замера. Хранение в БД: TTL 90 дней (~40 MB).
                </p>
                <p>
                    Сырой Prometheus-формат: <code>GET /api/observability/metrics</code> (только super-admin).
                </p>
            </div>
        </div>

        <!-- Универсальный popover для справки по метрикам. Один экземпляр на
             страницу — содержимое подставляется через popoverInfo. -->
        <Popover ref="metricPopover" appendTo="body">
            <div class="metric-popover">
                <h4>{{ popoverInfo.title }}</h4>
                <p>{{ popoverInfo.body }}</p>
            </div>
        </Popover>
    </div>
</template>

<style scoped>
.section-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 1.5rem 0 0.75rem 0;
    color: var(--p-text-color);
}
.section-title:first-child {
    margin-top: 0;
}

.kpi-card {
    background: var(--p-surface-50);
    border: 1px solid var(--p-surface-200);
    border-radius: 8px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
}
:deep(.app-dark) .kpi-card,
.app-dark .kpi-card {
    background: var(--p-surface-900);
    border-color: var(--p-surface-700);
}
.kpi-label {
    font-size: 0.78rem;
    color: var(--p-text-muted-color);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.info-btn {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid var(--p-text-muted-color);
    background: transparent;
    color: var(--p-text-muted-color);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
    text-transform: none;
}
.info-btn:hover {
    background: var(--p-text-color);
    color: var(--p-surface-0);
    border-color: var(--p-text-color);
}
.metric-popover {
    max-width: 380px;
    padding: 0.4rem;
}
.metric-popover h4 {
    margin: 0 0 0.6rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--p-text-color);
}
.metric-popover p {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--p-text-color);
    white-space: pre-line;
}
.kpi-value {
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.1;
}
.kpi-value span {
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--p-text-muted-color);
    margin-left: 0.25rem;
}
.kpi-stats {
    font-size: 0.78rem;
    color: var(--p-text-muted-color);
    line-height: 1.3;
}
.company-rows {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
.company-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
    border-bottom: 1px dashed var(--p-surface-200);
    font-size: 0.88rem;
    gap: 0.5rem;
}
:deep(.app-dark) .company-row,
.app-dark .company-row {
    border-bottom-color: var(--p-surface-700);
}
.company-row:last-child {
    border-bottom: 0;
}
.company-name {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--p-text-color);
    min-width: 0;
    word-break: break-all;
}
.company-value {
    font-weight: 600;
    flex-shrink: 0;
}
.chart-wrap {
    background: var(--p-surface-50);
    border: 1px solid var(--p-surface-200);
    border-radius: 8px;
    padding: 1rem;
}
:deep(.app-dark) .chart-wrap,
.app-dark .chart-wrap {
    background: var(--p-surface-900);
    border-color: var(--p-surface-700);
}
.chart-wrap h4 {
    margin: 0 0 0.6rem 0;
    font-size: 0.9rem;
    font-weight: 600;
}
.http-table :deep(.p-datatable) {
    font-size: 0.85rem;
}
.http-table :deep(.p-datatable .p-datatable-tbody > tr > td) {
    padding: 0.45rem 0.6rem;
}

.legend-card {
    background: var(--p-surface-50);
    border: 1px solid var(--p-surface-200);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    font-size: 0.88rem;
    line-height: 1.5;
}
:deep(.app-dark) .legend-card,
.app-dark .legend-card {
    background: var(--p-surface-900);
    border-color: var(--p-surface-700);
}
.legend-card h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.95rem;
    font-weight: 600;
}
.legend-card ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}
.legend-card ul.rules-list li {
    border-left: 3px solid var(--p-surface-300);
    padding-left: 0.6rem;
    padding-bottom: 0.5rem;
}
.legend-card .rec {
    display: inline-block;
    margin-top: 0.3rem;
    padding: 0.4rem 0.6rem;
    background: rgba(34, 197, 94, 0.08);
    border-left: 3px solid #22c55e;
    border-radius: 4px;
    font-size: 0.85rem;
    line-height: 1.5;
}
:deep(.app-dark) .legend-card .rec,
.app-dark .legend-card .rec {
    background: rgba(34, 197, 94, 0.14);
}
.legend-card .rec code {
    background: var(--p-surface-100);
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    font-size: 0.82rem;
}
:deep(.app-dark) .legend-card .rec code,
.app-dark .legend-card .rec code {
    background: var(--p-surface-800);
}
:deep(.app-dark) .legend-card ul.rules-list li,
.app-dark .legend-card ul.rules-list li {
    border-left-color: var(--p-surface-700);
}
.legend-badge {
    display: inline-block;
    padding: 0.1rem 0.5rem;
    border-radius: 4px;
    font-weight: 600;
    margin-right: 0.4rem;
    font-size: 0.85rem;
}
.legend-badge--warn {
    background: rgba(245, 158, 11, 0.18);
    color: #b45309;
    border: 1px solid #f59e0b;
}
.legend-badge--crit {
    background: rgba(239, 68, 68, 0.18);
    color: #b91c1c;
    border: 1px solid #ef4444;
}
:deep(.app-dark) .legend-badge--warn,
.app-dark .legend-badge--warn {
    color: #fbbf24;
}
:deep(.app-dark) .legend-badge--crit,
.app-dark .legend-badge--crit {
    color: #fca5a5;
}

.kpi-card--warn {
    border-color: #f59e0b !important;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, var(--p-surface-50) 60%);
}
:deep(.app-dark) .kpi-card--warn,
.app-dark .kpi-card--warn {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, var(--p-surface-900) 60%);
}
.kpi-card--warn .kpi-value::before {
    content: "⚠ ";
    color: #f59e0b;
}
.kpi-card--crit {
    border-color: #ef4444 !important;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, var(--p-surface-50) 60%);
    animation: crit-pulse 2.5s ease-in-out infinite;
}
:deep(.app-dark) .kpi-card--crit,
.app-dark .kpi-card--crit {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.28) 0%, var(--p-surface-900) 60%);
}
.kpi-card--crit .kpi-value::before {
    content: "🔴 ";
}
@keyframes crit-pulse {
    0%,
    100% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
    }
    50% {
        box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
    }
}

.chart-wrap--warn {
    border-color: #f59e0b !important;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, var(--p-surface-50) 60%);
}
:deep(.app-dark) .chart-wrap--warn,
.app-dark .chart-wrap--warn {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, var(--p-surface-900) 60%);
}
.chart-wrap--warn h4::before {
    content: "⚠ ";
    color: #f59e0b;
}
.chart-wrap--crit {
    border-color: #ef4444 !important;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, var(--p-surface-50) 60%);
}
:deep(.app-dark) .chart-wrap--crit,
.app-dark .chart-wrap--crit {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.24) 0%, var(--p-surface-900) 60%);
}
.chart-wrap--crit h4::before {
    content: "🔴 ";
}

.http-table :deep(.http-row--warn) {
    background: rgba(245, 158, 11, 0.12) !important;
}
.http-table :deep(.http-row--crit) {
    background: rgba(239, 68, 68, 0.18) !important;
}
:deep(.app-dark) .http-table :deep(.http-row--warn),
.app-dark .http-table :deep(.http-row--warn) {
    background: rgba(245, 158, 11, 0.22) !important;
}
:deep(.app-dark) .http-table :deep(.http-row--crit),
.app-dark .http-table :deep(.http-row--crit) {
    background: rgba(239, 68, 68, 0.28) !important;
}
.delta-positive {
    color: var(--p-text-color);
    font-weight: 600;
}

.live-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
    animation: pulse-dot 2s infinite;
}
@keyframes pulse-dot {
    0% {
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
    }
    70% {
        box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
    }
}
</style>
