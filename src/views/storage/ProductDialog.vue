<script setup>
import axiosInstance from "@/service/axios"
import { productService } from "@/service/products/product.service"
import { useMutation, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { ref, watchEffect } from "vue"

const props = defineProps({
    visible: Boolean,
    product: [String, Boolean],
    submitted: Boolean,
    categories: Array
})
const queryClient = useQueryClient()
const emit = defineEmits(["hideDialog"])

const toast = useToast()
const visible = ref(props.visible)
const product = props.product ? ref(props.product) : ref({})
const categories = ref(props.categories)
const submitted = ref(false)
const deleteProductDialog = ref(false)
const { isError, data, error, isSuccess, isFetching } = productService.getProductById(props.product)
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
        queryClient.setQueryData(["product", props.product], {})
        queryClient.invalidateQueries({ queryKey: ["products"] })
        product.value = false
        toast.add({
            severity: "success",
            summary: "Успешно",
            detail: `${product.value.name} удален`,
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
    mutate(product.value)
}
</script>

<template>
    <Dialog v-model:visible="visible" :style="{ width: '450px' }" header="Детали позиции" :modal="true" v-on:update:visible="emit('hideDialog')">
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
                                const value = e.target.value
                                if (isNan(value)) {
                                    product.price = ''
                                } else if (value < 0) {
                                    product.price = 0
                                } else {
                                    product.price = value
                                }
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
                    <Select :invalid="submitted && !product.category" v-model="product.category" editable :options="categories" placeholder="Введите" class="w-full md:w-56" />
                    <small v-if="submitted && !product.category" class="text-red-500">Введите категорию.</small>
                </div>
                <div class="col-span-2 justify-items-center">
                    <label for="quantity" class="block font-bold mb-3"><i class="pi pi-database"></i></label>
                    <InputText type="number" id="quantity" inputClass="text-center" v-model.number="product.quantity" disabled fluid />
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
