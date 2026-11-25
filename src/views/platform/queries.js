/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { useSession } from "@/composables/useSession"
import { isAuthenticated } from "@/service/auth/auth.helper"
import axiosInstance from "@/service/axios"
import { useQuery } from "@tanstack/vue-query"
import { computed } from "vue"

// Ключи и форма кэша — как в старых Companies.vue / Seeds.vue: в кэше сам ответ сервера.
export const useCompanies = () => useQuery({ queryKey: ["companies"], queryFn: async () => (await axiosInstance.get("/companies")).data, staleTime: 30_000 })
/** Сколько новых сообщений обратной связи (значок меню). Событий супер-админ не получает — раз в минуту. */
export const useFeedbackUnread = () =>
    useQuery({
        queryKey: ["feedback-unread"],
        queryFn: async () => (await axiosInstance.get("/feedback/unread")).data.unread,
        enabled: computed(() => isAuthenticated() && useSession().isSuper.value),
        refetchInterval: 60_000,
        staleTime: 30_000
    })
export const useSeeds = () => useQuery({ queryKey: ["seeds"], queryFn: async () => (await axiosInstance.get("/seeds")).data, staleTime: 30_000 })

/** Текст ошибки сервера, как в старом коде; проверка полей сервера отдаёт список строк. */
export const errText = (e) => [].concat(e?.response?.data?.message || e?.message).join(". ")
