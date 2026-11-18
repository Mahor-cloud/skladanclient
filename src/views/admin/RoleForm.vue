<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { plural } from "@/domain/format"
import axiosInstance from "@/service/axios"
import { backTo, confirm, toast, UiBanner, UiBtn, UiField, UiIcon, UiSheet } from "@/ui"
import { useQueryClient } from "@tanstack/vue-query"
import { computed, reactive, ref, watch } from "vue"
import { ALL, errText, menuCtx, orderedPerms, PERMS, pruneMenu, roleId, rolePerms, useRoles, useUsers } from "./admin"
import RoleMenu from "./RoleMenu.vue"

// Роль: создание (admin-role-new) и правка (admin-role) — права по группам и нижнее меню телефона.
const props = defineProps({ id: { type: String, default: "" } })
const queryClient = useQueryClient()
const { user, can, isSys } = useSession()
const { data: roles } = useRoles()
const { data: users } = useUsers()

const isNew = !props.id
const r = computed(() => (roles.value || []).find((x) => x._id === props.id))
const toList = () => backTo({ name: "admin-roles" })
let leaving = false
watch(
    () => [roles.value, r.value],
    () => {
        if (!isNew && !leaving && roles.value && !r.value) {
            toast({ type: "error", title: "Роль не найдена" })
            toList()
        }
    },
    { immediate: true }
)

const sys = computed(() => !!r.value?.isSystem)
// Сервер меняет роли только при флаге «Служащий» (AdminGuard) и праве; системной роли председателя мало.
const admin = computed(() => !!user.value?.isAdmin)
const ro = computed(() => sys.value || !admin.value || !can(isNew ? "create_role" : "edit_roles"))
// Меню системной роли настраивает только председатель; её права не меняются.
const menuRo = computed(() => (sys.value ? !(isSys.value && admin.value && can("edit_roles")) : ro.value))
const orig = ref([])
const sel = reactive(new Set())
const name = ref("")
const menu = ref(null)
const q = ref("")
const err = ref("")
const dirty = ref(false)
const saving = ref(false)
watch(
    r,
    (x) => {
        if (!x || dirty.value) return
        orig.value = rolePerms(x)
        sel.clear()
        orig.value.forEach((p) => sel.add(p))
        name.value = x.name || ""
        menu.value = x.mobileTabs?.length ? [...x.mobileTabs] : null
    },
    { immediate: true }
)
const ctx = computed(() => menuCtx(sys.value, (p) => sel.has(p)))
// Права изменились — разделы без права уходят из своего набора меню.
watch(
    () => [...sel],
    () => (menu.value = pruneMenu(menu.value, ctx.value))
)
const assigned = computed(() => (users.value || []).filter((u) => roleId(u) === props.id))
const changed = computed(() => ALL.filter((p) => orig.value.includes(p) !== sel.has(p)).length)
const groups = computed(() => {
    const s = q.value.trim().toLowerCase()
    return PERMS.map(([title, icon, list]) => ({ title, icon, list, vis: list.filter((p) => !s || p[1].toLowerCase().includes(s) || p[2].toLowerCase().includes(s)), on: list.filter((p) => sel.has(p[0])).length })).filter((g) => g.vis.length)
})
function setPerm(p, on) {
    on ? sel.add(p) : sel.delete(p)
    dirty.value = true
}
function setGroup(g, on) {
    g.list.forEach((p) => (on ? sel.add(p[0]) : sel.delete(p[0])))
    dirty.value = true
}
function setMenu(v) {
    menu.value = v
    dirty.value = true
}
const sub = computed(() => {
    if (isNew || !users.value) return ""
    const n = assigned.value.length
    return n
        ? `Назначена: ${assigned.value
              .slice(0, 3)
              .map((u) => u.name)
              .join(", ")}${n > 3 ? ` и ещё ${n - 3}` : ""}`
        : "Никому не назначена"
})

const sheet = ref(null)
function done() {
    leaving = true
    dirty.value = false
    sheet.value.close("save")
}
async function save() {
    const nm = name.value.trim()
    err.value = !nm ? "Укажите название роли" : (roles.value || []).some((x) => x._id !== props.id && x.name?.trim().toLowerCase() === nm.toLowerCase()) ? "Роль с таким названием уже есть" : ""
    if (err.value) return
    // Системной роли сервер меняет только меню (название и права молча пропускает).
    const payload = { name: nm, permissions: orderedPerms(orig.value, sel), mobileTabs: menu.value?.length ? menu.value : [] }
    saving.value = true
    try {
        await (isNew ? axiosInstance.post("/roles", payload) : axiosInstance.put(`/roles/${props.id}`, payload))
    } catch (e) {
        saving.value = false
        return toast({ type: "error", title: "Не удалось сохранить роль", text: errText(e, "Ошибка сервера") })
    }
    saving.value = false
    queryClient.invalidateQueries({ queryKey: ["roles"] })
    queryClient.invalidateQueries({ queryKey: ["users"] })
    const n = assigned.value.length
    toast({
        type: "success",
        title: isNew ? "Роль создана" : "Права роли сохранены",
        text: `«${nm}» · ${sel.size} из ${ALL.length} прав${!isNew && n ? ` · меню у ${n} ${plural(n, ["человека", "человек", "человек"])} обновится сразу` : ""}`
    })
    done()
}
async function remove() {
    const nm = r.value.name
    if (!(await confirm({ title: `Удалить роль «${nm}»?`, ok: "Удалить роль", tone: "danger" }))) return
    try {
        await axiosInstance.delete(`/roles/${props.id}`)
    } catch (e) {
        return toast({ type: "error", title: "Не удалось удалить роль", text: errText(e, "Ошибка сервера") })
    }
    queryClient.invalidateQueries({ queryKey: ["roles"] })
    toast({ type: "info", title: "Роль удалена", text: nm })
    done()
}
const beforeClose = async () => !dirty.value || !!(await confirm({ title: "Закрыть без сохранения?", ok: "Закрыть", cancel: "Остаться", tone: "danger" }))
const used = computed(() => assigned.value.length)
</script>

<template>
    <UiSheet v-if="isNew || r" ref="sheet" :title="isNew ? 'Новая роль' : `Роль «${r.name}»`" :sub="sub" size="lg" cls="ov--role" :before-close="beforeClose" @close="toList">
        <div class="roleed">
            <UiBanner v-if="sys" tone="neutral" icon="lock" title="Системная роль председателя" text="Все права, изменить нельзя" />
            <UiBanner v-else-if="ro" tone="neutral" icon="eye" title="Только просмотр" />
            <UiField :model-value="name" label="Название роли" name="rname" :error="err" required :readonly="ro" maxlength="60" autocomplete="off" @update:model-value="(name = $event), (dirty = true), (err = '')" />
            <RoleMenu v-if="sys" :model-value="menu" :ctx="ctx" :readonly="menuRo" @update:model-value="setMenu" />
            <div class="roleed__bar">
                <div class="roleed__sum">
                    <b>{{ sel.size }}</b
                    ><span>из {{ ALL.length }} прав</span><span class="bar"><i :style="{ width: (sel.size / ALL.length) * 100 + '%' }"></i></span>
                </div>
                <label class="msearch__f roleed__q"><UiIcon name="search" /><input v-model="q" type="search" name="q" placeholder="Найти право" aria-label="Найти право" autocomplete="off" /></label>
            </div>
            <div class="pgroups">
                <section v-for="g in groups" :key="g.title" class="pgroup">
                    <header class="pgroup__h">
                        <label class="check pgroup__all" :class="{ 'is-disabled': ro }"
                            ><input type="checkbox" :checked="g.on === g.list.length" :indeterminate="g.on > 0 && g.on < g.list.length" :disabled="ro" :aria-label="`Все права группы «${g.title}»`" @change="setGroup(g, $event.target.checked)" /><span
                                class="check__box"
                                aria-hidden="true"
                                ><UiIcon name="check" :size="16" /></span
                        ></label>
                        <span class="pgroup__i"><UiIcon :name="g.icon" :size="18" /></span>
                        <h4>{{ g.title }}</h4>
                        <span class="pgroup__n">{{ g.on }} из {{ g.list.length }}</span>
                    </header>
                    <div class="pgroup__list">
                        <label v-for="p in g.vis" :key="p[0]" class="perm" :class="{ 'is-disabled': ro, 'is-changed': orig.includes(p[0]) !== sel.has(p[0]) }"
                            ><input type="checkbox" :checked="sel.has(p[0])" :disabled="ro" @change="setPerm(p[0], $event.target.checked)" /><span class="check__box" aria-hidden="true"><UiIcon name="check" :size="16" /></span
                            ><span class="perm__t"
                                ><b>{{ p[1] }}</b
                                ><small>{{ p[2] }}</small></span
                            ></label
                        >
                    </div>
                </section>
                <p v-if="!groups.length" class="muted">Нет прав по запросу «{{ q.trim() }}»</p>
            </div>
            <RoleMenu v-if="!sys" :model-value="menu" :ctx="ctx" :readonly="menuRo" @update:model-value="setMenu" />
        </div>
        <template #footer="{ close }">
            <template v-if="sys">
                <UiBtn label="Закрыть" kind="secondary" size="lg" @click="close()" />
                <UiBtn v-if="!menuRo" label="Сохранить меню" icon="check" size="lg" :disabled="!dirty" :loading="saving" @click="save" />
            </template>
            <UiBtn v-else-if="ro" label="Закрыть" kind="secondary" size="lg" @click="close()" />
            <template v-else>
                <UiBtn
                    v-if="!isNew && can('delete_roles')"
                    label="Удалить"
                    icon="trash"
                    kind="danger-ghost"
                    size="lg"
                    :disabled="used > 0"
                    :title="used ? `Роль назначена ${used} ${plural(used, ['человеку', 'людям', 'людям'])} — сначала смените им роль` : 'Удалить роль'"
                    @click="remove"
                />
                <UiBtn label="Отмена" kind="secondary" size="lg" @click="close()" />
                <UiBtn :label="isNew ? 'Создать роль' : changed ? `Сохранить · ${changed}` : 'Сохранить'" icon="check" size="lg" :loading="saving" @click="save" />
            </template>
        </template>
    </UiSheet>
</template>
