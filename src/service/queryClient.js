/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { QueryClient } from "@tanstack/vue-query"

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (failureCount, error) => {
                const status = error?.response?.status
                if (status === 429) {

                    console.warn(
                        `[api] 429 Too Many Requests — повтор #${failureCount + 1}: ` +
                            (error?.config?.url || "?")
                    )
                    return failureCount < 10
                }

                if (typeof status === "number" && status >= 400 && status < 500) return false

                return failureCount < 1
            },
            retryDelay: (attemptIndex, error) => {
                const status = error?.response?.status
                if (status === 429) return 1500
                return Math.min(1000 * 2 ** attemptIndex, 8000)
            },
            refetchOnWindowFocus: false
        },
        mutations: {
            retry: false
        }
    }
})
