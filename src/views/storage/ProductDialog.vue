<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import axiosInstance from "@/service/axios"
import { productService } from "@/service/products/product.service"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, ref, watchEffect } from "vue"

const props = defineProps({
    visible: Boolean,
    product: [String, Boolean],
    submitted: Boolean,
    categories: Array
})
const queryClient = useQueryClient()
const emit = defineEmits(["hideDialog"])

const toast = useToast()

const visible = computed(() => props.visible)
const product = props.product ? ref(props.product) : ref({})
const categories = ref(props.categories)
const submitted = ref(false)

const categorySuggestions = ref([])
function searchCategory(e) {
    const q = (e.query || "").toLowerCase()
    const all = (categories.value || []).filter(Boolean)
    categorySuggestions.value = q ? all.filter((c) => String(c).toLowerCase().includes(q)) : [...all]
}
const deleteProductDialog = ref(false)
const currentUser = ref(JSON.parse(localStorage.getItem("user") || "null"))
const canViewSummary = computed(() => !!currentUser.value?.role?.permissions?.includes("view_cabinet_summary"))
const isAdmin = computed(() => !!currentUser.value?.isAdmin)
const { isError, data, error, isSuccess, isFetching } = productService.getProductById(props.product)

const { data: cabinetSummary } = useQuery({
    queryKey: ["cabinet-summary"],
    queryFn: async () => (await axiosInstance.get("/cabinet/summary")).data,
    enabled: canViewSummary.value,
    staleTime: 60_000
})

const totalRepresentativeTarget = computed(() => {
    if (!props.product || !cabinetSummary.value) return null
    const row = cabinetSummary.value.find((r) => String(r.productId) === String(props.product))
    return row ? { totalBaseQty: row.totalBaseQty, usersCount: row.usersCount, totalCurrentQty: row.totalCurrentQty } : { totalBaseQty: 0, usersCount: 0, totalCurrentQty: 0 }
})
const { mutate, isPending } = useMutation({
    mutationKey: ["product", props.product],
    mutationFn: async (product) => {
        if (props.product) {
            return await axiosInstance.put(`/products/${props.product}`, product)
        }
        return await axiosInstance.post("/products", { ...product, quantity: 0 })
    },
    onSuccess: (data) => {
        props.product && queryClient.setQueryData(["product", props.product], data)
        queryClient.invalidateQueries({ queryKey: ["products"] })
        props.product ? toast.add({ severity: "success", summary: "Успешно", detail: `${product.value.name} обновлен`, life: 3000 }) : toast.add({ severity: "success", summary: "Успешно", detail: `${product.value.name} добавлен`, life: 3000 })
        product.value = false
        emit("hideDialog")
    }
})

const { mutate: deleteProduct } = useMutation({
    mutationKey: ["product", props.product],
    mutationFn: async (product) => {
        return await axiosInstance.delete(`/products/${props.product}`)
    },
    onSuccess: (data) => {

        const removedName = product.value?.name || "Товар"
        queryClient.setQueryData(["product", props.product], {})
        queryClient.invalidateQueries({ queryKey: ["products"] })
        product.value = false
        toast.add({
            severity: "success",
            summary: "Успешно",
            detail: `${removedName} удален`,
            life: 3000
        })
        emit("hideDialog")
    }
})

watchEffect(() => {
    if (isSuccess.value) {
        product.value = { ...data.value }
    }
})

const saveProduct = () => {
    if (JSON.stringify(product.value) === JSON.stringify(data.value)) return emit("hideDialog")
    submitted.value = true
    if (!product.value.name || !product.value.category || !product.value.price) return
    const payload = {
        name: product.value.name,
        category: product.value.category,
        price: Number(product.value.price) || 0,
        targetQty: Number(product.value.targetQty) || 0
    }
    if (props.product && Number(product.value.quantity) !== Number(data.value?.quantity)) {
        payload.quantity = Number(product.value.quantity) || 0
    }
    mutate(payload)
}
</script>

<template>
    <Dialog :visible="visible" :style="{ width: '450px' }" header="Детали позиции" :modal="true" @update:visible="emit('hideDialog')">
        <div class="flex flex-col gap-6">
            <div>
                <label for="name" class="block font-bold mb-3">Название</label>
                <InputText id="name" autocomplete="off" v-model.trim="product.name" required="true" autofocus :invalid="submitted && !product.name" fluid />
                <small v-if="submitted && !product.name" class="text-red-500">Название необходимо.</small>
            </div>

            <div class="grid grid-cols-12 gap-4">
                <div class="col-span-4">
                    <label for="price" class="block font-bold mb-3">Цена</label>
                    <InputText
                        type="number"
                        @input="
                            (e) => {
                                const value = parseInt(e.target.value)
                                if (isNaN(value)) {
                                    product.price = ''
                                } else if (value < 0) {
                                    product.price = 0
                                } else {
                                    product.price = value
                                }
                                e.target.value = product.price
                            }
                        "
                        id="price"
                        :invalid="submitted && !product.price"
                        :value="product.price"
                        fluid
                    />
                    <small v-if="submitted && !product.price" class="text-red-500">Введите цену.</small>
                </div>
                <div class="col-span-6">
                    <label for="category" class="block font-bold mb-3">Категория</label>
                    <AutoComplete
                        v-model="product.category"
                        :suggestions="categorySuggestions"
                        @complete="searchCategory"
                        dropdown
                        :invalid="submitted && !product.category"
                        placeholder="Введите или выберите"
                        class="w-full"
                        inputClass="w-full"
                        :inputStyle="{ fontSize: '16px', minHeight: '44px', width: '100%' }"
                        :delay="0"
                        :completeOnFocus="true"
                    />
                    <small v-if="submitted && !product.category" class="text-red-500">Введите категорию.</small>
                </div>
                <div class="col-span-2 justify-items-center">
                    <label for="quantity" class="block font-bold mb-3"><i class="pi pi-database"></i></label>
                    <InputText type="number" id="quantity" inputClass="text-center" v-model.number="product.quantity" disabled fluid />
                </div>
            </div>

            <div>
                <label for="targetQty" class="block font-bold mb-2">Цель закупки</label>
                <InputText
                    type="number"
                    id="targetQty"
                    v-model.number="product.targetQty"
                    :placeholder="'0 — без ограничения'"
                    :disabled="!isAdmin"
                    fluid
                />
                <small v-if="isAdmin" class="text-surface-500">Если 0 — нет ограничения. Цель ограничивает закупку: кладовщик не сможет заказать в закупке больше цели без подтверждения администратора.</small>
                <small v-else class="text-surface-500">Цель закупки задаёт только главный администратор компании.</small>
            </div>

            <div v-if="canViewSummary && totalRepresentativeTarget" class="rep-summary">
                <div class="rep-summary__title">Общие цели представителей</div>
                <div class="rep-summary__row">
                    <span>Суммарная цель:</span>
                    <b>{{ totalRepresentativeTarget.totalBaseQty }}</b>
                </div>
                <div class="rep-summary__row">
                    <span>У представителей сейчас:</span>
                    <b>{{ totalRepresentativeTarget.totalCurrentQty }}</b>
                </div>
                <div class="rep-summary__row">
                    <span>Заказчиков с этим товаром:</span>
                    <b>{{ totalRepresentativeTarget.usersCount }}</b>
                </div>
            </div>
        </div>

        <template #footer>
            <Button label="Отмена" icon="pi pi-times" text @click="emit('hideDialog')" />
            <Button label="Сохранить" icon="pi pi-check" @click="saveProduct" />
            <Button :disabled="!props.product" label="Удалить" icon="pi pi-trash" severity="danger" @click="deleteProductDialog = true" />
        </template>
    </Dialog>

    <Dialog v-model:visible="deleteProductDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span v-if="product"
                >Вы уверенны что хотите удалить <b>{{ product.name }}</b> ?</span
            >
        </div>
        <template #footer>
            <Button label="Нет" icon="pi pi-times" text @click="deleteProductDialog = false" />
            <Button label="Да" icon="pi pi-check" @click="deleteProduct(props.product)" />
        </template>
    </Dialog>
</template>

<style scoped>
.rep-summary {
    background: var(--p-content-background, rgba(0, 0, 0, 0.02));
    border: 1px dashed var(--p-content-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 8px;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.rep-summary__title {
    font-weight: 600;
    font-size: 13px;
    opacity: 0.85;
    margin-bottom: 4px;
}
.rep-summary__row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
}
</style>
