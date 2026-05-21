<script setup>
import router from "@/router"
import { saveToStorage } from "@/service/auth/auth.helper"
import axiosInstance from "@/service/axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, ref, watch } from "vue"

const toast = useToast()
const queryClient = useQueryClient()

const createDialog = ref(false)
const passwordDialog = ref(false)
const passwordTarget = ref(null)
const newPassword = ref("")
const newCompany = ref({ name: "", slug: "", adminLogin: "", adminPassword: "", adminName: "Председатель", seedRoles: true, seedProducts: true })
const submitted = ref(false)

const expandedRows = ref({})
const adminsByCompany = ref({})

const { data: companies, isSuccess, isFetching } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await axiosInstance.get("/companies")).data,
    staleTime: 30_000
})

const companiesSkeleton = Array.from({ length: 4 }, (_, i) => ({ _id: `sk-${i}`, _skeleton: true }))
const tableRows = computed(() => (isSuccess.value && companies.value ? companies.value : companiesSkeleton))

async function loadAdmins(companyId) {
    const { data } = await axiosInstance.get(`/companies/${companyId}/users`)
    adminsByCompany.value = { ...adminsByCompany.value, [companyId]: data }
    return data
}

const { mutate: createCompanyMutation, isPending: isCreating } = useMutation({
    mutationFn: async (payload) => (await axiosInstance.post("/companies/with-admin", payload)).data,
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["companies"] })
        toast.add({
            severity: "success",
            summary: "Компания создана",
            detail: `${data.company.name} (логин админа: ${data.admin.login})`,
            life: 5000
        })
        createDialog.value = false
        submitted.value = false
        newCompany.value = { name: "", slug: "", adminLogin: "", adminPassword: "", adminName: "" }
    },
    onError: (err) => {
        toast.add({
            severity: "error",
            summary: "Ошибка",
            detail: err?.response?.data?.message || err.message,
            life: 6000
        })
    }
})

const { mutate: deactivate } = useMutation({
    mutationFn: async (id) => await axiosInstance.delete(`/companies/${id}`),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["companies"] })
        toast.add({ severity: "success", summary: "Компания деактивирована", life: 2000 })
    }
})

const { mutate: activate } = useMutation({
    mutationFn: async (id) => await axiosInstance.put(`/companies/${id}/activate`),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["companies"] })
        toast.add({ severity: "success", summary: "Компания активирована", life: 2000 })
    }
})

const hardDeleteDialog = ref(false)
const hardDeleteTarget = ref(null)
const hardDeleteConfirmText = ref("")
function openHardDelete(company) {
    hardDeleteTarget.value = company
    hardDeleteConfirmText.value = ""
    hardDeleteDialog.value = true
}
const { mutate: hardDelete, isPending: isHardDeleting } = useMutation({
    mutationFn: async (id) =>
        (await axiosInstance.delete(`/companies/${id}/hard`, { data: { confirm: "i-know-what-i-am-doing" } })).data,
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["companies"] })
        hardDeleteDialog.value = false
        hardDeleteTarget.value = null
        toast.add({
            severity: "success",
            summary: "Компания удалена",
            detail: `${data.deletedCompany}: удалены все её данные.`,
            life: 4000
        })
    },
    onError: (err) => {
        toast.add({ severity: "error", summary: "Ошибка", detail: err?.response?.data?.message || err.message, life: 5000 })
    }
})
function confirmHardDelete() {
    if (hardDeleteConfirmText.value.trim() !== hardDeleteTarget.value?.name) {
        toast.add({ severity: "warn", summary: "Не совпадает", detail: "Введите точное название компании", life: 3000 })
        return
    }
    hardDelete(hardDeleteTarget.value._id)
}

const { mutate: changePassword, isPending: isChangingPassword } = useMutation({
    mutationFn: async ({ userId, password }) => (await axiosInstance.put(`/companies/admin/${userId}/password`, { password })).data,
    onSuccess: () => {
        toast.add({ severity: "success", summary: "Пароль изменён", life: 2500 })
        passwordDialog.value = false
        newPassword.value = ""
        passwordTarget.value = null
    },
    onError: (err) => {
        toast.add({
            severity: "error",
            summary: "Ошибка",
            detail: err?.response?.data?.message || err.message,
            life: 5000
        })
    }
})

const isExporting = ref(false)
const isImporting = ref(false)

async function exportFullDatabase() {
    try {
        isExporting.value = true
        const { data } = await axiosInstance.get("/database/export")
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `skladan-full-db-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.add({ severity: "success", summary: "Экспорт всей БД готов", life: 3000 })
    } catch (e) {
        toast.add({ severity: "error", summary: "Ошибка экспорта", detail: e?.response?.data?.message || e.message, life: 5000 })
    } finally {
        isExporting.value = false
    }
}

async function importFullDatabase(event) {
    const file = event.files?.[0]
    if (!file) return
    try {
        isImporting.value = true
        const fd = new FormData()
        fd.append("file", file)
        await axiosInstance.post("/database/import", fd, { headers: { "Content-Type": "multipart/form-data" } })
        toast.add({ severity: "success", summary: "Импорт завершён", life: 4000 })
        queryClient.invalidateQueries({ queryKey: ["companies"] })
    } catch (e) {
        toast.add({ severity: "error", summary: "Ошибка импорта", detail: e?.response?.data?.message || e.message, life: 6000 })
    } finally {
        isImporting.value = false
    }
}

const { mutate: impersonate } = useMutation({
    mutationFn: async (userId) => (await axiosInstance.post(`/companies/impersonate/${userId}`)).data,
    onSuccess: (data) => {
        queryClient.clear()
        localStorage.removeItem("cart")
        saveToStorage(data)
        toast.add({
            severity: "info",
            summary: `Вход под ${data.user.name}`,
            life: 2500
        })

        setTimeout(() => {
            window.location.href = window.location.origin + "/#/"
            window.location.reload()
        }, 400)
    },
    onError: (err) => {
        toast.add({
            severity: "error",
            summary: "Ошибка входа",
            detail: err?.response?.data?.message || err.message,
            life: 5000
        })
    }
})

const validation = computed(() => {
    const v = {
        adminLogin: !!newCompany.value.adminLogin && newCompany.value.adminLogin.length >= 3,
        adminPassword: !!newCompany.value.adminPassword && newCompany.value.adminPassword.length >= 4
    }
    v.ok = v.adminLogin && v.adminPassword
    return v
})

function onCreate() {
    submitted.value = true
    if (!validation.value.ok) return
    createCompanyMutation({
        name: newCompany.value.name?.trim() || undefined,
        slug: newCompany.value.slug?.trim() || undefined,
        adminLogin: newCompany.value.adminLogin.trim(),
        adminPassword: newCompany.value.adminPassword,
        adminName: newCompany.value.adminName?.trim() || undefined,
        seedRoles: !!newCompany.value.seedRoles,
        seedProducts: !!newCompany.value.seedProducts
    })
}

function openCreateDialog() {
    submitted.value = false
    newCompany.value = { name: "", slug: "", adminLogin: "", adminPassword: "", adminName: "Председатель", seedRoles: true, seedProducts: true }
    createDialog.value = true
}

function openPasswordDialog(admin) {
    passwordTarget.value = admin
    newPassword.value = ""
    passwordDialog.value = true
}

function confirmChangePassword() {
    if (!passwordTarget.value || !newPassword.value || newPassword.value.length < 4) {
        toast.add({ severity: "warn", summary: "Минимум 4 символа", life: 2500 })
        return
    }
    changePassword({ userId: passwordTarget.value._id, password: newPassword.value })
}

async function onRowExpand(row) {
    if (adminsByCompany.value[row._id]) return
    await loadAdmins(row._id)
}

function admins(companyId) {
    return adminsByCompany.value[companyId] || []
}

function fmtDate(ts) {
    return ts ? new Date(ts).toLocaleString("ru-RU") : ""
}
</script>

<template>
    <div class="companies-page">
        <header class="companies-header">
            <h1 class="companies-title">Компании</h1>
            <div class="header-actions">
                <Button label="Экспорт всей БД" icon="pi pi-download" severity="secondary" outlined @click="exportFullDatabase" :loading="isExporting" />
                <FileUpload mode="basic" choose-label="Импорт всей БД" choose-icon="pi pi-upload" custom-upload auto @select="importFullDatabase" accept="application/json,.json" :disabled="isImporting" severity="secondary" />
                <Button label="Создать компанию" icon="pi pi-plus" @click="openCreateDialog" />
            </div>
        </header>

        <DataTable
            :value="tableRows"
            size="small"
            striped-rows
            dataKey="_id"
            :loading="isFetching && !isSuccess"
            v-model:expandedRows="expandedRows"
            @row-expand="(e) => onRowExpand(e.data)">
            <Column expander style="width: 3rem" />
            <Column field="name" header="Название">
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="60%" height="1rem" />
                    <span v-else>{{ row.name }}</span>
                </template>
            </Column>
            <Column field="slug" header="Slug">
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="40%" height="1rem" />
                    <span v-else>{{ row.slug }}</span>
                </template>
            </Column>
            <Column field="isActive" header="Активна">
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="2rem" height="1rem" />
                    <span v-else :class="row.isActive ? 'badge-ok' : 'badge-off'">{{ row.isActive ? "Да" : "Нет" }}</span>
                </template>
            </Column>
            <Column field="createdAt" header="Создана">
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="6rem" height="1rem" />
                    <span v-else>{{ fmtDate(row.createdAt) }}</span>
                </template>
            </Column>
            <Column header="Действия">
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" shape="circle" size="2rem" />
                    <div v-else class="row-actions">
                        <Button v-if="row.isActive" icon="pi pi-ban" size="small" severity="warn" outlined rounded @click="deactivate(row._id)" v-tooltip.top="'Деактивировать (мягко)'" />
                        <Button v-else icon="pi pi-check-circle" size="small" severity="success" outlined rounded @click="activate(row._id)" v-tooltip.top="'Активировать обратно'" />
                        <Button icon="pi pi-trash" size="small" severity="danger" outlined rounded @click="openHardDelete(row)" v-tooltip.top="'Удалить полностью (со всеми данными)'" />
                    </div>
                </template>
            </Column>
            <template #expansion="{ data: row }">
                <div class="admins-block">
                    <h3 class="admins-title">Пользователи компании</h3>
                    <div v-if="!adminsByCompany[row._id]" class="muted"><i class="pi pi-spin pi-spinner"></i> Загрузка...</div>
                    <div v-else-if="adminsByCompany[row._id].length === 0" class="muted">Нет пользователей.</div>
                    <DataTable v-else :value="adminsByCompany[row._id]" size="small">
                        <Column field="name" header="Имя" />
                        <Column field="login" header="Логин" />
                        <Column header="Роль">
                            <template #body="{ data: a }">
                                {{ a.role?.name || "—" }}
                                <span v-if="a.isAdmin" class="admin-tag">admin</span>
                            </template>
                        </Column>
                        <Column header="Действия">
                            <template #body="{ data: a }">
                                <div class="row-actions">
                                    <Button icon="pi pi-sign-in" size="small" severity="success" outlined rounded @click="impersonate(a._id)" v-tooltip.top="'Войти под этим пользователем'" />
                                    <Button icon="pi pi-key" size="small" severity="warn" outlined rounded @click="openPasswordDialog(a)" v-tooltip.top="'Сменить пароль'" />
                                </div>
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </template>
        </DataTable>

        <Dialog v-model:visible="createDialog" header="Новая компания + первый админ" :style="{ width: '95%', maxWidth: '520px' }" :breakpoints="{ '768px': '100vw' }" modal>
            <div class="form-stack">
                <div class="form-row">
                    <label>Название компании <span class="muted">(пусто = случайно)</span></label>
                    <InputText v-model="newCompany.name" placeholder="Название компании" fluid />
                </div>
                <div class="form-row">
                    <label>Slug <span class="muted">(пусто = из названия)</span></label>
                    <InputText v-model="newCompany.slug" placeholder="название-латиницей" fluid />
                </div>
                <Divider align="left" type="dashed"><b>Главный админ</b></Divider>
                <div class="form-row">
                    <label>Логин админа <span class="req">*</span></label>
                    <InputText v-model="newCompany.adminLogin" placeholder="логин админа" :invalid="submitted && !validation.adminLogin" fluid />
                    <small v-if="submitted && !validation.adminLogin" class="text-danger">Логин минимум 3 символа</small>
                </div>
                <div class="form-row">
                    <label>Пароль <span class="req">*</span></label>
                    <Password v-model="newCompany.adminPassword" toggleMask :feedback="false" :invalid="submitted && !validation.adminPassword" fluid />
                    <small v-if="submitted && !validation.adminPassword" class="text-danger">Пароль минимум 4 символа</small>
                </div>
                <div class="form-row">
                    <label>Имя <span class="muted">(по умолчанию «Председатель»)</span></label>
                    <InputText v-model="newCompany.adminName" placeholder="Председатель" fluid />
                </div>
                <Divider align="left" type="dashed"><b>Засеять данные?</b></Divider>
                <div class="form-row">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <Checkbox v-model="newCompany.seedRoles" binary />
                        <span>Создать роли</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <Checkbox v-model="newCompany.seedProducts" binary />
                        <span>Заполнить склад наименованиями</span>
                    </label>
                    <small class="muted">Шаблоны редактируются на странице «Семена». Если галочка снята — соответствующие данные не создаются.</small>
                </div>
            </div>
            <template #footer>
                <Button label="Отмена" icon="pi pi-times" text @click="createDialog = false" :disabled="isCreating" />
                <Button label="Создать" icon="pi pi-check" :loading="isCreating" @click="onCreate" />
            </template>
        </Dialog>

        <Dialog v-model:visible="hardDeleteDialog" :style="{ width: '95%', maxWidth: '480px' }" header="Удалить компанию полностью" modal>
            <div v-if="hardDeleteTarget" class="form-stack">
                <Message severity="warn" :closable="false">
                    Это <b>безвозвратно</b> удалит <b>{{ hardDeleteTarget.name }}</b> и все её данные: пользователей, товары, заказы, закупки, инвентаризации, роли, сообщения, подписки, историю.
                </Message>
                <div class="form-row">
                    <label>Для подтверждения введите название компании: <b>{{ hardDeleteTarget.name }}</b></label>
                    <InputText v-model="hardDeleteConfirmText" :placeholder="hardDeleteTarget.name" fluid />
                </div>
            </div>
            <template #footer>
                <Button label="Отмена" icon="pi pi-times" text @click="hardDeleteDialog = false" :disabled="isHardDeleting" />
                <Button label="Удалить" icon="pi pi-trash" severity="danger" :loading="isHardDeleting" :disabled="isHardDeleting" @click="confirmHardDelete" />
            </template>
        </Dialog>

        <Dialog v-model:visible="passwordDialog" header="Сменить пароль админа" :style="{ width: '95%', maxWidth: '420px' }" modal>
            <div v-if="passwordTarget" class="form-stack">
                <p class="muted">Админ: <b>{{ passwordTarget.name }}</b> (логин <code>{{ passwordTarget.login }}</code>)</p>
                <div class="form-row">
                    <label>Новый пароль</label>
                    <Password v-model="newPassword" toggleMask :feedback="false" fluid />
                </div>
            </div>
            <template #footer>
                <Button label="Отмена" icon="pi pi-times" text @click="passwordDialog = false" :disabled="isChangingPassword" />
                <Button label="Сменить" icon="pi pi-check" :loading="isChangingPassword" @click="confirmChangePassword" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.companies-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px;
}
.companies-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
}
.header-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
}
.companies-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
}
.form-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.form-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.form-row label {
    font-size: 14px;
    opacity: 0.85;
}
.row-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.admins-block {
    padding: 8px 12px 16px;
    background: var(--p-content-background, rgba(0, 0, 0, 0.02));
    border-radius: 8px;
}
.admins-title {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
}
.muted {
    opacity: 0.65;
}
.req {
    color: #ef4444;
    font-weight: 700;
}
.text-danger {
    color: #ef4444;
    font-size: 12px;
}
.admin-tag {
    margin-left: 6px;
    padding: 2px 8px;
    background: rgba(10, 90, 185, 0.12);
    color: rgb(10, 90, 185);
    border-radius: 4px;
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.04em;
}
</style>
