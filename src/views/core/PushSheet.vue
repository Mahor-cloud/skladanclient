<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { usePush } from "@/composables/usePush"
import { useSession } from "@/composables/useSession"
import { toast, UiBtn, UiSheet, UiSwitch } from "@/ui"
import { computed, onMounted, reactive, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { pushCats, pushSummary } from "./push"

// «О чём сообщать» (?sheet=push): второй шаг включения уведомлений и правка категорий уже подписанного браузера.
const route = useRoute()
const router = useRouter()
const { plain } = useSession()
const push = usePush()
const on = push.subscribed
const d = reactive({ ...push.prefs })
onMounted(async () => {
    await push.refresh()
    Object.assign(d, push.prefs)
})
const cats = computed(() => pushCats(plain.value))
const picked = computed(() => cats.value.filter(([k]) => d[k]).length)
const busy = ref(false)
const toProfile = () => router.replace({ path: route.path, query: { ...route.query, sheet: "profile" } })

function toggle(key, value) {
    d[key] = value
    if (key === "orders" && !value) d.ordersOwnOnly = false
}
async function save() {
    busy.value = true
    const was = on.value
    const ok = was ? await push.save({ ...d }) : await push.subscribe({ ...d })
    busy.value = false
    if (!ok) return
    toProfile()
    toast({ type: "success", title: was ? "Уведомления обновлены" : "Уведомления включены", text: "Сообщаем: " + pushSummary(plain.value, d) })
}
async function off() {
    busy.value = true
    const ok = await push.disable()
    busy.value = false
    if (!ok) return
    toProfile()
    toast({ type: "info", title: "Уведомления отключены" })
}
</script>

<template>
    <UiSheet title="О чём сообщать" size="md" cls="ov--push" @close="toProfile">
        <div class="pushwin">
            <div class="pushlist">
                <div v-for="[k, l] in cats" :key="k" class="pushrow">
                    <UiSwitch :model-value="d[k]" :label="l" @update:model-value="toggle(k, $event)" />
                    <div v-if="k === 'orders'" class="pushrow__sub">
                        <UiSwitch :model-value="d.ordersOwnOnly && d.orders" label="Только мои заказы" :hint="d.orders ? '' : 'Сначала включите «Заказы»'" :disabled="!d.orders" @update:model-value="toggle('ordersOwnOnly', $event)" />
                    </div>
                </div>
            </div>
        </div>
        <template #footer>
            <UiBtn v-if="on" label="Отключить всё" kind="danger-ghost" size="lg" :disabled="busy" @click="off" />
            <UiBtn v-else label="Не сейчас" kind="secondary" size="lg" @click="toProfile" />
            <UiBtn :label="busy && !on ? 'Ждём разрешения…' : on ? 'Сохранить' : 'Включить'" :icon="on ? 'check' : 'bolt'" size="lg" :disabled="!picked" :loading="busy" @click="save" />
        </template>
    </UiSheet>
</template>
