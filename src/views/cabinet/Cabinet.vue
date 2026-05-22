<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useCurrentUser } from "@/composables/useCurrentUser"
import axiosInstance from "@/service/axios"
import { FilterMatchMode } from "@primevue/core/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, onBeforeUnmount, ref, watch } from "vue"
import AddCabinetItemDialog from "./AddCabinetItemDialog.vue"

const toast = useToast()
const queryClient = useQueryClient()
const user = useCurrentUser()

const addDialog = ref(false)
const editingItem = ref(null)
const firstVisitDialog = ref(false)

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
})

const { data: cabinetStatus } = useQuery({
    queryKey: ["cabinet-status"],
    queryFn: async () => (await axiosInstance.get("/cabinet/status")).data,
    staleTime: Infinity
})

const { mutate: markCabinetInit } = useMutation({
    mutationFn: async () => (await axiosInstance.post("/cabinet/init")).data,
    onSuccess: () => queryClient.setQueryData(["cabinet-status"], { initialized: true })
})

watch(
    cabinetStatus,
    (val) => {
        if (val && val.initialized === false) {
            firstVisitDialog.value = true
        }
    },
    { immediate: true }
)

const { data: rows, isSuccess, isFetching, refetch } = useQuery({
    queryKey: ["cabinet-merged"],
    queryFn: async () => (await axiosInstance.get("/cabinet/merged")).data,
    staleTime: 30_000
})

const { data: ordersSummary } = useQuery({
    queryKey: ["cabinet-orders-summary"],
    queryFn: async () => (await axiosInstance.get("/cabinet/orders-summary")).data,
    staleTime: 30_000
})

const skeletonRows = Array.from({ length: 12 }, (_, i) => ({
    productId: `sk-${i}`,
    _skeleton: true,
    isCustom: false
}))
const needSnapshot = ref(new Map())

const tableRows = computed(() => {
    if (!isSuccess.value || !rows.value) return skeletonRows
    const edits = localEdits.value
    const snap = needSnapshot.value
    return rows.value.map((r) => {
        const key = r.productId || r.cabinetItemId
        const base = edits.has(`${key}-baseQty`) ? edits.get(`${key}-baseQty`) : r.baseQty || 0
        const curr = edits.has(`${key}-currentQty`) ? edits.get(`${key}-currentQty`) : r.currentQty || 0

        const inOrder = r.inOrderQty || 0
        const need = Math.max(0, base - curr - inOrder)
        return { ...r, need, needSort: snap.has(key) ? snap.get(key) : need }
    })
})

function onCabinetSort() {
    const edits = localEdits.value
    const m = new Map()
    for (const r of rows.value || []) {
        const key = r.productId || r.cabinetItemId
        const base = edits.has(`${key}-baseQty`) ? edits.get(`${key}-baseQty`) : r.baseQty || 0
        const curr = edits.has(`${key}-currentQty`) ? edits.get(`${key}-currentQty`) : r.currentQty || 0
        m.set(key, Math.max(0, base - curr - (r.inOrderQty || 0)))
    }
    needSnapshot.value = m
}

const { mutate: deleteItem } = useMutation({
    mutationFn: async (id) => await axiosInstance.delete(`/cabinet/${id}`),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["cabinet-merged"] })
        toast.add({ severity: "success", summary: "Позиция удалена", life: 2000 })
    }
})

const { mutate: saveItem } = useMutation({
    mutationFn: async (payload) => {
        if (payload._existingId) {
            return await axiosInstance.put(`/cabinet/${payload._existingId}`, {
                baseQty: payload.baseQty,
                currentQty: payload.currentQty,
                note: payload.note
            })
        }
        return await axiosInstance.post("/cabinet", {
            product: payload.productId || undefined,
            customName: payload.customName || undefined,
            baseQty: payload.baseQty || 0,
            currentQty: payload.currentQty || 0,
            note: payload.note || ""
        })
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["cabinet-merged"] })
    },
    onError: (err, variables) => {

        const rowKey = variables?.productId || variables?._existingId
        if (rowKey && localEdits.value.size) {
            const next = new Map(localEdits.value)
            next.delete(`${rowKey}-baseQty`)
            next.delete(`${rowKey}-currentQty`)
            localEdits.value = next
        }
        toast.add({
            severity: "error",
            summary: "Не удалось сохранить",
            detail: err?.response?.data?.message || err.message,
            life: 4000
        })
    }
})

const { mutate: runAutofill, isPending: isFilling } = useMutation({
    mutationFn: async () => (await axiosInstance.post("/cabinet/autofill")).data,
    onSuccess: (suggestions) => {
        const cart = JSON.parse(localStorage.getItem("cart") || "{}")
        let added = 0
        const missingNames = []
        for (const s of suggestions) {
            if (s.neededQty > 0) {
                if (!s.product) {
                    missingNames.push(s.productName + " (своя позиция)")
                    continue
                }
                if (s.isMissing) {

                    if (s.availableQty > 0) {
                        cart[s.product] = Math.max(cart[s.product] || 0, s.availableQty)
                        added++
                    }
                    missingNames.push(`${s.productName} — нужно ${s.neededQty}, доступно ${s.availableQty}`)
                } else {
                    cart[s.product] = Math.max(cart[s.product] || 0, s.neededQty)
                    added++
                }
            }
        }
        localStorage.setItem("cart", JSON.stringify(cart))
        queryClient.invalidateQueries({ queryKey: ["cartAmount"] })
        if (missingNames.length) {
            toast.add({
                severity: "warn",
                summary: `Корзина: +${added} позиций. Часть недоступна или вне склада`,
                detail: missingNames.slice(0, 5).join("; "),
                life: 8000
            })
        } else {
            toast.add({ severity: "success", summary: `Корзина обновлена: +${added} позиций`, life: 3000 })
        }
    }
})

const summary = computed(() => {
    const list = rows.value || []
    const edits = localEdits.value
    let deficitCount = 0
    let deficitValue = 0
    for (const r of list) {
        const key = `${r.productId || r.cabinetItemId}`
        const base = edits.has(`${key}-baseQty`) ? edits.get(`${key}-baseQty`) : r.baseQty || 0
        const curr = edits.has(`${key}-currentQty`) ? edits.get(`${key}-currentQty`) : r.currentQty || 0
        const need = Math.max(0, base - curr - (r.inOrderQty || 0))
        if (need > 0) {
            deficitCount++

            if (!r.isCustom) {
                deficitValue += need * (r.price || 0)
            }
        }
    }
    return {
        count: list.length,
        deficitCount,
        deficitValue
    }
})

function formatRub(value) {
    if (!value) return "0 ₽"
    return value.toLocaleString("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function openAdd() {
    editingItem.value = null
    addDialog.value = true
}

function openEdit(row) {
    if (!row?.cabinetItemId || !row?.isCustom) return
    editingItem.value = {
        cabinetItemId: row.cabinetItemId,
        customName: row.productName,
        baseQty: valueOf(row, "baseQty"),
        currentQty: valueOf(row, "currentQty"),
        customPrice: row.price || 0,
        note: row.note || ""
    }
    addDialog.value = true
}

function closeDialog() {
    addDialog.value = false
    editingItem.value = null
    refetch()
}

const localEdits = ref(new Map())
const saveTimers = new Map()
const BLUR_DEBOUNCE_MS = 350

function editKey(row, field) {
    return `${row.productId || row.cabinetItemId}-${field}`
}

function valueOf(row, field) {
    const key = editKey(row, field)
    if (localEdits.value.has(key)) return localEdits.value.get(key)
    return row[field]
}

function flushSave(row) {
    const baseKey = editKey(row, "baseQty")
    const currKey = editKey(row, "currentQty")
    const toNum = (v) => {
        const p = parseInt(String(v).replace(/\D+/g, ""), 10)
        return Number.isFinite(p) ? Math.max(0, p) : 0
    }
    const baseQty = toNum(localEdits.value.has(baseKey) ? localEdits.value.get(baseKey) : row.baseQty)
    const currentQty = toNum(localEdits.value.has(currKey) ? localEdits.value.get(currKey) : row.currentQty)
    const hasChange =
        baseQty !== (row.baseQty || 0) || currentQty !== (row.currentQty || 0)
    if (!hasChange) return
    saveItem({
        _existingId: row.cabinetItemId,
        productId: row.productId,
        customName: row.productName && row.isCustom ? row.productName : undefined,
        baseQty,
        currentQty,
        note: row.note
    })
}

function updateLocal(row, field, value) {
    const parsed = parseInt(value)
    const val = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
    const next = new Map(localEdits.value)
    next.set(editKey(row, field), val)
    localEdits.value = next
}

function updateLocalRaw(row, field, raw) {
    const next = new Map(localEdits.value)
    next.set(editKey(row, field), raw)
    localEdits.value = next
}

function normalizeAndSave(row, field) {
    const key = editKey(row, field)
    if (localEdits.value.has(key)) {
        const parsed = parseInt(String(localEdits.value.get(key)).replace(/\D+/g, ""), 10)
        const val = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
        const next = new Map(localEdits.value)
        next.set(key, val)
        localEdits.value = next
    }
    scheduleSave(row)
}

function scheduleSave(row) {
    const timerKey = row.productId || row.cabinetItemId
    clearTimeout(saveTimers.get(timerKey))
    saveTimers.set(
        timerKey,
        setTimeout(() => {
            saveTimers.delete(timerKey)
            flushSave(row)
        }, BLUR_DEBOUNCE_MS)
    )
}

onBeforeUnmount(() => {
    for (const t of saveTimers.values()) clearTimeout(t)
    saveTimers.clear()
})

const deleteConfirmDialog = ref(false)
const rowToDelete = ref(null)

function removeRow(row) {
    if (!row.cabinetItemId) return
    rowToDelete.value = row
    deleteConfirmDialog.value = true
}

function confirmDelete() {
    if (rowToDelete.value?.cabinetItemId) {
        deleteItem(rowToDelete.value.cabinetItemId)
    }
    deleteConfirmDialog.value = false
    rowToDelete.value = null
}

function setupCabinet() {
    markCabinetInit()
    firstVisitDialog.value = false
}

function skipCabinet() {
    markCabinetInit()
    firstVisitDialog.value = false
}
</script>

<template>
    <div class="cabinet-page">
        <header class="cabinet-header">
            <h1 class="cabinet-title">Личный склад</h1>
            <div class="header-actions">
                <Button label="Добавить свою позицию" icon="pi pi-plus" outlined @click="openAdd" v-tooltip.bottom="'Товары со склада уже есть в списке. Кнопка добавляет позицию, которой нет на складе.'" />
                <Button
                    v-if="summary.deficitCount > 0"
                    label="Автозаполнить корзину"
                    icon="pi pi-shopping-cart"
                    severity="primary"
                    :loading="isFilling"
                    @click="runAutofill()"
                />
            </div>
        </header>

        <div class="cabinet-kpi">
            <div class="kpi-chip">
                <span class="kpi-label">Позиций</span>
                <Skeleton v-if="!isSuccess" width="3rem" height="1.2rem" />
                <span v-else class="kpi-value">{{ summary.count }}</span>
            </div>
            <div class="kpi-chip">
                <span class="kpi-label">Дефицит</span>
                <Skeleton v-if="!isSuccess" width="2rem" height="1.2rem" />
                <span v-else class="kpi-value" :class="{ 'kpi-warn': summary.deficitCount > 0 }">{{ summary.deficitCount }}</span>
            </div>
            <div class="kpi-chip">
                <span class="kpi-label">Сумма дефицита</span>
                <Skeleton v-if="!isSuccess" width="5rem" height="1.2rem" />
                <span v-else class="kpi-value">{{ formatRub(summary.deficitValue) }}</span>
            </div>
            <div class="kpi-chip">
                <span class="kpi-label">Сумма заказов</span>
                <Skeleton v-if="!ordersSummary" width="5rem" height="1.2rem" />
                <span v-else class="kpi-value" v-tooltip.bottom="`Активных заказов: ${ordersSummary?.ordersCount || 0}`">{{ formatRub(ordersSummary?.ordersTotal || 0) }}</span>
            </div>
        </div>

        <DataTable
            :value="tableRows"
            size="small"
            scrollable
            class="sticky-actions-table"
            :paginator="true"
            :rows="50"
            :rowsPerPageOptions="[25, 50, 100, 200]"
            v-model:filters="filters"
            :globalFilterFields="['productName', 'category', 'note']"
            show-gridlines
            data-key="productId"
            sort-mode="single"
            :default-sort-order="-1"
            @sort="onCabinetSort"
            :loading="isFetching && !isSuccess"
        >
            <template #header>
                <div class="table-header">
                    <IconField>
                        <InputIcon><i class="pi pi-search" /></InputIcon>
                        <InputText v-model="filters['global'].value" placeholder="Поиск..." />
                    </IconField>
                </div>
            </template>
            <Column field="productName" header="Название" sortable>
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="80%" height="1rem" />
                    <span v-else :class="{ 'custom-name': row.isCustom }">{{ row.productName }}<small v-if="row.isCustom"> (своя)</small></span>
                </template>
            </Column>
            <Column field="category" header="Вид" sortable>
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="50%" height="1rem" />
                    <span v-else>{{ row.category }}</span>
                </template>
            </Column>
            <Column field="price" header="Цена" sortable>
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="3rem" height="1rem" />
                    <span v-else-if="row.price">{{ formatRub(row.price) }}</span>
                    <span v-else>—</span>
                </template>
            </Column>
            <Column field="stockQty" header="На складе">
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="2rem" height="1rem" />
                    <span v-else-if="row.stockQty !== null">{{ row.stockQty }}</span>
                    <span v-else>—</span>
                </template>
            </Column>
            <Column field="baseQty" header="Цель" sortable style="padding: 0.3rem">
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="4rem" height="2rem" />
                    <InputText
                        v-else
                        class="cabinet-qty"
                        inputmode="numeric"
                        size="small"
                        :model-value="String(valueOf(row, 'baseQty') ?? '')"
                        @input="(e) => updateLocalRaw(row, 'baseQty', e.target.value)"
                        @blur="normalizeAndSave(row, 'baseQty')"
                        :style="{ width: '60px', textAlign: 'center' }"
                    />
                </template>
            </Column>
            <Column field="currentQty" header="У меня" sortable style="padding: 0.3rem">
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="6rem" height="2.5rem" />
                    <InputNumber
                        v-else
                        class="cabinet-qty"
                        :modelValue="valueOf(row, 'currentQty')"
                        @input="(e) => updateLocal(row, 'currentQty', e.value)"
                        @blur="scheduleSave(row)"
                        :min="0"
                        :useGrouping="false"
                        size="small"
                        showButtons
                        buttonLayout="horizontal"
                        incrementButtonIcon="pi pi-plus"
                        decrementButtonIcon="pi pi-minus"
                        :inputStyle="{ width: '50px', textAlign: 'center' }"
                    />
                </template>
            </Column>
            <Column field="inOrderQty" header="В заказе" sortable>
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="2rem" height="1rem" />
                    <Tag v-else-if="row.inOrderQty > 0" :value="row.inOrderQty" severity="info" v-tooltip.top="'В активных (незавершённых) заказах'" />
                    <span v-else>—</span>
                </template>
            </Column>
            <Column field="need" header="Нужно" sortable :sort-field="'needSort'">
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" width="2rem" height="1.4rem" border-radius="999px" />
                    <Tag
                        v-else-if="row.need > 0"
                        :value="row.need"
                        severity="warn"
                    />
                </template>
            </Column>
            <Column header="" style="min-width: 120px">
                <template #body="{ data: row }">
                    <Skeleton v-if="row._skeleton" shape="circle" size="2rem" />
                    <div v-else-if="row.cabinetItemId && row.isCustom" class="row-actions">
                        <Button
                            icon="pi pi-pencil"
                            size="small"
                            outlined
                            rounded
                            v-tooltip.left="'Редактировать свою позицию'"
                            @click="openEdit(row)"
                        />
                        <Button
                            icon="pi pi-times"
                            size="small"
                            outlined
                            rounded
                            severity="danger"
                            v-tooltip.left="'Удалить свою позицию'"
                            @click="removeRow(row)"
                        />
                    </div>
                </template>
            </Column>
        </DataTable>

        <AddCabinetItemDialog v-if="addDialog" :visible="addDialog" :item="editingItem" @close="closeDialog" />

        <Dialog
            v-model:visible="deleteConfirmDialog"
            :style="{ width: '95%', maxWidth: '420px' }"
            :breakpoints="{ '768px': '100vw' }"
            header="Удалить позицию?"
            modal
        >
            <div class="flex items-center gap-4">
                <i class="pi pi-exclamation-triangle !text-3xl" style="color: #ef4444" />
                <span>
                    Удалить «<b>{{ rowToDelete?.productName }}</b>» из личного склада? Действие нельзя отменить.
                </span>
            </div>
            <template #footer>
                <Button label="Нет" icon="pi pi-times" text @click="deleteConfirmDialog = false" />
                <Button label="Удалить" icon="pi pi-trash" severity="danger" @click="confirmDelete" />
            </template>
        </Dialog>

        <Dialog v-model:visible="firstVisitDialog" header="Создать личный склад?" :style="{ width: '95%', maxWidth: '440px' }" :closable="false" modal>
            <div class="onboarding-body">
                <i class="pi pi-briefcase onboarding-icon"></i>
                <p>
                    «Личный склад» — это твой персональный список позиций с целевым и текущим количеством.
                    Когда чего-то не хватает, ты в один клик автозаполняешь корзину тем что нужно докупить.
                    После того как заказ подтверждён, твой склад автоматически пополняется.
                </p>
                <p class="muted">Создать твой личный склад сейчас? Можно отказаться и активировать позже.</p>
            </div>
            <template #footer>
                <Button label="Позже" icon="pi pi-times" text @click="skipCabinet" />
                <Button label="Да, создать" icon="pi pi-check" severity="primary" @click="setupCabinet" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.cabinet-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
}
.cabinet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
}
.cabinet-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
}
.header-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
.cabinet-kpi {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
}
.kpi-chip {
    background: var(--p-content-background, #ffffff);
    border: 1px solid var(--p-content-border-color, rgba(0, 0, 0, 0.08));
    border-radius: 12px;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.kpi-label {
    font-size: 11px;

    color: #475569;
    text-transform: uppercase;
}
:global(.app-dark) .kpi-label {
    color: #cbd5e1;
}
.kpi-value {
    font-size: 16px;
    font-weight: 600;
}
.kpi-warn {
    color: #d97706;
}
.table-header {
    display: flex;
    justify-content: flex-end;
}
.custom-name {
    font-style: italic;
}
.row-actions {
    display: inline-flex;
    gap: 4px;
}
.onboarding-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
    padding: 8px;
}
.onboarding-icon {
    font-size: 36px;
    opacity: 0.85;
}
.muted {
    opacity: 0.7;
    font-size: 13px;
}

.cabinet-qty :deep(.p-inputnumber-input) {
    height: 40px;
    padding: 4px 6px;
    font-size: 16px;
}
.cabinet-qty :deep(.p-inputnumber-button) {
    width: 40px;
    min-width: 40px;
    height: 40px;
    padding: 0;
}
.cabinet-qty :deep(.p-inputnumber-button .p-icon) {
    width: 14px;
    height: 14px;
}

:deep(.p-datatable .p-datatable-tbody > tr > td) {
    padding: 0.3rem !important;
}
</style>
