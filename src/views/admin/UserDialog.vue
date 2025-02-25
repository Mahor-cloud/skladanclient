<script setup>
import axiosInstance from "@/service/axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { ref, watchEffect } from "vue"

const props = defineProps({
    userId: String,
    visible: Boolean,
    rolesData: Array,
    editable: Boolean
})

const emit = defineEmits(["closeUserDialog"])

const user = ref({})
const visible = ref(props.visible)
const submitted = ref(false)
const passwordChanged = ref(false)
const passwordChangedDialog = ref(false)

const queryClient = useQueryClient()

const { data: userData, isSuccess: isUserSuccess } = useQuery({
    queryKey: ["user", props.userId],
    queryFn: async () => await axiosInstance.get(`/auth/user/${props.userId}`),
    enabled: !!props.userId,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5
})

const { mutate: updateUser } = useMutation({
    mutationKey: ["updateUser"],
    mutationFn: async (user) => {
        if (!props.userId) {
            return await axiosInstance.post("/auth/create", user.value)
        }
        const userData = { ...user.value }
        if (!passwordChanged.value) {
            delete userData.password
        }
        return await axiosInstance.put(`/auth/${props.userId}`, userData)
    },
    onSuccess: (data) => {
        props.userId && queryClient.setQueryData(["user", data.data._id], data)
        queryClient.invalidateQueries({ queryKey: ["users"] })
        user.value = false
        emit("closeUserDialog")
    }
})

const { mutate: deleteUser } = useMutation({
    mutationKey: ["delete_user", props.userId],
    mutationFn: async () => await axiosInstance.delete(`/auth/${props.userId}`),
    onSuccess: (data) => {
        queryClient.setQueryData(["user", data.data._id], {})
        queryClient.invalidateQueries({ queryKey: ["users"] })
        user.value = false
        emit("closeUserDialog")
    }
})

watchEffect(() => {
    if (isUserSuccess.value) {
        user.value = { ...userData.value }
    }
})

function handleSubmit() {
    submitted.value = true
    if (!user.value.name) return
    updateUser(user)
}
</script>
<template>
    <Dialog v-model:visible="visible" :style="{ width: '450px' }" header="Детали пользователя" :modal="true" v-on:update:visible="emit('closeUserDialog')">
        <div class="flex flex-col gap-6">
            <div>
                <label for="name" class="block font-bold mb-3">Название</label>
                <InputText :disabled="!props.editable" id="name" autocomplete="off" v-model.trim="user.name" required="true" autofocus fluid />
                <small v-if="submitted" class="text-red-500">Название необходимо.</small>
            </div>
            <div class="items-center flex">
                <Checkbox :disabled="!props.editable" v-model="user.isAdmin" binary />
                <label class="ml-2">Служащий?</label>
            </div>
            <div class="flex flex-col">
                <label class="block font-bold mb-3">Роль</label>
                <Select :disabled="!props.editable" v-model="user.role" :options="props.rolesData" optionLabel="name" placeholder="Роль" class="w-full md:w-56" />
            </div>
            <div class="flex flex-row gap-6">
                <FloatLabel variant="on">
                    <InputText :disabled="!props.editable" v-model="user.login" inputId="login" />
                    <label for="login">Логин</label>
                </FloatLabel>
                <FloatLabel variant="on">
                    <Password
                        :disabled="!props.editable"
                        v-model="user.password"
                        inputId="password"
                        @focus="
                            (e) => {
                                if (!passwordChanged && props.userId) {
                                    passwordChangedDialog = true
                                    e.target.blur()
                                }
                            }
                        "
                    />
                    <label for="password">Пароль</label>
                </FloatLabel>
            </div>
        </div>

        <template #footer>
            <Button :disabled="!props.editable" label="Отмена" icon="pi pi-times" text @click="emit('closeUserDialog')" />
            <Button :disabled="!props.editable" label="Сохранить" icon="pi pi-check" @click="handleSubmit" />
            <Button :disabled="!props.editable" label="Удалить" icon="pi pi-trash" severity="danger" @click="deleteUser()" />
        </template>
    </Dialog>

    <Dialog v-model:visible="passwordChangedDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что хотите поменять пароль?</span>
        </div>
        <template #footer>
            <Button label="No" icon="pi pi-times" text @click="passwordChangedDialog = false" />
            <Button
                label="Yes"
                icon="pi pi-check"
                @click="
                    () => {
                        passwordChanged = true
                        passwordChangedDialog = false
                        user.password = ''
                    }
                "
            />
        </template>
    </Dialog>
</template>
