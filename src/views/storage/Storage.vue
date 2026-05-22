<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import axiosInstance from "@/service/axios"
import { productService } from "@/service/products/product.service"
import { FilterMatchMode } from "@primevue/core/api"
import { useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, ref, watchEffect } from "vue"
import ProductDialog from "./ProductDialog.vue"

const toast = useToast()
const dt = ref()
const products = ref()
const productDialog = ref(false)
const buyProductDialog = ref(false)
const buySubmitted = ref(false)
const product = ref({})
const categories = ref([])
const queryClient = useQueryClient()
const available = ref(true)

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    category: { value: null, matchMode: FilterMatchMode.IN }
})
const clearFilter = () => {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        category: { value: null, matchMode: FilterMatchMode.IN }
    }
}

const user = ref(JSON.parse(localStorage.getItem("user") || "null"))

const { isError, data, error, isSuccess, isFetching, failureCount } = productService.getProducts()

const showSkeleton = computed(() => !isSuccess.value || failureCount.value > 0)

const storageSkeletonRows = Array.from({ length: 12 }, (_, i) => ({ _id: `sk-${i}`, _skeleton: true }))

const {
    data: ordersData,
    isSuccess: isOrdersSuccess,
    refetch: refetchOrders
} = useQuery({
    queryKey: ["orders"],
    queryFn: async () => await axiosInstance.get("/orders"),
    refetchOnWindowFocus: true,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const {
    data: purchasesData,
    isSuccess: isPurchasesSuccess,
    refetch: refetchPurchases
} = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => await axiosInstance.get("/purchases"),
    refetchOnWindowFocus: true,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const { data: msgsData } = useQuery({
    queryKey: ["msgs"],
    queryFn: async () => await axiosInstance.get("/database/msg"),
    select: (data) => data.data || {},
    staleTime: 1000 * 60 * 5
})

const targetWarehouseValue = computed(() => Number(msgsData.value?.targetWarehouseValue) || 0)
const warehouseGap = computed(() => (totalAmount.value || 0) - targetWarehouseValue.value)

const totalAmount = computed(() => {
    return data?.value?.reduce((acc, product) => acc + product.price * product.quantity, 0)
})
const orderAmount = computed(() => {
    return ordersData?.value?.reduce((acc, order) => {
        if (order.isCompleted) {
            return acc
        }
        return (
            acc +
            order.items.reduce((sum, item) => {

                const p = data?.value?.find((product) => item.product === product._id)
                return sum + (p ? p.price * item.quantity : 0)
            }, 0)
        )
    }, 0)
})

const purchasesAmount = computed(() => {
    return purchasesData?.value?.reduce((acc, purchase) => {
        if (purchase.isCompleted) {
            return acc
        }
        return (
            acc +
            purchase.items.reduce((sum, item) => {
                const p = data?.value?.find((product) => item.product === product._id)
                return sum + (p ? p.price * item.quantity : 0)
            }, 0)
        )
    }, 0)
})

const editProduct = (_id) => {
    product.value = _id
    productDialog.value = true
}

watchEffect(() => {
    if (isSuccess.value) {
        products.value = data.value

        categories.value = [...new Set(data.value.map((p) => p.category).filter(Boolean))].map((category) => ({ category }))
    }
})

function formatCurrency(value) {
    if (value) return value.toLocaleString("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    return
}

function openNew() {
    product.value = false
    productDialog.value = true
}

function hideDialog() {
    product.value = {}
    productDialog.value = false
}

function confirmBuyProduct(prod) {
    buySubmitted.value = false
    product.value = { ...prod }
    const cart = JSON.parse(localStorage.getItem("cart")) || {}
    if (cart[product.value._id]) {
        product.value.buyQuantity = cart[product.value._id]
    } else {
        product.value.buyQuantity = 0
    }
    buyProductDialog.value = true
}

function buyProduct() {

    const el = document.activeElement
    if (el && typeof el.blur === "function") el.blur()
    let qty = parseInt(product?.value?.buyQuantity, 10)
    if (!Number.isFinite(qty) || qty < 0) qty = 0
    if (qty > product?.value?.quantity) qty = product.value.quantity
    product.value.buyQuantity = qty

    buySubmitted.value = true

    if (product?.value.buyQuantity <= product?.value.quantity && product?.value.buyQuantity > 0) {
        const cart = JSON.parse(localStorage.getItem("cart")) || {}
        cart[product.value._id] = product.value.buyQuantity
        localStorage.setItem("cart", JSON.stringify(cart))
        buyProductDialog.value = false
        buySubmitted.value = false
        toast.add({
            severity: "success",
            summary: "Успешно",
            detail: `${product.value.name} добавлен в корзину`,
            life: 3000
        })
        product.value = {}
        queryClient.invalidateQueries({ queryKey: ["cartAmount"] })
    }
}

function hideBuyDialog() {
    buyProductDialog.value = false
    buySubmitted.value = false
}
</script>

<template>
    <div>
        <div class="col-span-12 lg:col-span-6 xl:col-span-3 mb-4">

            <div class="card mb-0" style="min-height: 16rem">
                <div class="mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Сумма склада</span>
                        <Skeleton v-if="!isSuccess" width="8rem" height="1.5rem" />
                        <div v-else class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ formatCurrency(totalAmount) }}</div>
                    </div>
                </div>
                <div class="block">
                    <span class="text-muted-color">Текущих заказов: </span>
                    <Skeleton v-if="!isOrdersSuccess" width="6rem" height="1rem" class="inline-block align-middle" />
                    <span v-else class="text-primary font-medium">{{ formatCurrency(orderAmount) }}</span>
                </div>

                <div class="block">
                    <span class="text-muted-color">Текущих закупок: </span>
                    <Skeleton v-if="!isPurchasesSuccess" width="6rem" height="1rem" class="inline-block align-middle" />
                    <span v-else class="text-cyan-800 font-medium">{{ formatCurrency(purchasesAmount) }}</span>
                </div>

                <div v-if="targetWarehouseValue > 0" class="block">
                    <span class="text-muted-color">Целевая сумма склада: </span>
                    <span class="font-medium">{{ formatCurrency(targetWarehouseValue) }}</span>
                </div>
                <div v-if="targetWarehouseValue > 0" class="block">
                    <span class="text-muted-color">{{ warehouseGap >= 0 ? 'Профицит' : 'Дефицит' }}: </span>
                    <span
                        :class="warehouseGap >= 0 ? 'font-medium text-green-600' : 'font-medium text-red-500'"
                    >{{ formatCurrency(Math.abs(warehouseGap)) }}</span>
                </div>
            </div>
        </div>
        <div class="card" style="padding: 10px">
            <Toolbar v-if="user.role?.permissions?.includes('create_product')" class="mb-6">
                <template #start>
                    <Button label="Новый" icon="pi pi-plus" severity="secondary" class="mr-2" @click="openNew" />
                </template>
            </Toolbar>

            <DataTable
                ref="dt"
                size="small"
                scrollable
                class="sticky-actions-table"
                :value="showSkeleton || !products ? storageSkeletonRows : products"
                dataKey="_id"
                :paginator="true"
                :rows="50"
                :rowsPerPageOptions="[25, 50, 100, 200]"
                v-model:filters="filters"
                :globalFilterFields="['name', 'price', 'category']"
                filterDisplay="menu"
                show-gridlines
                :loading="showSkeleton"
                :rowClass="(data) => (data && !data._skeleton && (data.quantity ?? 0) < 0 ? 'storage-row-negative' : '')"
            >
                <template #header>
                    <div class="storage-header">
                        <div class="storage-header__filters">
                            <Button type="button" icon="pi pi-filter-slash" aria-label="Сбросить фильтры" outlined @click="clearFilter()" />
                            <label class="storage-header__avail">
                                <Checkbox v-model="available" binary name="test" />
                                <span>Доступные</span>
                            </label>
                        </div>
                        <IconField class="storage-header__search">
                            <InputIcon>
                                <i class="pi pi-search" />
                            </InputIcon>
                            <InputText v-model="filters['global'].value" placeholder="Поиск..." style="font-size: 16px; width: 100%" />
                        </IconField>
                    </div>
                </template>

                <Column field="name" header="Название" style="min-width: 8rem; padding: 0.3rem">
                    <template #body="slotProps">
                        <Skeleton v-if="slotProps.data._skeleton" width="80%" height="1rem" />
                        <span v-else>{{ slotProps.data.name }}</span>
                    </template>
                </Column>
                <Column field="price" header="Цена" style="text-align: center; min-width: 4rem; padding: 0.3rem">
                    <template #body="slotProps">
                        <Skeleton v-if="slotProps.data._skeleton" width="3rem" height="1rem" />
                        <span v-else>{{ formatCurrency(slotProps.data.price) }}</span>
                    </template>
                </Column>
                <Column header="Вид" field="category" filterField="category" :showFilterMatchModes="false" filterMenuStyle="{ width: '14rem' }" style="padding: 0.3rem">
                    <template #body="{ data }">
                        <Skeleton v-if="data._skeleton" width="60%" height="1rem" />
                        <span v-else>{{ data.category }}</span>
                    </template>
                    <template #filter="{ filterModel, applyFilter }">
                        <MultiSelect
                            style="max-width: 200px"
                            appendTo="self"
                            v-model="filterModel.value"
                            :options="categories"
                            showClear
                            optionLabel="category"
                            optionValue="category"
                            placeholder="Все"
                            @change="applyFilter"
                        >
                            <template #option="slotProps">
                                <div class="flex items-center">
                                    <span>{{ slotProps.option.category }}</span>
                                </div>
                            </template>
                        </MultiSelect>
                    </template>
                </Column>
                <Column field="quantity" style="min-width: 60px; padding: 0.3rem">
                    <template #header><i class="pi pi-database"></i></template>
                    <template #body="slotProps">
                        <Skeleton v-if="slotProps.data._skeleton" width="2rem" height="1rem" />
                        <span v-else>{{ available ? slotProps.data.quantity : slotProps.data.totalQuantity }}</span>
                    </template>
                </Column>
                <Column v-if="user.role?.permissions?.includes('create_orders') || user.role?.permissions?.includes('edit_products')" :exportable="false" frozen alignFrozen="right" style="min-width: 92px; width: 92px" bodyStyle="text-align:center; padding:4px">
                    <template #body="slotProps">
                        <div v-if="slotProps.data._skeleton" class="flex items-center justify-center gap-2">
                            <Skeleton shape="circle" size="2rem" />
                            <Skeleton shape="circle" size="2rem" />
                        </div>
                        <div v-else class="flex items-center justify-center">
                            <Button v-if="user.role?.permissions?.includes('create_orders')" icon="pi pi-cart-plus" aria-label="Добавить в корзину" :disabled="(slotProps.data.quantity ?? 0) <= 0" outlined rounded class="mr-2" @click="confirmBuyProduct(slotProps.data)" />
                            <Button v-if="user.role?.permissions?.includes('edit_products')" icon="pi pi-pencil" aria-label="Редактировать товар" outlined rounded @click="editProduct(slotProps.data._id)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <ProductDialog v-if="productDialog && user.role?.permissions?.includes('edit_products')" v-model:visible="productDialog" :product="product" :categories="[...new Set(products.map((product) => product.category))]" @hideDialog="hideDialog" />

        <Dialog v-model:visible="buyProductDialog" :style="{ width: '350px' }" header="Добавить в корзину?" :modal="true">
            <div class="col-span-6">
                <label for="buyQuantity" class="block font-bold mb-3">{{ product.name }}</label>
                <InputText
                    inputmode="numeric"
                    v-model="product.buyQuantity"
                    @blur="
                        () => {
                            let v = parseInt(String(product.buyQuantity ?? '').replace(/\D+/g, ''), 10)
                            if (!Number.isFinite(v) || v < 0) v = 0
                            if (v > product.quantity) v = product.quantity
                            product.buyQuantity = v
                        }
                    "
                    style="font-size: 16px"
                    id="buyQuantity"
                    fluid
                />
                <small v-if="buySubmitted" class="text-red-500">{{ `Доступно к покупке  ${product.quantity}` }}</small>
                <small v-else class="text-primary"> Доступно {{ product.quantity }}</small>
            </div>
            <template #footer>
                <Button label="Нет" icon="pi pi-times" text @click="hideBuyDialog" />
                <Button label="Да" :disabled="product.buyQuantity == 0 || !product.buyQuantity" icon="pi pi-check" @click="buyProduct" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>

.storage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}
.storage-header__filters {
    display: flex;
    align-items: center;
    gap: 10px;
}
.storage-header__avail {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
}
.storage-header__search {
    flex: 1 1 220px;
    min-width: 0;
    max-width: 320px;
    display: flex;
}
@media (max-width: 560px) {
    .storage-header {
        flex-direction: column;
        align-items: stretch;
    }
    .storage-header__filters {
        justify-content: space-between;
    }
    .storage-header__search {
        flex: 1 1 auto;
        max-width: 100%;
    }
}
:deep(.storage-row-negative > td) {
    background-color: rgba(239, 68, 68, 0.12) !important;
    color: rgb(185, 28, 28);
    font-weight: 600;
}
:global(.app-dark) :deep(.storage-row-negative > td) {
    background-color: rgba(239, 68, 68, 0.2) !important;
    color: rgb(252, 165, 165);
}
</style>
