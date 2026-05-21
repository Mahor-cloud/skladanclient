<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import axiosInstance from "@/service/axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query"
import { useToast } from "primevue/usetoast"
import { computed, ref, watchEffect } from "vue"

const props = defineProps({
    userId: String,
    visible: Boolean,
    rolesData: Array,
    editable: Boolean
})

const emit = defineEmits(["closeUserDialog"])

const user = ref({})

const visible = computed(() => props.visible)
const submitted = ref(false)
const passwordChanged = ref(false)
const passwordChangedDialog = ref(false)

const loginError = ref("")

const queryClient = useQueryClient()
const toast = useToast()

function buildPayload() {
    const u = user.value || {}
    const roleId = u.role && typeof u.role === "object" ? u.role._id : u.role
    const payload = {}
    if (u.login != null) payload.login = String(u.login).trim()
    if (roleId) payload.role = roleId
    if (u.name != null) payload.name = String(u.name).trim()
    if (typeof u.isAdmin === "boolean") payload.isAdmin = u.isAdmin
    if (!props.userId || passwordChanged.value) payload.password = u.password
    return payload
}

const { data: userData, isSuccess: isUserSuccess } = useQuery({
    queryKey: ["user", props.userId],
    queryFn: async () => await axiosInstance.get(`/auth/user/${props.userId}`),
    enabled: !!props.userId,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5
})

const { mutate: updateUser } = useMutation({
    mutationKey: ["updateUser"],
    mutationFn: async () => {
        const payload = buildPayload()
        if (!props.userId) {
            return await axiosInstance.post("/auth/create", payload)
        }
        return await axiosInstance.put(`/auth/${props.userId}`, payload)
    },
    onSuccess: (data) => {
        props.userId && queryClient.setQueryData(["user", data.data._id], data)
        queryClient.invalidateQueries({ queryKey: ["users"] })
        toast.add({ severity: "success", summary: props.userId ? "Пользователь обновлён" : "Пользователь создан", life: 2500 })
        user.value = false
        emit("closeUserDialog")
    },
    onError: (err) => {
        const raw = err?.response?.data?.message
        const msg = Array.isArray(raw) ? raw.join(", ") : raw || err.message

        if (typeof msg === "string" && /логин/i.test(msg) && /занят/i.test(msg)) {
            loginError.value = msg
        }
        toast.add({
            severity: "error",
            summary: "Не удалось сохранить пользователя",
            detail: msg,
            life: 6000
        })
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

function commitActiveField() {
    const el = document.activeElement
    if (el && typeof el.blur === "function") el.blur()
}

function handleSubmit() {
    commitActiveField()
    submitted.value = true
    loginError.value = ""
    const u = user.value || {}
    if (!u.name || !String(u.name).trim()) return
    if (!props.userId) {
        if (!u.login || String(u.login).trim().length < 1) {
            toast.add({ severity: "warn", summary: "Укажите логин", life: 3500 })
            return
        }
        if (!u.password || String(u.password).length < 4) {
            toast.add({ severity: "warn", summary: "Пароль минимум 4 символа", life: 3500 })
            return
        }
    }
    updateUser()
}
</script>
<template>
    <Dialog :visible="visible" :style="{ width: '450px' }" header="Детали пользователя" :modal="true" :draggable="false" @update:visible="emit('closeUserDialog')">
        <div class="flex flex-col gap-6">
            <div>
                <label for="name" class="block font-bold mb-3">Название</label>
                <InputText :disabled="!props.editable" id="name" autocomplete="off" v-model="user.name" required="true" autofocus fluid />
                <small v-if="submitted && (!user.name || !String(user.name).trim())" class="text-red-500">Название необходимо.</small>
            </div>
            <div class="items-center flex">
                <Checkbox :disabled="!props.editable || user.role?.name === 'Admin'" v-model="user.isAdmin" binary />
                <label class="ml-2">Служащий?</label>
            </div>
            <div class="flex flex-col">
                <label class="block font-bold mb-3">Роль</label>
                <Select :disabled="!props.editable || user.role?.name === 'Admin'" v-model="user.role" :options="props.rolesData" optionLabel="name" placeholder="Роль" class="w-full md:w-56" />
            </div>
            <div class="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <div class="flex flex-col">
                    <FloatLabel variant="on">
                        <InputText :disabled="!props.editable || user.role?.name === 'Admin'" v-model="user.login" inputId="login" :invalid="!!loginError" @input="loginError = ''" />
                        <label for="login">Логин</label>
                    </FloatLabel>
                    <small v-if="loginError" class="text-red-500 mt-1">{{ loginError }}</small>
                </div>
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
            <Button :disabled="!props.editable || user.role?.name === 'Admin'" label="Удалить" icon="pi pi-trash" severity="danger" @click="deleteUser()" />
        </template>
    </Dialog>

    <Dialog v-model:visible="passwordChangedDialog" :style="{ width: '450px' }" header="Подтвердите" :modal="true" :draggable="false">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Вы уверенны что хотите поменять пароль?</span>
        </div>
        <template #footer>
            <Button label="Нет" icon="pi pi-times" text @click="passwordChangedDialog = false" />
            <Button
                label="Да"
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
