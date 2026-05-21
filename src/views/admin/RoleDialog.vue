<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
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

const visible = computed(() => props.visible)
const submitted = ref(false)

const permissionLabels = {
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

const permissionGroups = [
    {
        label: "Пользователи и роли",
        perms: ["view_users", "create_users", "edit_users", "delete_users", "view_roles", "create_role", "edit_roles", "delete_roles"]
    },
    {
        label: "Заказы",
        perms: ["view_orders", "create_orders", "edit_orders", "delete_orders"]
    },
    {
        label: "Закупки",
        perms: ["view_purchases", "create_purchases", "edit_purchases", "delete_purchases"]
    },
    {
        label: "Товары",
        perms: ["view_products", "create_product", "edit_products", "delete_products"]
    },
    {
        label: "Инвентаризация",
        perms: ["view_inventory", "create_inventory", "edit_inventory", "delete_inventory"]
    },
    {
        label: "Личный склад",
        perms: ["cabinet_access", "view_all_cabinets", "view_cabinet_summary"]
    },
    {
        label: "Статистика и история",
        perms: ["view_statistics", "export_statistics", "view_change_history", "create_change_history"]
    },
    {
        label: "Сообщения и база",
        perms: ["approve-payment", "approve_target_exceed", "view-messages", "edit-payment-message", "edit-received-message", "export-database", "import-database"]
    }
]

const labelFor = (p) => permissionLabels[p] || p

const permissionHelp = {
    view_users: "Видеть список пользователей компании.",
    create_users: "Создавать новых пользователей.",
    edit_users: "Изменять данные пользователей (имя, роль, логин, пароль).",
    delete_users: "Удалять пользователей.",
    view_roles: "Видеть список ролей и их состав.",
    create_role: "Создавать новые роли.",
    edit_roles: "Изменять права существующих ролей.",
    delete_roles: "Удалять роли (если роль никому не назначена).",
    create_change_history: "Создавать записи в истории изменений.",
    view_change_history: "Просматривать историю изменений.",
    view_inventory: "Видеть список инвентаризаций.",
    create_inventory: "Запускать новую инвентаризацию.",
    edit_inventory: "Редактировать и завершать инвентаризацию.",
    delete_inventory: "Удалять незавершённую инвентаризацию.",
    view_orders: "Видеть заказы.",
    create_orders: "Создавать заказы (в т.ч. из корзины).",
    edit_orders: "Менять позиции и количество в заказах (в т.ч. чужих).",
    delete_orders: "Отменять/удалять незавершённые заказы.",
    "approve-payment": "Подтверждать оплату заказов и оплачивать закупки. НЕ даёт права менять позиции.",
    approve_target_exceed: "Подтверждать закупку, в которой количество превышает цель по товару.",
    view_purchases: "Видеть закупки.",
    create_purchases: "Создавать закупки.",
    edit_purchases: "Менять позиции и количество в закупках, проводить получение.",
    delete_purchases: "Удалять незавершённые закупки.",
    view_products: "Видеть каталог товаров и остатки.",
    create_product: "Добавлять новые товары.",
    edit_products: "Изменять товары (цена, категория и т.д.).",
    delete_products: "Удалять товары.",
    cabinet_access: "Пользоваться своим личным складом и автозаполнением корзины.",
    view_all_cabinets: "Видеть личные склады других пользователей.",
    view_cabinet_summary: "Видеть сводную таблицу по личным складам.",
    view_statistics: "Открывать раздел статистики.",
    export_statistics: "Выгружать статистику в файл (CSV).",
    "view-messages": "Видеть сообщения об оплате и о получении.",
    "edit-payment-message": "Изменять текст сообщения об оплате.",
    "edit-received-message": "Изменять текст сообщения о получении.",
    "export-database": "Выгружать базу данных компании.",
    "import-database": "Загружать (восстанавливать) базу данных компании."
}
const helpFor = (p) => permissionHelp[p] || "Описание для этого права пока не задано."
const helpDialog = ref(false)
const helpPerm = ref(null)
function openPermHelp(p) {
    helpPerm.value = p
    helpDialog.value = true
}

const isActiveUser = computed(
    () => props.usersData?.some((user) => user.role?._id === props.roleId)
)

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
        role.value = { ...roleData.value, permissions: [...(roleData.value.permissions || [])] }
    }
})

function handleSubmit() {
    submitted.value = true
    if (!role.value.name) return
    const payload = {
        name: role.value.name,
        permissions: role.value.permissions || []
    }
    updateRole(payload)
}
</script>
<template>
    <Dialog
        :visible="visible"
        :style="{ width: '640px' }"
        :breakpoints="{ '768px': '100vw' }"
        header="Детали роли"
        :modal="true"
        :draggable="false"
        @update:visible="emit('closeRoleDialog')"
    >
        <div class="flex flex-col gap-6">
            <div>
                <label for="name" class="block font-bold mb-3">Название</label>
                <InputText
                    :disabled="!props.editable || role.name === 'Admin'"
                    id="name"
                    autocomplete="off"
                    v-model.trim="role.name"
                    required="true"
                    autofocus
                    fluid
                />
                <small v-if="submitted && !role.name" class="text-red-500">Название необходимо.</small>
            </div>

            <div class="perm-groups">
                <fieldset v-for="group in permissionGroups" :key="group.label" class="perm-group">
                    <legend class="perm-group__title">{{ group.label }}</legend>
                    <div class="perm-grid">
                        <div v-for="permission of group.perms" :key="permission" class="perm-row">
                            <label class="perm-row__main" :for="`perm-${permission}`">
                                <Checkbox
                                    :disabled="!props.editable || role.name === 'Admin'"
                                    :inputId="`perm-${permission}`"
                                    v-model="role.permissions"
                                    :value="permission"
                                    binary-cancel
                                />
                                <span class="perm-row__label">{{ labelFor(permission) }}</span>
                            </label>
                            <Button
                                type="button"
                                severity="help"
                                size="small"
                                text
                                rounded
                                icon="pi pi-question-circle"
                                class="perm-row__help"
                                aria-label="Что даёт это право"
                                v-tooltip.top="'Что даёт это право'"
                                @click.stop.prevent="openPermHelp(permission)"
                            />
                        </div>
                    </div>
                </fieldset>
            </div>
        </div>

        <template #footer>
            <Button :disabled="!props.editable" label="Отмена" icon="pi pi-times" text @click="emit('closeRoleDialog')" />
            <Button :disabled="!props.editable || role.name === 'Admin'" label="Сохранить" icon="pi pi-check" @click="handleSubmit" />
            <Button :disabled="isActiveUser || !props.editable || role.name === 'Admin'" label="Удалить" icon="pi pi-trash" severity="danger" @click="deleteRole()" />
        </template>
    </Dialog>

    <Dialog
        v-model:visible="helpDialog"
        :style="{ width: '95%', maxWidth: '420px' }"
        :breakpoints="{ '768px': '100vw' }"
        :header="helpPerm ? labelFor(helpPerm) : 'Право'"
        :modal="true"
        :draggable="false"
    >
        <p style="line-height: 1.4">{{ helpPerm ? helpFor(helpPerm) : '' }}</p>
        <template #footer>
            <Button label="Понятно" icon="pi pi-check" @click="helpDialog = false" />
        </template>
    </Dialog>
</template>

<style scoped>
.perm-groups {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.perm-group {
    border: 1px solid var(--p-content-border-color, rgba(0, 0, 0, 0.1));
    border-radius: 10px;
    padding: 8px 12px 12px;
}
.perm-group__title {
    padding: 0 6px;
    font-weight: 600;
    font-size: 13px;
    opacity: 0.8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.perm-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    margin-top: 6px;
}
@media (min-width: 480px) {
    .perm-grid {
        grid-template-columns: 1fr 1fr;
    }
}
.perm-row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 36px;
}
.perm-row__main {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    flex: 1 1 auto;
    min-width: 0;
}
.perm-row__help {
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
}
.perm-row__label {
    font-size: 14px;
    line-height: 1.3;
}
</style>
