<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { homePath } from "@/domain/nav"
import { num, time } from "@/domain/format"
import { authService } from "@/service/auth/auth.service"
import axiosInstance from "@/service/axios"
import { useActiveOrders, useMsgs, usePurchases } from "@/service/queries"
import { toast, UiBtn, UiCheck, UiEmpty, UiError, UiField, UiIcon, UiPage, UiPayBlock, UiSheet, UiSk, UiSwitch } from "@/ui"
import { useQueryClient } from "@tanstack/vue-query"
import { computed, reactive, ref, watch, watchEffect } from "vue"
import { useRouter } from "vue-router"
import { adminHome, errText, settingsEmpty } from "./admin"
import AdminTabs from "./AdminTabs.vue"

const queryClient = useQueryClient()
const { user, can, isSys, isStaff, plain } = useSession()
const { data: msgs, isPending, isError, refetch } = useMsgs()
const { data: orders } = useActiveOrders()
const { data: purchases } = usePurchases()

// Поле доступно ровно тогда, когда сервер примет сохранение: реквизиты и «Получение» — по праву, цель склада, экспорт и импорт — ещё и «Служащему».
const canMsg = computed(() => can("view-messages"))
const editPay = computed(() => can("edit-payment-message"))
const editRcv = computed(() => can("edit-received-message"))
const canExp = computed(() => isStaff.value && can("export-database"))
const canImp = computed(() => isStaff.value && can("import-database"))
const nothing = computed(() => settingsEmpty(plain.value))
// Из настроек видна только вкладка lit-na.ru — сразу туда (раздел открывается с пользователей, оттуда — сюда).
const router = useRouter()
watchEffect(() => adminHome(plain.value) === "admin-litna" && router.replace({ name: "admin-litna" }))

const KEYS = ["paymentCard", "paymentPhone", "paymentHolder", "paymentMessage", "receivedMessage"]
const d = reactive({ paymentCard: "", paymentPhone: "", paymentHolder: "", paymentMessage: "", receivedMessage: "", goal: "", invDocs: false })
// Настройки обновляются (свои сохранения, realtime, таймер) — поле, в котором сейчас курсор, не перетирается.
watch(
    msgs,
    (m) => {
        const busy = document.activeElement?.name
        for (const k of KEYS) if (busy !== k) d[k] = m?.[k] || ""
        if (busy !== "goal") d.goal = m?.targetWarehouseValue ? num(m.targetWarehouseValue) : ""
        d.invDocs = m?.allowInventoryWithOpenDocs === true
    },
    { immediate: true }
)
const pay = computed(() => ({ paymentCard: d.paymentCard.trim(), paymentPhone: d.paymentPhone.trim(), paymentHolder: d.paymentHolder.trim(), paymentMessage: d.paymentMessage }))

/* ---------- Автосохранение: при уходе из поля, как раньше; знак — «Всё сохранено» в шапке ---------- */
const saved = reactive({ st: "idle", at: null })
async function put(url, body, fail) {
    saved.st = "saving"
    try {
        await axiosInstance.put(url, body)
        Object.assign(saved, { st: "saved", at: Date.now() })
        queryClient.invalidateQueries({ queryKey: ["msgs"] })
        return true
    } catch (e) {
        saved.st = "error"
        toast({ type: "error", title: "Ошибка", text: errText(e, fail) })
        return false
    }
}
const savePay = () => put("/database/msg/payment", pay.value, "Нет прав на изменение сообщения об оплате")
const saveRcv = () => put("/database/msg/received", { receivedMessage: d.receivedMessage }, "Нет прав на изменение сообщения о получении")
const saveGoal = () => put("/database/msg/target-warehouse-value", { targetWarehouseValue: Number(d.goal.replace(/\D/g, "")) || 0 }, "Не удалось сохранить цель склада")
async function saveInvDocs(v) {
    d.invDocs = v
    if (await put("/database/msg/inventory-open-docs", { allowInventoryWithOpenDocs: v }, "Не удалось сохранить настройку")) toast({ type: "info", title: "Настройка инвентаризации сохранена", timeout: 2600 })
    else d.invDocs = msgs.value?.allowInventoryWithOpenDocs === true
}
const goalInput = (v) => {
    const n = v.replace(/\D/g, "")
    d.goal = n ? num(+n) : ""
}
const openDocs = computed(() => ({ orders: (orders.value || []).filter((o) => !o.isCompleted).length, purchases: (purchases.value || []).filter((p) => !p.isCompleted).length }))

/* ---------- База данных ---------- */
const exporting = ref(false)
async function exportDb() {
    exporting.value = true
    try {
        // Файлом, без разбора JSON: в дампе картинки, на телефоне лишняя копия в памяти ни к чему.
        const res = await axiosInstance.get("/database/export/company", { responseType: "blob" })
        const url = URL.createObjectURL(res.data)
        const a = document.createElement("a")
        a.href = url
        a.download = "db.json"
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast({ type: "success", title: "Экспорт готов", text: "db.json" })
    } catch (e) {
        let text = e?.message
        try {
            text = JSON.parse(await e.response.data.text()).message || text
        } catch {
            // ответ не JSON — остаётся текст ошибки запроса
        }
        toast({ type: "error", title: "Ошибка", text: text || "Не удалось выгрузить базу" })
    } finally {
        exporting.value = false
    }
}
const file = ref(null)
const impOk = ref(false)
const importing = ref(false)
function pickFile(ev) {
    file.value = ev.target.files?.[0] || null
    ev.target.value = ""
    impOk.value = false
}
async function importDb() {
    const form = new FormData()
    form.append("file", file.value)
    importing.value = true
    try {
        await axiosInstance.post("/database/import/company", form, { headers: { "Content-Type": "multipart/form-data" } })
    } catch (e) {
        importing.value = false
        return toast({ type: "error", title: "Импорт не выполнен", text: errText(e, "Не удалось загрузить базу") })
    }
    // Данные заменены, пользователи и токены — новые: выход на экран входа, как раньше.
    authService.logout()
}
</script>

<template>
    <UiPage title="Админка" :sub="user?.companyName || ''">
        <template #actions>
            <span class="saved" :class="'saved--' + saved.st" role="status" aria-live="polite">
                <template v-if="saved.st === 'saving'"><span class="spin" aria-hidden="true"></span>Сохраняем…</template>
                <template v-else-if="saved.st === 'error'"><UiIcon name="alert" :size="16" />Не сохранилось</template>
                <template v-else-if="saved.st === 'saved'"><UiIcon name="check" :size="16" />Сохранено · {{ time(saved.at) }}</template>
                <template v-else><UiIcon name="check" :size="16" />Всё сохранено</template>
            </span>
        </template>
        <AdminTabs cur="settings" />

        <div v-if="nothing" class="card">
            <UiEmpty art="error" title="Нет доступа"><UiBtn label="На главную" icon="home" :to="homePath(plain)" /></UiEmpty>
        </div>
        <div v-else-if="canMsg && isError && !msgs" class="card card--pad"><UiError title="Не удалось загрузить «Настройки»" @retry="refetch()" /></div>
        <template v-else-if="canMsg && isPending">
            <p class="loading-note" role="status"><span class="spin"></span>Загружаем…</p>
            <div class="sets" aria-busy="true">
                <div class="card sset sset--wide"><UiSk w="40%" :h="22" /><UiSk :h="160" :r="12" /></div>
                <div class="card sset"><UiSk w="50%" :h="22" /><UiSk :h="96" :r="12" /></div>
                <div class="card sset"><UiSk w="50%" :h="22" /><UiSk :h="96" :r="12" /></div>
            </div>
        </template>
        <div v-else class="sets">
            <section v-if="canMsg" id="set-pay" class="card sset" :class="{ 'is-ro': !editPay }">
                <header class="sset__h">
                    <span class="sset__i"><UiIcon name="wallet" :size="22" /></span>
                    <div><h2>Сообщение об оплате</h2></div>
                </header>
                <div class="sset__2">
                    <div class="payform">
                        <UiField v-model="d.paymentCard" label="Номер карты" name="paymentCard" placeholder="0000 0000 0000 0000" inputmode="numeric" icon="card" :readonly="!editPay" autocomplete="off" maxlength="23" @change="savePay" />
                        <UiField v-model="d.paymentPhone" label="Номер телефона" name="paymentPhone" placeholder="Как удобно: +7…, 8…" inputmode="tel" icon="phone" :readonly="!editPay" autocomplete="off" maxlength="24" @change="savePay" />
                        <UiField v-model="d.paymentHolder" label="Получатель" name="paymentHolder" placeholder="Имя Отчество Ф." icon="user" :readonly="!editPay" autocomplete="off" maxlength="60" @change="savePay" />
                        <UiField v-model="d.paymentMessage" label="Сообщение" name="paymentMessage" :rows="3" :hint="editPay ? '' : 'Нет права менять'" :readonly="!editPay" maxlength="2000" @change="savePay" />
                    </div>
                    <div class="preview">
                        <span class="preview__l"><UiIcon name="phone" :size="16" />Так увидит группа</span>
                        <UiPayBlock :amount="1250" :pay="pay" />
                    </div>
                </div>
            </section>
            <section v-if="canMsg" id="set-rcv" class="card sset" :class="{ 'is-ro': !editRcv, 'sset--wide': !isStaff }">
                <header class="sset__h">
                    <span class="sset__i"><UiIcon name="pin" :size="22" /></span>
                    <div><h2>Сообщение о получении</h2></div>
                </header>
                <UiField v-model="d.receivedMessage" label="Текст «Получение»" name="receivedMessage" :rows="3" :hint="editRcv ? '' : 'Нет права менять'" :readonly="!editRcv" maxlength="2000" @change="saveRcv" />
            </section>
            <section v-if="isStaff" id="set-store" class="card sset" :class="{ 'sset--wide': !canMsg }">
                <header class="sset__h">
                    <span class="sset__i"><UiIcon name="box" :size="22" /></span>
                    <div><h2>Склад и инвентаризация</h2></div>
                </header>
                <UiField :model-value="d.goal" label="Целевая сумма склада" name="goal" inputmode="numeric" suffix="₽" :readonly="!editPay" autocomplete="off" @update:model-value="goalInput" @change="saveGoal" />
                <!-- Правило инвентаризации меняет и видит только председатель, как в прежней админке. -->
                <UiSwitch
                    v-if="isSys && msgs"
                    :model-value="d.invDocs"
                    label="Инвентаризация при незавершённых заказах и закупках"
                    :hint="`Сейчас незавершённых заказов: ${openDocs.orders}, закупок: ${openDocs.purchases}`"
                    @update:model-value="saveInvDocs"
                />
            </section>
            <section v-if="canExp || canImp" id="set-db" class="card sset sset--wide sset--db">
                <header class="sset__h">
                    <span class="sset__i"><UiIcon name="layers" :size="22" /></span>
                    <div><h2>База данных</h2></div>
                </header>
                <div class="dbacts">
                    <div v-if="canExp" class="dbact">
                        <UiIcon name="download" :size="22" />
                        <div><b>Экспорт</b><small>Файл db.json</small></div>
                        <UiBtn label="Скачать" kind="secondary" :loading="exporting" @click="exportDb" />
                    </div>
                    <div v-if="canImp" class="dbact dbact--danger">
                        <UiIcon name="alert" :size="22" />
                        <div><b>Импорт</b><small>Заменит все данные</small></div>
                        <label class="btn btn--danger-ghost btn--md"><span class="btn__l">Выбрать файл</span><input type="file" accept=".json,application/json" class="sr" @change="pickFile" /></label>
                    </div>
                </div>
            </section>
        </div>
    </UiPage>

    <UiSheet v-if="file" label="Импорт базы данных" size="sm" cls="ov--confirm" :before-close="() => !importing" @close="file = null">
        <div class="confirm confirm--danger">
            <span class="confirm__i"><UiIcon name="alert" :size="26" /></span>
            <div class="confirm__t">
                <h3>Заменить все данные компании?</h3>
                <p>Товары, заказы, закупки, инвентаризации, пользователи и история будут заменены содержимым файла. Отменить импорт нельзя — сначала скачайте экспорт.</p>
            </div>
        </div>
        <div class="filechip">
            <UiIcon name="doc" :size="22" /><span
                ><b>{{ file.name }}</b
                ><small>{{ file.size ? Math.max(1, Math.round(file.size / 1024)) + " КБ" : "файл выбран" }}</small></span
            >
        </div>
        <UiCheck v-model="impOk" label="Понимаю: текущие данные пропадут, все пользователи выйдут" />
        <template #footer="{ close }">
            <UiBtn label="Отмена" kind="secondary" size="lg" :disabled="importing" @click="close()" />
            <UiBtn :label="importing ? 'Загружаем…' : 'Импортировать'" icon="install" kind="danger" size="lg" :disabled="!impOk" :loading="importing" @click="importDb" />
        </template>
    </UiSheet>
</template>
