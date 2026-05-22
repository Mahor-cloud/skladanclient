<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useLayout } from "@/layout/composables/layout"
import router from "@/router"
import { authService } from "@/service/auth/auth.service"
import { saveTokensStorage } from "@/service/auth/auth.helper"
import axiosInstance from "@/service/axios"
import { productService } from "@/service/products/product.service"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue"
import { computed, defineAsyncComponent, ref, watchEffect } from "vue"

const OrderDialog = defineAsyncComponent(() => import("@/views/shop/OrderDialog.vue"))

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

const goToOrderDialog = ref(false)
const createdOrderId = ref(null)
const orderDetailDialog = ref(false)

const pwdDialog = ref(false)
const pwdCurrent = ref("")
const pwdNew = ref("")
const pwdNew2 = ref("")
function openPwdDialog() {
    pwdCurrent.value = ""
    pwdNew.value = ""
    pwdNew2.value = ""
    pwdDialog.value = true
}
const { mutate: changeOwnPassword, isPending: isPwdChanging } = useMutation({
    mutationFn: async () =>
        (await axiosInstance.put("/auth/me/password", { currentPassword: pwdCurrent.value, newPassword: pwdNew.value })).data,
    onSuccess: (data) => {

        if (data?.accessToken && data?.refreshToken) {
            saveTokensStorage({ accessToken: data.accessToken, refreshToken: data.refreshToken })
        }
        toast.add({ severity: "success", summary: "Пароль изменён", life: 3000 })
        pwdDialog.value = false
        pwdCurrent.value = ""
        pwdNew.value = ""
        pwdNew2.value = ""
    },
    onError: (err) => {
        const detail = err?.response?.data?.message || err.message || "Не удалось сменить пароль"
        toast.add({ severity: "error", summary: "Ошибка", detail, life: 5000 })
    }
})
function submitPasswordChange() {
    if (!pwdCurrent.value || !pwdNew.value) {
        toast.add({ severity: "warn", summary: "Заполните все поля", life: 3000 })
        return
    }
    if (pwdNew.value !== pwdNew2.value) {
        toast.add({ severity: "warn", summary: "Пароли не совпадают", life: 3000 })
        return
    }
    if (pwdNew.value.length < 4) {
        toast.add({ severity: "warn", summary: "Минимум 4 символа", life: 3000 })
        return
    }
    changeOwnPassword()
}

function readUserSafely() {
    try {
        return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
        return null
    }
}
const currentUser = ref(readUserSafely())
const isSuperAdmin = computed(() => !!currentUser.value?.isSuperAdmin)

const totalAmount = computed({
    get() {
        if (!Array.isArray(cart.value)) return 0
        return cart.value.reduce((acc, product) => acc + Number(product.buyQuantity || 0), 0)
    }
})

const { data: inCart, isSuccess: isCartSuccess } = useQuery({
    queryKey: ["cartAmount"],
    queryFn: () => {

        try {
            const raw = localStorage.getItem("cart")
            if (!raw) return 0
            const parsed = JSON.parse(raw)
            if (!parsed || typeof parsed !== "object") return 0
            return Object.values(parsed).reduce((acc, quantity) => acc + Number(quantity || 0), 0) || 0
        } catch {
            return 0
        }
    },
    staleTime: 60000,
    refetchInterval: 60000,
    enabled: !isSuperAdmin.value
})

const { isError, data, error, isSuccess, isFetching } = productService.getProducts({ enabled: !isSuperAdmin.value })

const { mutate: createOrderMutate, isPending: isOrderCreating } = useMutation({
    mutationKey: ["create_order"],
    mutationFn: async (data) => await axiosInstance.post("/orders", data),
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["orders"] })
        queryClient.invalidateQueries({ queryKey: ["order", data.data._id] })
        queryClient.invalidateQueries({ queryKey: ["products"] })
        toast.add({ severity: "success", summary: "Успешно", detail: ` Заказ ${data.data.orderNumber} создан`, life: 3000 })
        clearCart()
        hideCart()

        createdOrderId.value = data.data._id
        goToOrderDialog.value = true
    },
    onError: (err) => {
        const payload = err?.response?.data
        if (payload?.code === "ACTIVE_INVENTORY") {

            confirmBuyDialog.value = false
            cartDialog.value = false
            goToOrderDialog.value = false
            toast.add({
                severity: "error",
                summary: "Заказ невозможен",
                detail: payload.message || "Идёт инвентаризация — создание заказов невозможно. Свяжитесь с администратором.",
                life: 8000
            })
        } else {
            toast.add({ severity: "error", summary: "Ошибка", detail: payload?.message || err.message, life: 5000 })
        }
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

async function revalidateCartAgainstStock() {
    try {
        const fresh = (await axiosInstance.get("/products")).data || []
        const byId = new Map(fresh.map((p) => [String(p._id), p]))
        const cartData = JSON.parse(localStorage.getItem("cart") || "{}")
        const corrections = []
        for (const [id, qty] of Object.entries(cartData)) {
            const p = byId.get(String(id))
            const avail = p ? Number(p.quantity) || 0 : 0
            const want = Number(qty) || 0
            if (!p || avail <= 0) {
                delete cartData[id]
                corrections.push(`${p?.name || "Товар"} — нет на складе, убран из корзины`)
            } else if (want > avail) {
                cartData[id] = avail
                corrections.push(`${p.name}: ${want} → ${avail} (доступно)`)
            }
        }
        if (corrections.length) {
            localStorage.setItem("cart", JSON.stringify(cartData))
            queryClient.invalidateQueries({ queryKey: ["cartAmount"] })
            queryClient.invalidateQueries({ queryKey: ["products"] })
            confirmBuyDialog.value = false
            openCart()
            toast.add({
                severity: "warn",
                summary: "Корзина скорректирована по остаткам",
                detail: corrections.slice(0, 6).join("; "),
                life: 9000,
            })
            return true
        }
    } catch {
    }
    return false
}

async function createOrder() {
    if (await revalidateCartAgainstStock()) return

    openCart()
    const payload = cart.value
        .filter((product) => product.buyQuantity > 0)
        .map((product) => ({ product: product._id, quantity: product.buyQuantity }))
    if (payload.length > 0) {

        createOrderMutate(payload)
    } else {
        toast.add({
            severity: "error",
            summary: "Ошибка",
            detail: "Корзина пуста или содержит некорректные данные",
            life: 3000,
        })
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
    router.push("/auth/login")
}
</script>

<template>
    <div class="layout-topbar p-2">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" aria-label="Меню" @click="toggleMenu">
                <i class="pi pi-bars"></i>
            </button>
            <router-link to="/" class="layout-topbar-logo">
                <picture>
                    <source srcset="/demo/images/litkom.webp" type="image/webp" />
                    <img src="/demo/images/litkom.png" width="200" height="200" style="width: 50px; height: auto" alt="logo" />
                </picture>

                <span>Склад</span>
            </router-link>
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" aria-label="Переключить тему" @click="toggleDarkMode">
                    <i :class="['pi', { 'pi-moon': isDarkTheme, 'pi-sun': !isDarkTheme }]"></i>
                </button>
                <OverlayBadge v-if="!isSuperAdmin" :value="cartAmount" size="small" severity="danger">
                    <button :disabled="cartAmount === 0" type="button" class="layout-topbar-action" aria-label="Корзина" @click="openCart()">
                        <i class="pi pi-shopping-cart"></i></button
                ></OverlayBadge>
                <Button v-if="isSuperAdmin" severity="secondary" variant="text" icon="pi pi-key" aria-label="Сменить пароль" class="pwd-btn" @click="openPwdDialog" v-tooltip.bottom="'Сменить пароль'" />
                <Button severity="danger" variant="text" icon="pi pi-sign-out" aria-label="Выход" class="logout-btn" v-tooltip.bottom="'Выход'" @click="logoutDialog = true" />
            </div>
        </div>
    </div>
    <Dialog v-model:visible="cartDialog" :style="{ width: '450px' }" :breakpoints="{ '768px': '100vw' }" header="Корзина" :modal="true" v-on:update:visible="hideCart">
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
                            inputmode="numeric"
                            v-model="slotProps.data.buyQuantity"
                            :invalid="Number(String(slotProps.data.buyQuantity).replace(/\D+/g, '')) > slotProps.data.quantity"
                            style="font-size: 16px"
                            @blur="
                                () => {
                                    let v = parseInt(String(slotProps.data.buyQuantity ?? '').replace(/\D+/g, ''), 10)
                                    if (!Number.isFinite(v) || v < 1) v = 1
                                    if (v > slotProps.data.quantity) v = slotProps.data.quantity
                                    slotProps.data.buyQuantity = v
                                    changeCartQuantity(slotProps.data._id, v)
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
    <Dialog v-model:visible="confirmBuyDialog" :style="{ width: '450px' }" :breakpoints="{ '768px': '100vw' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            Вы уверенны что хотите оформить заказ ?
        </div>
        <template #footer>
            <Button label="Нет" icon="pi pi-times" text @click="confirmBuyDialog = false" :disabled="isOrderCreating" />
            <Button label="Да" icon="pi pi-check" @click="createOrder" :loading="isOrderCreating" :disabled="isOrderCreating" />
        </template>
    </Dialog>
    <Dialog v-model:visible="goToOrderDialog" :style="{ width: '450px' }" :breakpoints="{ '768px': '100vw' }" header="Заказ создан" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-check-circle !text-3xl" style="color: #22c55e" />
            Заказ создан. Перейти к заказу, чтобы оплатить?
        </div>
        <template #footer>
            <Button label="Нет" icon="pi pi-times" text @click="goToOrderDialog = false" />
            <Button
                label="Да"
                icon="pi pi-check"
                @click="
                    () => {
                        goToOrderDialog = false
                        orderDetailDialog = true
                    }
                "
            />
        </template>
    </Dialog>

    <OrderDialog
        v-if="orderDetailDialog && createdOrderId"
        :order="createdOrderId"
        :visible="orderDetailDialog"
        @hideOrderDialog="orderDetailDialog = false"
    />

    <Dialog v-model:visible="logoutDialog" :style="{ width: '450px' }" :breakpoints="{ '768px': '100vw' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            Вы уверенны что хотите выйти из аккаунта ?
        </div>
        <template #footer>
            <Button label="Нет" icon="pi pi-times" text @click="logoutDialog = false" />
            <Button label="Да" icon="pi pi-check" @click="logoutHandler" />
        </template>
    </Dialog>

    <Dialog v-model:visible="pwdDialog" :style="{ width: '95%', maxWidth: '440px' }" :breakpoints="{ '768px': '100vw' }" header="Сменить пароль" :modal="true">
        <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-1">
                <label>Текущий пароль</label>
                <Password v-model="pwdCurrent" :feedback="false" toggleMask fluid />
            </div>
            <div class="flex flex-col gap-1">
                <label>Новый пароль</label>
                <Password v-model="pwdNew" :feedback="false" toggleMask fluid />
            </div>
            <div class="flex flex-col gap-1">
                <label>Повторите новый пароль</label>
                <Password v-model="pwdNew2" :feedback="false" toggleMask fluid />
            </div>
            <small class="text-muted-color">После смены пароля вы останетесь в системе — повторный вход не требуется.</small>
        </div>
        <template #footer>
            <Button label="Отмена" icon="pi pi-times" text @click="pwdDialog = false" :disabled="isPwdChanging" />
            <Button label="Сменить" icon="pi pi-check" severity="success" :loading="isPwdChanging" :disabled="isPwdChanging" @click="submitPasswordChange" />
        </template>
    </Dialog>
</template>

<style scoped>

.layout-config-menu {
    display: flex;
    align-items: center;
    gap: 8px;
}
.layout-config-menu > .layout-topbar-action,
.layout-config-menu :deep(.p-button) {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
}
.layout-config-menu > .layout-topbar-action i,
.layout-config-menu :deep(.p-button-icon) {
    font-size: 20px;
}

.layout-config-menu :deep(.p-overlaybadge) {
    flex: 0 0 auto;
    display: inline-flex;
}
.layout-config-menu :deep(.p-overlaybadge) > .layout-topbar-action {
    width: 44px;
    height: 44px;
    padding: 0;
}

.logout-btn :deep(.p-button-icon) {
    color: #ef4444;
}

.layout-topbar {
    overflow: visible !important;
}
.layout-topbar-actions {
    overflow: visible !important;
    padding-right: 6px;
}
.layout-config-menu {
    overflow: visible !important;
}
.layout-config-menu :deep(.p-overlaybadge) {
    overflow: visible;
    margin-right: 6px;
}
.layout-config-menu :deep(.p-overlaybadge .p-badge) {

    transform: translate(30%, -30%);
    z-index: 2;
}
</style>
