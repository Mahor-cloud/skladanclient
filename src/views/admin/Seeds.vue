<script setup>
import axiosInstance from "@/service/axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, ref, watch } from "vue"

const toast = useToast()
const queryClient = useQueryClient()

const { data: seedsData, isSuccess } = useQuery({
    queryKey: ["seeds"],
    queryFn: async () => (await axiosInstance.get("/seeds")).data,
    staleTime: 30_000
})

const localRoles = ref([])
const localProducts = ref([])

const ALL_PERMISSIONS = [
    "view_users", "create_users", "edit_users", "delete_users",
    "create_change_history", "view_change_history",
    "create_inventory", "view_inventory", "delete_inventory", "edit_inventory",
    "create_orders", "view_orders", "edit_orders", "delete_orders",
    "create_purchases", "view_purchases", "edit_purchases", "delete_purchases",
    "create_product", "view_products", "edit_products", "delete_products",
    "create_role", "view_roles", "edit_roles", "delete_roles",
    "export-database", "import-database",
    "approve-payment",
    "cabinet_access", "view_statistics", "export_statistics",
    "view-messages", "edit-payment-message", "edit-received-message",
    "view_all_cabinets", "view_cabinet_summary", "approve_target_exceed"
]

const PERMISSION_LABELS = {
    view_users: "Просмотр пользователей",
    create_users: "Создание пользователей",
    edit_users: "Редактирование пользователей",
    delete_users: "Удаление пользователей",
    view_roles: "Просмотр ролей",
    create_role: "Создание роли",
    edit_roles: "Редактирование ролей",
    delete_roles: "Удаление ролей",
    create_change_history: "Создание записей в истории",
    view_change_history: "Просмотр истории изменений",
    view_inventory: "Просмотр инвентаризаций",
    create_inventory: "Создание инвентаризации",
    edit_inventory: "Редактирование инвентаризации",
    delete_inventory: "Удаление инвентаризации",
    view_orders: "Просмотр заказов",
    create_orders: "Создание заказов",
    edit_orders: "Редактирование заказов",
    delete_orders: "Удаление заказов",
    "approve-payment": "Подтверждение оплаты",
    approve_target_exceed: "Подтверждение превышения цели закупки",
    view_purchases: "Просмотр закупок",
    create_purchases: "Создание закупок",
    edit_purchases: "Редактирование закупок",
    delete_purchases: "Удаление закупок",
    view_products: "Просмотр товаров",
    create_product: "Создание товара",
    edit_products: "Редактирование товаров",
    delete_products: "Удаление товаров",
    cabinet_access: "Доступ к личному складу",
    view_all_cabinets: "Просмотр чужих личных складов",
    view_cabinet_summary: "Сводка по личным складам",
    view_statistics: "Просмотр статистики",
    export_statistics: "Экспорт статистики (CSV)",
    "view-messages": "Просмотр сообщений (платёж/получение)",
    "edit-payment-message": "Редактирование сообщения об оплате",
    "edit-received-message": "Редактирование сообщения о получении",
    "export-database": "Экспорт базы данных",
    "import-database": "Импорт базы данных"
}
const labelFor = (perm) => PERMISSION_LABELS[perm] || perm

watch(
    seedsData,
    (val) => {
        if (!val) return
        localRoles.value = (val.roles || []).map((r) => ({
            name: r.name,
            permissions: [...(r.permissions || [])]
        }))
        localProducts.value = (val.products || []).map((p) => ({
            name: p.name,
            category: p.category || "",
            price: Number(p.price) || 0
        }))
    },
    { immediate: true }
)

const { mutate: saveRoles, isPending: isSavingRoles } = useMutation({
    mutationFn: async () => (await axiosInstance.put("/seeds/roles", { roles: localRoles.value })).data,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["seeds"] })
        toast.add({ severity: "success", summary: "Роли в шаблоне сохранены", life: 3000 })
    },
    onError: (e) => {
        toast.add({ severity: "error", summary: "Ошибка", detail: e?.response?.data?.message || e.message, life: 5000 })
    }
})

const { mutate: saveProducts, isPending: isSavingProducts } = useMutation({
    mutationFn: async () => (await axiosInstance.put("/seeds/products", { products: localProducts.value })).data,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["seeds"] })
        toast.add({ severity: "success", summary: "Товары в шаблоне сохранены", life: 3000 })
    },
    onError: (e) => {
        toast.add({ severity: "error", summary: "Ошибка", detail: e?.response?.data?.message || e.message, life: 5000 })
    }
})

const expandedRole = ref(null)
function toggleRoleExpand(name) {
    expandedRole.value = expandedRole.value === name ? null : name
}
function addRole() {
    localRoles.value.push({ name: "", permissions: [] })
    expandedRole.value = ""
}
function removeRole(idx) {
    localRoles.value.splice(idx, 1)
}
function togglePerm(role, perm) {
    const i = role.permissions.indexOf(perm)
    if (i >= 0) role.permissions.splice(i, 1)
    else role.permissions.push(perm)
}

function addProduct() {
    localProducts.value.unshift({ name: "", category: "", price: 0 })
}
function removeProduct(idx) {
    localProducts.value.splice(idx, 1)
}

const productSearch = ref("")
const filteredProducts = computed(() => {
    const q = productSearch.value.trim().toLowerCase()
    if (!q) return localProducts.value
    return localProducts.value.filter((p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
    )
})
</script>

<template>
    <div class="seeds-page">
        <header class="seeds-header">
            <div>
                <h1 class="seeds-title">Семена (Seeds)</h1>
                <p class="seeds-subtitle">Шаблон ролей и товаров, который применяется к новым компаниям при создании, если поставлены соответствующие галочки. Шаблон редактируется тут.</p>
            </div>
        </header>

        <div v-if="!isSuccess" class="muted">Загрузка...</div>

        <section v-else class="seeds-section card">
            <div class="section-header">
                <h2>Роли ({{ localRoles.length }})</h2>
                <div class="flex gap-2">
                    <Button label="Добавить роль" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addRole" />
                    <Button label="Сохранить роли" icon="pi pi-check" :loading="isSavingRoles" :disabled="isSavingRoles" severity="success" @click="saveRoles()" />
                </div>
            </div>

            <div class="roles-list">
                <div v-for="(role, idx) in localRoles" :key="idx" class="role-card">
                    <div class="role-head">
                        <InputText v-model="role.name" placeholder="Название роли" class="role-name" />
                        <span class="muted">{{ role.permissions.length }} прав</span>
                        <Button :icon="expandedRole === role.name ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" size="small" text @click="toggleRoleExpand(role.name)" />
                        <Button icon="pi pi-trash" size="small" severity="danger" text @click="removeRole(idx)" />
                    </div>
                    <div v-if="expandedRole === role.name" class="role-perms">
                        <label v-for="perm in ALL_PERMISSIONS" :key="perm" class="perm-row">
                            <Checkbox :modelValue="role.permissions.includes(perm)" binary @update:modelValue="togglePerm(role, perm)" />
                            <span :title="perm">{{ labelFor(perm) }}</span>
                        </label>
                    </div>
                </div>
            </div>
        </section>

        <section v-if="isSuccess" class="seeds-section card">
            <div class="section-header">
                <h2>Товары в шаблоне ({{ localProducts.length }})</h2>
                <div class="flex gap-2 items-center">
                    <IconField>
                        <InputIcon><i class="pi pi-search" /></InputIcon>
                        <InputText v-model="productSearch" placeholder="Поиск..." style="min-width: 14rem" />
                    </IconField>
                    <Button label="Добавить" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addProduct" />
                    <Button label="Сохранить товары" icon="pi pi-check" :loading="isSavingProducts" :disabled="isSavingProducts" severity="success" @click="saveProducts()" />
                </div>
            </div>

            <DataTable :value="filteredProducts" size="small" striped-rows paginator :rows="50" :rowsPerPageOptions="[25, 50, 100, 200]">
                <Column header="Название">
                    <template #body="{ data }">
                        <InputText v-model="data.name" placeholder="Название" style="width: 100%" />
                    </template>
                </Column>
                <Column header="Категория">
                    <template #body="{ data }">
                        <InputText v-model="data.category" placeholder="Категория" style="width: 100%" />
                    </template>
                </Column>
                <Column header="Цена">
                    <template #body="{ data }">
                        <InputNumber v-model="data.price" :min="0" :max="9999999" suffix=" ₽" :useGrouping="true" />
                    </template>
                </Column>
                <Column header="" style="width: 56px">
                    <template #body="{ index }">
                        <Button icon="pi pi-trash" size="small" severity="danger" text @click="removeProduct(index)" />
                    </template>
                </Column>
            </DataTable>
        </section>
    </div>
</template>

<style scoped>
.seeds-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px;
}
.seeds-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
}
.seeds-title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
}
.seeds-subtitle {
    margin: 4px 0 0;
    opacity: 0.75;
    font-size: 14px;
}
.seeds-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}
.section-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}
.roles-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.role-card {
    border: 1px solid var(--p-content-border-color, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    padding: 8px 12px;
}
.role-head {
    display: flex;
    align-items: center;
    gap: 12px;
}
.role-name {
    flex: 1;
    min-width: 8rem;
    max-width: 24rem;
    font-size: 16px;
}
.role-perms {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 6px 16px;
    padding: 12px 4px 4px;
}
.perm-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
}
.muted {
    opacity: 0.7;
    font-size: 13px;
}
</style>
