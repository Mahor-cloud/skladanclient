<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { dateTime } from "@/domain/format"
import axiosInstance from "@/service/axios"
import { confirm, toast, UiBtn, UiEmpty, UiError, UiIconBtn, UiPage, UiSk } from "@/ui"
import { useInfiniteQuery, useQueryClient } from "@tanstack/vue-query"
import { computed, onBeforeUnmount, watch } from "vue"
import { toMark, who } from "./feedback"
import { errText, useFeedbackUnread } from "./queries"

// Обратная связь пользователей: новые сверху, страницами. Супер-админ событий не получает — список и значок обновляются раз в минуту.
const queryClient = useQueryClient()
const { data: unread } = useFeedbackUnread()
const { data, isPending, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } = useInfiniteQuery({
    queryKey: ["feedback", "list"],
    queryFn: async ({ pageParam }) => (await axiosInstance.get("/feedback", { params: { limit: 30, before: pageParam || undefined } })).data,
    initialPageParam: "",
    getNextPageParam: (last) => (last.more ? last.items.at(-1)._id : undefined),
    refetchInterval: 60_000,
    staleTime: 0
})
const items = computed(() => data.value?.pages.flatMap((p) => p.items) ?? [])
const refresh = (n) => {
    if (n != null) queryClient.setQueryData(["feedback-unread"], n)
    else queryClient.invalidateQueries({ queryKey: ["feedback-unread"] })
    queryClient.invalidateQueries({ queryKey: ["feedback", "list"] })
}

/* Показанные новые отмечаются прочитанными через полторы секунды — чтобы отметку «новое» успели увидеть */
const queued = new Set()
let pending = []
let timer = null
watch(items, (list) => {
    const ids = toMark(list, queued)
    if (!ids.length) return
    ids.forEach((id) => queued.add(id))
    pending.push(...ids)
    clearTimeout(timer)
    timer = setTimeout(() => {
        const batch = pending
        pending = []
        markRead(batch)
    }, 1500)
})
onBeforeUnmount(() => clearTimeout(timer))
async function markRead(ids) {
    try {
        const { data } = await axiosInstance.post("/feedback/read", ids ? { ids } : {})
        refresh(data.unread)
    } catch {
        // не отметилось — отметится при следующем показе
        ids?.forEach((id) => queued.delete(id))
    }
}

async function remove(m) {
    if (!(await confirm({ title: "Удалить сообщение?", ok: "Удалить", okIcon: "trash", tone: "danger" }))) return
    try {
        await axiosInstance.delete(`/feedback/${m._id}`)
        toast({ type: "success", title: "Сообщение удалено" })
    } catch (e) {
        toast({ type: "error", title: "Не удалено", text: errText(e) })
    }
    refresh()
}
async function removeAll(read) {
    const ok = await confirm({ title: read ? "Удалить прочитанные?" : "Удалить все сообщения?", ok: "Удалить", okIcon: "trash", tone: "danger" })
    if (!ok) return
    try {
        const { data } = await axiosInstance.delete("/feedback", { params: read ? { read: 1 } : {} })
        toast({ type: "success", title: `Удалено: ${data.deleted}` })
    } catch (e) {
        toast({ type: "error", title: "Не удалено", text: errText(e) })
    }
    refresh()
}
</script>

<template>
    <UiPage title="Обратная связь" :sub="unread ? `новых: ${unread}` : ''">
        <template #actions>
            <UiIconBtn v-if="unread" icon="check" label="Прочитано всё" @click="markRead()" />
        </template>
        <template #deskActions>
            <UiBtn v-if="unread" label="Прочитано всё" icon="check" kind="outline" @click="markRead()" />
        </template>

        <div v-if="isError && !data" class="card card--pad"><UiError title="Не удалось загрузить «Обратная связь»" @retry="refetch()" /></div>
        <div v-else-if="isPending" class="fbs" aria-hidden="true">
            <div v-for="i in 3" :key="i" class="card fbm"><UiSk w="50%" :h="16" /><UiSk w="70%" :h="12" /><UiSk :h="40" /></div>
        </div>
        <div v-else-if="!items.length" class="card"><UiEmpty art="box" title="Сообщений нет" /></div>
        <template v-else>
            <div class="fbs">
                <article v-for="m in items" :key="m._id" class="card fbm" :class="{ 'fbm--new': !m.readAt }">
                    <div class="fbm__top">
                        <p class="fbm__who">
                            <b>{{ m.company?.name || "—" }}</b
                            ><small>{{ who(m.user) }} · {{ dateTime(m.createdAt) }}</small>
                        </p>
                        <span v-if="!m.readAt" class="tag tag--accent-soft">Новое</span>
                        <UiIconBtn icon="trash" label="Удалить сообщение" kind="danger" @click="remove(m)" />
                    </div>
                    <p class="fbm__text">{{ m.text }}</p>
                </article>
            </div>
            <UiBtn v-if="hasNextPage" class="fbs__more" label="Показать ещё" kind="secondary" block :loading="isFetchingNextPage" @click="fetchNextPage()" />
            <div class="fbs__acts">
                <UiBtn label="Удалить прочитанные" icon="trash" kind="outline" @click="removeAll(true)" />
                <UiBtn label="Удалить все" icon="trash" kind="danger-ghost" @click="removeAll(false)" />
            </div>
        </template>
    </UiPage>
</template>
