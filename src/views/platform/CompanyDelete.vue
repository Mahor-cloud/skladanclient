<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import axiosInstance from "@/service/axios"
import { backTo, toast, UiBtn, UiField, UiIcon, UiSheet } from "@/ui"
import { useQueryClient } from "@tanstack/vue-query"
import { computed, ref, watch } from "vue"
import { useRouter } from "vue-router"
import { errText, useCompanies } from "./queries"

// Полное удаление компании со всеми данными — окно по адресу /companies/:id/delete.
const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const queryClient = useQueryClient()
const { data: companies } = useCompanies()
// Компания запоминается один раз: после удаления список обновится раньше, чем окно доиграет закрытие.
const co = ref(null)
watch(
    companies,
    (list) => {
        if (!list || co.value) return
        co.value = list.find((c) => c._id === props.id) || null
        if (!co.value) router.replace({ name: "companies" })
    },
    { immediate: true }
)

const typed = ref("")
const match = computed(() => typed.value.trim() === co.value?.name)
const deleting = ref(false)
const sheet = ref(null)

async function remove() {
    if (!match.value) return toast({ type: "warning", title: "Не совпадает", text: "Введите точное название компании" })
    deleting.value = true
    let data
    try {
        data = (await axiosInstance.delete(`/companies/${props.id}/hard`, { data: { confirm: "i-know-what-i-am-doing" } })).data
    } catch (e) {
        return toast({ type: "error", title: "Ошибка", text: errText(e) })
    } finally {
        deleting.value = false
    }
    queryClient.invalidateQueries({ queryKey: ["companies"] })
    toast({ type: "success", title: "Компания удалена", text: `${data.deletedCompany}: удалены все её данные.` })
    sheet.value.close("save")
}
</script>

<template>
    <UiSheet v-if="co" ref="sheet" label="Удалить компанию полностью" size="sm" cls="ov--confirm" @close="backTo({ name: 'companies' })">
        <div class="confirm confirm--danger">
            <span class="confirm__i"><UiIcon name="trash" :size="26" /></span>
            <div class="confirm__t">
                <h3>Удалить «{{ co.name }}» полностью?</h3>
                <p>Это <b>безвозвратно</b> удалит местность и все её данные: пользователей, товары, заказы, закупки, инвентаризации, роли, сообщения, подписки и историю.</p>
            </div>
        </div>
        <div style="margin-top: var(--sp-6)">
            <UiField v-model="typed" :label="`Для подтверждения введите название: ${co.name}`" name="coname" :placeholder="co.name" autocomplete="off" @keydown.enter.prevent="remove" />
        </div>
        <template #footer="{ close }">
            <UiBtn label="Отмена" kind="secondary" size="lg" @click="close()" />
            <UiBtn label="Удалить навсегда" icon="trash" kind="danger" size="lg" :disabled="!match" :loading="deleting" @click="remove" />
        </template>
    </UiSheet>
</template>
