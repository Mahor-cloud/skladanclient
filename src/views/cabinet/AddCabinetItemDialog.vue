<script setup>
import axiosInstance from "@/service/axios"
import { useMutation, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, ref, watch } from "vue"

const props = defineProps({
    visible: { type: Boolean, default: false },
    item: { type: Object, default: null }
})
const emit = defineEmits(["close"])

const toast = useToast()
const queryClient = useQueryClient()

const isEdit = computed(() => !!props.item?.cabinetItemId)

const customName = ref(props.item?.customName ?? "")
const baseQty = ref(Number(props.item?.baseQty || 0))
const currentQty = ref(Number(props.item?.currentQty || 0))
const customPrice = ref(Number(props.item?.customPrice ?? props.item?.price ?? 0))
const submitted = ref(false)

watch(
    () => props.item,
    (next) => {
        customName.value = next?.customName ?? ""
        baseQty.value = Number(next?.baseQty || 0)
        currentQty.value = Number(next?.currentQty || 0)
        customPrice.value = Number(next?.customPrice ?? next?.price ?? 0)
    }
)

const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
        const payload = {
            customName: customName.value.trim(),
            baseQty: Number(baseQty.value) || 0,
            currentQty: Number(currentQty.value) || 0,
            customPrice: Number(customPrice.value) || 0
        }
        if (isEdit.value) {
            return await axiosInstance.put(`/cabinet/${props.item.cabinetItemId}`, payload)
        }
        return await axiosInstance.post("/cabinet", payload)
    },
    onSuccess: () => {
        toast.add({
            severity: "success",
            summary: isEdit.value ? "Изменения сохранены" : "Позиция добавлена",
            life: 2000
        })
        queryClient.invalidateQueries({ queryKey: ["cabinet-merged"] })
        emit("close")
    },
    onError: (e) => {
        toast.add({
            severity: "error",
            summary: "Ошибка",
            detail: e?.response?.data?.message || e.message,
            life: 4000
        })
    }
})

function onSubmit() {
    submitted.value = true
    if (!customName.value?.trim()) return
    save()
}
</script>

<template>
    <Dialog
        :visible="props.visible"
        :style="{ width: '95%', maxWidth: '460px' }"
        :breakpoints="{ '768px': '100vw' }"
        :header="isEdit ? 'Редактирование позиции' : 'Добавить свою позицию'"
        modal
        v-on:update:visible="emit('close')"
    >
        <div class="form-stack">
            <small class="muted">
                Товары со склада уже есть в списке — менять цель/количество прямо в строке.
                Здесь добавляются «свои» позиции, которых нет на складе.
            </small>

            <div class="form-row">
                <label>Название позиции</label>
                <InputText
                    v-model="customName"
                    placeholder="Например: домашние записи"
                    :invalid="submitted && !customName?.trim()"
                    fluid
                />
                <small v-if="submitted && !customName?.trim()" class="text-danger">Введите название</small>
            </div>

            <div class="form-grid">
                <div class="form-row">
                    <label>Цель</label>
                    <InputNumber v-model="baseQty" :min="0" :useGrouping="false" fluid />
                </div>
                <div class="form-row">
                    <label>У меня</label>
                    <InputNumber v-model="currentQty" :min="0" :useGrouping="false" fluid />
                </div>
            </div>

            <div class="form-row">
                <label>Цена за единицу</label>
                <InputNumber
                    v-model="customPrice"
                    :min="0"
                    :useGrouping="false"
                    mode="currency"
                    currency="RUB"
                    :minFractionDigits="0"
                    :maxFractionDigits="0"
                    fluid
                />
                <small class="muted">Справочно — не учитывается в денежном дефиците на главной.</small>
            </div>
        </div>
        <template #footer>
            <Button label="Отмена" icon="pi pi-times" text @click="emit('close')" :disabled="isPending" />
            <Button label="Сохранить" icon="pi pi-check" :loading="isPending" @click="onSubmit" />
        </template>
    </Dialog>
</template>

<style scoped>
.form-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.form-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.form-row label {
    font-size: 14px;
    opacity: 0.8;
}
.form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}
.text-danger {
    color: #ef4444;
    font-size: 12px;
}
.muted {
    opacity: 0.7;
    font-size: 12px;
    line-height: 1.4;
}
</style>
