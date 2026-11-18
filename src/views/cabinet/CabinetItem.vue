<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import axiosInstance from "@/service/axios"
import { backTo, toast, UiBanner, UiBtn, UiField, UiSheet } from "@/ui"
import { useQuery, useQueryClient } from "@tanstack/vue-query"
import { computed, inject, reactive, ref, watch } from "vue"
import { useRouter } from "vue-router"
import { CAB } from "./cabinet"

// Своя позиция (не со склада): добавление (cabinet-item-new) и правка (cabinet-item) — окно поверх «Моего склада».
const props = defineProps({ id: { type: String, default: "" } })
const router = useRouter()
const queryClient = useQueryClient()
const { can } = useSession()
const { val, remove, drop } = inject(CAB)
const isNew = !props.id
const { data: rows } = useQuery({ queryKey: ["cabinet-merged"], queryFn: async () => (await axiosInstance.get("/cabinet/merged")).data, staleTime: 30_000, enabled: computed(() => can("cabinet_access")), shallow: true })
const row = computed(() => (rows.value || []).find((r) => r.isCustom && r.cabinetItemId === props.id))
const toCabinet = () => backTo({ name: "cabinet" })
// Позиции уже нет (удалили с другого устройства, чужой адрес) — назад к списку.
watch(
    () => [rows.value, row.value],
    () => {
        if (!isNew && rows.value && !row.value) router.replace({ name: "cabinet" })
    },
    { immediate: true }
)

const d = reactive({ customName: "", baseQty: "1", currentQty: "0", customPrice: "", note: "" })
let filled = isNew
// Окно заполняется один раз — в том числе несохранёнными значениями строки; дальнейшие обновления списка его не перетирают.
watch(
    row,
    (r) => {
        if (!r || filled) return
        filled = true
        Object.assign(d, { customName: r.productName, baseQty: String(val(r, "baseQty")), currentQty: String(val(r, "currentQty")), customPrice: r.price ? String(r.price) : "", note: r.note || "" })
    },
    { immediate: true }
)
const digits = (v) => String(v).replace(/\D/g, "")
const err = ref("")
const saving = ref(false)
const sheet = ref(null)
const nameField = ref(null)

async function save() {
    const name = d.customName.trim()
    if (!name) {
        err.value = "Введите название"
        return nameField.value?.focus()
    }
    saving.value = true
    const payload = { customName: name, baseQty: Number(d.baseQty) || 0, currentQty: Number(d.currentQty) || 0, customPrice: Number(d.customPrice) || 0, note: d.note.trim() }
    try {
        await (isNew ? axiosInstance.post("/cabinet", payload) : axiosInstance.put(`/cabinet/${props.id}`, payload))
    } catch (e) {
        saving.value = false
        return toast({ type: "error", title: "Ошибка", text: e?.response?.data?.message || e?.message })
    }
    if (row.value) drop(row.value)
    queryClient.invalidateQueries({ queryKey: ["cabinet-merged"] })
    toast({ type: "success", title: isNew ? "Позиция добавлена" : "Изменения сохранены", text: name })
    sheet.value.close("save")
}
function del() {
    const r = row.value
    sheet.value.close("del")
    remove(r)
}
</script>

<template>
    <UiSheet v-if="isNew || row" ref="sheet" :title="isNew ? 'Своя позиция' : 'Изменить позицию'" :sub="isNew ? '' : row.productName" size="md" @close="toCabinet">
        <form class="pform" novalidate @submit.prevent="save">
            <UiBanner tone="neutral" icon="info" text="Товары склада уже есть в списке — цель и запас меняются прямо в строке. Здесь — «свои» позиции, которых нет на складе." />
            <UiField
                ref="nameField"
                :model-value="d.customName"
                label="Название позиции"
                name="customName"
                placeholder="Например: домашние записи"
                :error="err"
                required
                maxlength="120"
                autocomplete="off"
                @update:model-value="(d.customName = $event), (err = '')"
            />
            <div class="pform__row">
                <UiField :model-value="d.baseQty" label="Цель" name="baseQty" inputmode="numeric" suffix="шт." @update:model-value="d.baseQty = digits($event)" />
                <UiField :model-value="d.currentQty" label="У меня" name="currentQty" inputmode="numeric" suffix="шт." @update:model-value="d.currentQty = digits($event)" />
            </div>
            <UiField :model-value="d.customPrice" label="Цена за единицу" name="customPrice" inputmode="numeric" suffix="₽" hint="Справочно — не учитывается в денежном дефиците на главной" @update:model-value="d.customPrice = digits($event)" />
            <UiField v-model="d.note" label="Заметка" name="note" maxlength="120" />
        </form>
        <template #footer="{ close }">
            <UiBtn v-if="!isNew" label="Удалить" icon="trash" kind="danger-ghost" size="lg" @click="del" />
            <UiBtn label="Отмена" kind="secondary" size="lg" :disabled="saving" @click="close()" />
            <UiBtn :label="isNew ? 'Добавить' : 'Сохранить'" icon="check" size="lg" :loading="saving" @click="save" />
        </template>
    </UiSheet>
</template>
