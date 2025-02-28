<script setup>
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

const user = ref(JSON.parse(localStorage.getItem("user")))

const { isError, data, error, isSuccess, isFetching } = productService.getProducts()

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

const totalAmount = computed(() => {
    return data?.value?.reduce((acc, product) => acc + product.price * product.quantity, 0)
})
const orderAmount = computed(() => {
    return ordersData?.value?.reduce((acc, order) => {
        if (order.isCompleted) {
            return acc
        }
        return acc + order.items.reduce((acc, item) => acc + data?.value?.find((product) => item.product === product._id).price * item.quantity, 0)
    }, 0)
})

const purchasesAmount = computed(() => {
    return purchasesData?.value?.reduce((acc, purchase) => {
        if (purchase.isCompleted) {
            return acc
        }
        return acc + purchase.items.reduce((acc, item) => acc + data?.value?.find((product) => item.product === product._id).price * item.quantity, 0)
    }, 0)
})

const editProduct = (_id) => {
    product.value = _id
    productDialog.value = true
}

watchEffect(() => {
    if (isSuccess.value) {
        products.value = data.value
        categories.value = [...new Set(data.value.map((product) => ({ category: product.category })))]
        refetchOrders()
        refetchPurchases()
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
            <div class="card mb-0">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Сумма склада</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ formatCurrency(totalAmount) }}</div>
                    </div>
                    <div class="flex items-center justify-center bg-cyan-100 dark:bg-cyan-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi text-cyan-800 !text-xl">₽</i>
                    </div>
                </div>
                <div class="block">
                    <span class="text-muted-color">Текущих заказов: </span>
                    <span class="text-primary font-medium">{{ formatCurrency(orderAmount) }}</span>
                </div>

                <div class="block">
                    <span class="text-muted-color">Текущих закупок: </span>
                    <span class="text-cyan-800 font-medium">{{ formatCurrency(purchasesAmount) }}</span>
                </div>
            </div>
        </div>
        <div class="card" style="padding: 10px">
            <Toolbar v-if="user.role?.permissions?.includes('create_product')" class="mb-6">
                <template #start>
                    <Button label="Новый" icon="pi pi-plus" severity="secondary" class="mr-2" @click="openNew" />
                </template>
            </Toolbar>

            <DataTable ref="dt" size="small" :value="products" dataKey="id" :paginator="true" :rows="100" v-model:filters="filters" :globalFilterFields="['name', 'price', 'category']" filterDisplay="menu" show-gridlines>
                <template #header>
                    <div class="flex flex-wrap gap-4 items-center justify-between">
                        <div class="flex items-center justify-center gap-2">
                            <Button type="button" icon="pi pi-filter-slash" outlined @click="clearFilter()" />
                            <Checkbox class="ml-4" v-model="available" binary name="test" />
                            <label>Доступные</label>
                        </div>
                        <div style="flex-grow: 1; max-width: 12rem" class="justify-end inline-flex">
                            <IconField>
                                <InputIcon>
                                    <i class="pi pi-search" />
                                </InputIcon>
                                <InputText style="max-width: 13rem; font-size: 0.8rem" v-model="filters['global'].value" placeholder="Поиск..." />
                            </IconField>
                        </div>
                    </div>
                </template>

                <Column field="name" header="Название" style="min-width: 8rem; padding: 0.3rem">
                    <template v-if="!isSuccess" #body>
                        <Skeleton></Skeleton>
                    </template>
                </Column>
                <Column field="price" header="Цена" style="text-align: center; min-width: 4rem; padding: 0.3rem">
                    <template #body="slotProps">
                        <Skeleton v-if="!isSuccess"></Skeleton>
                        {{ formatCurrency(slotProps.data.price) }}
                    </template>
                </Column>
                <Column header="Вид" filterField="category" :showFilterMatchModes="false" filterMenuStyle="{ width: '14rem' }" style="padding: 0.3rem">
                    <template #body="{ data }">
                        <Skeleton v-if="!isSuccess"></Skeleton>
                        <span>{{ data.category }}</span>
                    </template>
                    <template #filter="{ filterModel }">
                        <MultiSelect style="max-width: 200px" v-model="filterModel.value" :options="categories" showClear optionLabel="category" optionValue="category" placeholder="Все">
                            <template #option="slotProps">
                                <div class="flex items-center">
                                    <span>{{ slotProps.option.category }}</span>
                                </div>
                            </template>
                        </MultiSelect>
                    </template>
                </Column>
                <Column field="quantity" style="max-width: 60px; padding: 0.3rem">
                    <template #header><i class="pi pi-database"></i></template>
                    <template #body="slotProps">
                        <Skeleton v-if="!isSuccess"></Skeleton>
                        {{ available ? slotProps.data.quantity : slotProps.data.totalQuantity }}
                    </template>
                </Column>
                <Column v-if="user.role?.permissions?.includes('create_orders') || user.role?.permissions?.includes('edit_products')" :exportable="false" class="flex-wrap max-w-[82px]" style="padding: 0.1rem; min-width: 82px">
                    <template #body="slotProps">
                        <Skeleton v-if="!isSuccess"></Skeleton>
                        <div class="flex items-center justify-center">
                            <Button v-if="user.role?.permissions?.includes('create_orders')" icon="pi pi-cart-plus" :disabled="slotProps.data.quantity == 0" outlined rounded class="mr-2" @click="confirmBuyProduct(slotProps.data)" />
                            <Button v-if="user.role?.permissions?.includes('edit_products')" icon="pi pi-pencil" outlined rounded @click="editProduct(slotProps.data._id)" />
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
                    type="number"
                    @input="
                        (e) => {
                            const value = parseFloat(e.target.value)
                            if (isNan(value)) {
                                product.buyQuantity = ''
                            } else if (value < 0) {
                                product.buyQuantity = 0
                            } else if (value > product.quantity) {
                                product.buyQuantity = product.quantity
                            } else {
                                product.buyQuantity = value
                            }
                        }
                    "
                    style="font-size: 0.8rem"
                    id="buyQuantity"
                    :value="product.buyQuantity"
                    fluid
                    :useGrouping="false"
                    :min="0"
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
