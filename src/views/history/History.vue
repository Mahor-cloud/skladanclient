<script setup>
import axiosInstance from "@/service/axios"
import formatTimestamp from "@/service/DateService"
import { useQuery } from "@tanstack/vue-query"

const { data, isSuccess } = useQuery({
    queryKey: ["history"],
    queryFn: async () => await axiosInstance.get("/change-history"),
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})
</script>
<template>
    <div class="card">
        <div class="flex items-center justify-between mb-6">
            <div class="font-semibold text-xl">История изменений</div>
        </div>
        <div v-for="item in data" :key="item._id">
            <span class="block text-muted-color font-medium mb-4">
                <span v-if="item.user" class="text-surface-900 dark:text-surface-0 leading-normal"> {{ item.user?.name }}: </span>
                {{ item.changeType }}
            </span>
            <ul class="p-0 mx-0 mt-0 mb-6 list-none">
                <li class="flex items-center py-2 border-b border-surface">
                    <span class="text-surface-900 dark:text-surface-0 leading-normal min-w-[80px]">{{ formatTimestamp(item.changeDate) }}</span>
                    <span class="ml-1 text-surface-700 dark:text-surface-100">{{ item.description }}</span>
                </li>
            </ul>
        </div>
    </div>
</template>
