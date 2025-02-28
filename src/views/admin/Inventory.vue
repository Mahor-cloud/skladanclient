<script setup>
import axiosInstance from "@/service/axios"
import formatTimestamp from "@/service/DateService"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { ref, watchEffect } from "vue"
import InventoryDialog from "./InventoryDialog.vue"

const queryClient = useQueryClient()
const toast = useToast()
const inventorizations = ref([])
const newInventorizationDialog = ref(null)
const inventorizationDialog = ref(null)
const inventorization = ref({})

const user = ref(JSON.parse(localStorage.getItem("user")))

const { isError, data, error, isSuccess, isFetching } = useQuery({
    queryKey: ["inventorizations"],
    queryFn: async () => await axiosInstance.get("/inventory"),
    refetchOnWindowFocus: false,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const { mutate: createInventorization, isSuccess: isSuccessCreate } = useMutation({
    mutationKey: ["inventorization", "create"],
    mutationFn: async () => {
        return await axiosInstance.post("/inventory")
    },
    onSuccess: (data) => {
        queryClient.setQueryData(["inventorization", data.data._id], data)
        queryClient.invalidateQueries(["inventorizations"])
        toast.add({ severity: "success", summary: "Успешно", detail: "Инвентаризация создана", life: 3000 })
        inventorization.value = data.data?._id
        inventorizationDialog.value = true
        newInventorizationDialog.value = false
    }
})

watchEffect(() => {
    if (isSuccess.value) {
        inventorizations.value = data.value
    }
})

function editInventorization(_id) {
    inventorization.value = _id
    inventorizationDialog.value = true
}

function hideInventoryDialog() {
    inventorization.value = {}
    inventorizationDialog.value = false
}
</script>

<template>
    <div class="card">
        <Toolbar v-if="user.role?.permissions?.includes('create_inventory')" class="mb-6">
            <template #start>
                <Button
                    :disabled="inventorizations.some((item) => !item.isCompleted) || !user.role?.permissions?.includes('create_inventory')"
                    label="Создать"
                    icon="pi pi-plus"
                    severity="secondary"
                    class="mr-2"
                    @click="newInventorizationDialog = true"
                />
            </template>
        </Toolbar>
        <DataTable sortField="startDate" :sortOrder="-1" class="w-[100%]" size="small" :value="inventorizations">
            <Column field="complete" header="Статус">
                <template #body="slotProps">
                    <Message size="small" variant="simple" :severity="slotProps.data.isCompleted ? 'severity' : 'warn'"> {{ slotProps.data.isCompleted ? "Завершена" : "В процессе" }}</Message>
                </template>
            </Column>
            <Column field="date">
                <template #header> <span>Дата</span> </template>
                <template #body="slotProps">
                    {{ formatTimestamp(slotProps.data.startDate) }}
                </template>
            </Column>
            <Column style="padding: 0.1rem; min-width: 82px">
                <template #body="slotProps">
                    <Button size="small" label="Детали" severity="info" icon="pi pi-info-circle" outlined rounded @click="editInventorization(slotProps.data._id)" />
                </template>
            </Column>
        </DataTable>

        <Dialog :closable="false" v-model:visible="newInventorizationDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
            <div class="flex items-center">
                <span>Вы уверенны что хотите начать инвентаризацию?</span>
            </div>
            <template #footer>
                <Button label="Нет" icon="pi pi-times" text @click="newInventorizationDialog = false" />
                <Button label="Да" icon="pi pi-check" @click="createInventorization()" />
            </template>
        </Dialog>

        <InventoryDialog v-if="inventorizationDialog" :editable="user.role?.permissions?.includes('edit_inventory')" v-model:visible="inventorizationDialog" :inventorization="inventorization" @hideInventoryDialog="hideInventoryDialog" />
    </div>
</template>

<style lang="scss">
.p-datatable-column-sorted {
    background: var(--p-datatable-header-cell-background) !important;

    color: var(--p-datatable-header-cell-color) !important;
}
</style>
