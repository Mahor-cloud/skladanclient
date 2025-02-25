<script setup>
import axiosInstance from "@/service/axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { computed, ref, watchEffect } from "vue"

const props = defineProps({
    roleId: String,
    visible: Boolean,
    usersData: Object,
    editable: Boolean
})

const emit = defineEmits(["closeRoleDialog"])

const role = ref({})
const visible = ref(props.visible)
const selectedPermissions = ref([])
const permissions = ref([
    "view_users",
    "create_users",
    "edit_users",
    "delete_users",
    "create_change_history",
    "view_change_history",
    "create_inventory",
    "view_inventory",
    "delete_inventory",
    "edit_inventory",
    "create_orders",
    "view_orders",
    "edit_orders",
    "delete_orders",
    "create_purchases",
    "view_purchases",
    "edit_purchases",
    "delete_purchases",
    "create_product",
    "view_products",
    "edit_products",
    "delete_products",
    "create_role",
    "view_roles",
    "edit_roles",
    "delete_roles",
    "export-database",
    "import-database",
    "approve-payment"
])
const submitted = ref(false)

const isActiveUser = computed({
    get() {
        return props.usersData?.some((user) => user.role._id === props.roleId)
    }
})

const queryClient = useQueryClient()

const { data: roleData, isSuccess: isRoleSuccess } = useQuery({
    queryKey: ["role", props.roleId],
    queryFn: async () => await axiosInstance.get(`/roles/${props.roleId}`),
    enabled: !!props.roleId,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5
})

const { mutate: updateRole } = useMutation({
    mutationKey: ["updateRole"],
    mutationFn: async (role) => {
        if (!props.roleId) {
            return await axiosInstance.post("/roles", role)
        }
        return await axiosInstance.put(`/roles/${props.roleId}`, role)
    },
    onSuccess: (data) => {
        props.roleId && queryClient.setQueryData(["role", data.data._id], data)
        queryClient.invalidateQueries({ queryKey: ["roles"] })
        role.value = false
        emit("closeRoleDialog")
    }
})

const { mutate: deleteRole } = useMutation({
    mutationKey: ["delete_role", props.roleId],
    mutationFn: async () => await axiosInstance.delete(`/roles/${props.roleId}`),
    onSuccess: (data) => {
        queryClient.setQueryData(["role", data.data._id], {})
        queryClient.invalidateQueries({ queryKey: ["roles"] })
        role.value = false
        emit("closeRoleDialog")
    }
})

watchEffect(() => {
    if (isRoleSuccess.value) {
        role.value = { ...roleData.value }
    }
})

function handleSubmit() {
    submitted.value = true
    if (!role.value.name) return
    updateRole(role.value)
}
</script>
<template>
    <Dialog v-model:visible="visible" :style="{ width: '450px' }" header="Детали роли" :modal="true" v-on:update:visible="emit('closeRoleDialog')">
        <div class="flex flex-col gap-6">
            <div>
                <label for="name" class="block font-bold mb-3">Название</label>
                <InputText :disabled="!props.editable" id="name" autocomplete="off" v-model.trim="role.name" required="true" autofocus fluid />
                <small v-if="submitted" class="text-red-500">Название необходимо.</small>
            </div>

            <div class="flex flex-wrap gap-4">
                <div v-for="permission of permissions" :key="permission" class="flex flex-[1_0_calc(50%-1rem)] items-center gap-2">
                    <Checkbox :disabled="!props.editable" v-model="role.permissions" name="category" :value="permission" />
                    <label :for="permission">{{ permission }}</label>
                </div>
            </div>
        </div>

        <template #footer>
            <Button :disabled="!props.editable" label="Отмена" icon="pi pi-times" text @click="emit('closeRoleDialog')" />
            <Button :disabled="!props.editable" label="Сохранить" icon="pi pi-check" @click="handleSubmit" />
            <Button :disabled="isActiveUser || !props.editable" label="Удалить" icon="pi pi-trash" severity="danger" @click="deleteRole()" />
        </template>
    </Dialog>
</template>
