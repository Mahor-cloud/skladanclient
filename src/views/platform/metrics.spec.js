/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { describe, expect, it } from "vitest"
import { buildHistory, httpRows, rssThresholds, sevHandles, sevHttp, sevLag, stats, sumByPrefix, uptime } from "./metrics"

const at = (min) => new Date(Date.UTC(2026, 10, 17, 10, min)).toISOString()

describe("metrics", () => {
    it("сумма по компаниям без ключей пика", () => {
        const p = { "skladan_sse_connections_active{company=a}": 3, "skladan_sse_connections_active{company=b}": 2, "skladan_sse_connections_active{company=a}_peak_5m": 9 }
        expect(sumByPrefix(p, "skladan_sse_connections_active")).toBe(5)
    })

    it("CPU за минуту: разрыв на перезапуске для графика, ноль для статистики", () => {
        const pts = [
            { at: at(0), payload: { process_cpu_user_seconds_total: 10 } },
            { at: at(5), payload: { process_cpu_user_seconds_total: 40 } }, // +30 сек за 5 мин → 6 сек/мин
            { at: at(10), payload: { process_cpu_user_seconds_total: 2 } } // перезапуск
        ]
        const h = buildHistory(pts)
        expect(h.cpuUser).toEqual([null, 6, null])
        expect(h.cpuUserStat).toEqual([6, 0])
        expect(stats(h.cpuUser)).toEqual({ min: 6, avg: 6, max: 6 })
    })

    it("p50/p95 по корзинам гистограммы и запросы за окно", () => {
        const L = "method=GET,route=/api/orders,status=200"
        const live = {
            [`http_request_duration_seconds_bucket{le=0.1,${L}}`]: 50,
            [`http_request_duration_seconds_bucket{le=0.5,${L}}`]: 90,
            [`http_request_duration_seconds_bucket{le=+Inf,${L}}`]: 100,
            [`http_request_duration_seconds_count{${L}}`]: 100,
            [`http_request_duration_seconds_sum{${L}}`]: 20,
            [`http_requests_total{${L}}`]: 100
        }
        const [r] = httpRows(live, { [`http_requests_total{${L}}`]: 70 })
        expect(r.count).toBe(100)
        expect(r.avg).toBeCloseTo(0.2)
        expect(r.p50).toBeCloseTo(0.1)
        // 95-й запрос — в корзине «+Inf»: берётся верхняя граница предыдущей
        expect(r.p95).toBeCloseTo(0.5)
        expect(r.delta).toBe(30)
        expect(httpRows(live, null)[0].delta).toBeNull()
    })

    it("пороги подсветки", () => {
        expect(rssThresholds(1000)).toEqual({ warn: 700, crit: 850 })
        expect(rssThresholds(null)).toEqual({ warn: 500, crit: 750 })
        expect(sevLag(60, 50)).toBe("warn")
        expect(sevLag(10, 600)).toBe("crit")
        expect(sevHttp({ p50: 0.01, p95: 0.25, count: 1500 })).toBe("crit")
        expect(sevHttp({ p50: 0.01, p95: 0.25, count: 500 })).toBe("ok")
        expect(sevHandles(60, { min: 10, max: 60 })).toBe("crit")
        expect(uptime(90061)).toBe("1 дн 1 ч 1 мин")
    })
})
