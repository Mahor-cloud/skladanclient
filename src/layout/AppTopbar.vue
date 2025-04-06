<script setup>
import { useLayout } from "@/layout/composables/layout"
import router from "@/router"
import { authService } from "@/service/auth/auth.service"
import axiosInstance from "@/service/axios"
import { productService } from "@/service/products/product.service"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue"
import { computed, ref, watchEffect } from "vue"

const { toggleMenu, toggleDarkMode, isDarkTheme } = useLayout()
const cartDialog = ref(false)
const cart = ref({})
const products = ref()
const queryClient = useQueryClient()
const cartAmount = ref(0)
const disabled = ref(false)
const confirmBuyDialog = ref(false)
const toast = useToast()
const logoutDialog = ref(false)

const totalAmount = computed({
    get() {
        return cart.value.reduce((acc, product) => acc + Number(product.buyQuantity), 0)
    }
})

const { data: inCart, isSuccess: isCartSuccess } = useQuery({
    queryKey: ["cartAmount"],
    queryFn: () => Object.values(JSON.parse(localStorage.getItem("cart") || "0")).reduce((acc, quantity) => acc + Number(quantity), 0) || 0,
    staleTime: 60000,
    refetchInterval: 60000
})

const { isError, data, error, isSuccess, isFetching } = productService.getProducts()

const { mutate: createOrderMutate } = useMutation({
    mutationKey: ["create_order"],
    mutationFn: async (data) => await axiosInstance.post("/orders", data),
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["orders"] })
        queryClient.setQueryData(["orders", data.data._id], data)
        toast.add({ severity: "success", summary: "Успешно", detail: ` Заказ ${data.data.orderNumber} создан`, life: 3000 })
        hideCart()
    }
})

watchEffect(() => {
    if (isSuccess.value) {
        products.value = data.value
    }
    if (isCartSuccess.value) {
        cartAmount.value = inCart.value
    }
})

function openCart() {
    let errorQuantity = false
    queryClient.invalidateQueries({ queryKey: ["products"] })
    const cartData = JSON.parse(localStorage.getItem("cart")) || {}
    cart.value = Object.entries(cartData).map(([id, buyQuantity]) => {
        const product = { ...products.value.find((product) => product._id === id) }
        product.buyQuantity = Number(buyQuantity)
        if (product.buyQuantity > product.quantity) {
            errorQuantity = true
        }
        return product
    })
    disabled.value = errorQuantity || !cart.value.length
    cartDialog.value = true
}

function hideCart() {
    queryClient.invalidateQueries({ queryKey: ["products"] })
    cartDialog.value = false
    confirmBuyDialog.value = false
    cart.value = []
}
function changeCartQuantity(_id, quantity) {
    const cartData = JSON.parse(localStorage.getItem("cart")) || {}
    cartData[_id] = quantity
    localStorage.setItem("cart", JSON.stringify(cartData))
    queryClient.invalidateQueries({ queryKey: ["cartAmount"] })
    openCart()
}

function deleteItemFromCart(_id) {
    const cartData = JSON.parse(localStorage.getItem("cart")) || {}
    delete cartData[_id]
    localStorage.setItem("cart", JSON.stringify(cartData))
    queryClient.invalidateQueries({ queryKey: ["cartAmount"] })
    openCart()
}

function createOrder() {
    openCart()
    const payload = cart.value
        .filter((product) => product.buyQuantity > 0) // Фильтрация товаров с количеством больше 0
        .map((product) => {
            return { product: product._id, quantity: product.buyQuantity }
        })
    if (payload.length > 0) {
        console.log(payload)
        createOrderMutate(payload)
        clearCart()
        hideCart()
    } else {
        toast.add({ severity: "error", summary: "Ошибка", detail: "Корзина пуста или содержит некорректные данные", life: 3000 })
    }
}
function clearCart() {
    localStorage.removeItem("cart")
    queryClient.invalidateQueries({ queryKey: ["cartAmount"] })
    cart.value = []
}

function formatCurrency(value) {
    if (value) return value.toLocaleString("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    return
}
function logoutHandler() {
    authService.logout()
    logoutDialog.value = false
    router.go("/auth/login")
}
</script>

<template>
    <div class="layout-topbar p-2">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" @click="toggleMenu">
                <i class="pi pi-bars"></i>
            </button>
            <router-link to="/" class="layout-topbar-logo">
                <img src="/demo/images/litkom.png" style="width: 50px" alt="logo" />

                <span>Склад</span>
            </router-link>
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" @click="toggleDarkMode">
                    <i :class="['pi', { 'pi-moon': isDarkTheme, 'pi-sun': !isDarkTheme }]"></i>
                </button>
                <OverlayBadge :value="cartAmount" size="small" severity="danger">
                    <button :disabled="cartAmount === 0" type="button" class="layout-topbar-action" @click="openCart()">
                        <i class="pi pi-shopping-cart"></i></button
                ></OverlayBadge>
                <Button severity="secondary" variant="text" label="Выход" @click="logoutDialog = true" />
            </div>
        </div>
    </div>
    <Dialog v-model:visible="cartDialog" :style="{ width: '450px' }" header="Корзина" :modal="true" v-on:update:visible="hideCart">
        <DataTable size="small" paginatorPosition="bottom" ref="dt" :value="[...cart]" dataKey="_id" :rows="30" filterDisplay="menu" show-gridlines>
            <Column field="name" header="Название" style="max-width: 1.5rem; padding: 0.3rem">
                <template #body="slotProps">
                    <div class="flex align-items-center gap-2">
                        <p>{{ slotProps.data.name }}</p>
                        <Button severity="danger" icon="pi pi-minus" class="ml-auto min-w-11 my-auto" text rounded size="small" @click="deleteItemFromCart(slotProps.data._id)" />
                    </div>
                </template>
            </Column>
            <Column header="К покупке" field="buyQuantity" :showFilterMatchModes="false" filterMenuStyle="{ width: '14rem' }" style="max-width: 1rem; padding: 0.3rem">
                <template #body="slotProps">
                    <FloatLabel variant="on">
                        <InputText
                            type="number"
                            v-model.number="slotProps.data.buyQuantity"
                            :invalid="slotProps.data.buyQuantity > slotProps.data.quantity"
                            style="font-size: 0.8rem"
                            @value-change="
                                (event) => {
                                    const value = parseInt(event)
                                    if (isNaN(value)) {
                                        slotProps.data.buyQuantity = ''
                                    } else if (value < 1) {
                                        slotProps.data.buyQuantity = 1
                                    } else if (value > slotProps.data.quantity) {
                                        console.log('test')
                                        slotProps.data.buyQuantity = slotProps.data.quantity
                                    } else {
                                        slotProps.data.buyQuantity = value
                                    }
                                    event = slotProps.data.buyQuantity
                                    changeCartQuantity(slotProps.data._id, event)
                                }
                            "
                            fluid
                        />
                        <label>{{ `Доступно  ${slotProps.data.quantity}` }}</label>
                    </FloatLabel>
                </template>
            </Column>
            <Column field="price" header="Цена" style="max-width: 0.5rem; padding: 0.3rem">
                <template #body="slotProps">
                    {{ formatCurrency(slotProps.data.price * slotProps.data.buyQuantity) }}
                </template>
            </Column>
            <template #footer>
                <p class="text-right mr-10">
                    <b>Товаров в корзине: {{ totalAmount }} {{ "\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0" }} Итого: {{ formatCurrency(cart.reduce((acc, item) => acc + item.price * item.buyQuantity, 0)) }}</b>
                </p>
            </template>
        </DataTable>
        <template #footer>
            <Button severity="secondary" label="Закрыть" icon="pi pi-times" @click="hideCart" text />
            <Button severity="danger" label="Очистить" icon="pi pi-filter-slash" text @click="clearCart" />
            <Button :disabled="disabled" label="Купить" icon="pi pi-check" @click="confirmBuyDialog = true" />
        </template>
    </Dialog>
    <Dialog v-model:visible="confirmBuyDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            Вы уверенны что хотите оформить заказ ?
        </div>
        <template #footer>
            <Button label="Нет" icon="pi pi-times" text @click="confirmBuyDialog = false" />
            <Button label="Да" icon="pi pi-check" @click="createOrder" />
        </template>
    </Dialog>
    <Dialog v-model:visible="logoutDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            Вы уверенны что хотите выйти из аккаунта ?
        </div>
        <template #footer>
            <Button label="Нет" icon="pi pi-times" text @click="logoutDialog = false" />
            <Button label="Да" icon="pi pi-check" @click="logoutHandler" />
        </template>
    </Dialog>
</template>
