<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { money } from "@/domain/format"
import { homePath } from "@/domain/nav"
import axiosInstance from "@/service/axios"
import { putLitnaAccount, useLitnaAccount, useLitnaCatalog, useProducts } from "@/service/queries"
import { confirm, toast, UiBanner, UiBtn, UiChip, UiCover, UiEmpty, UiError, UiField, UiIcon, UiIconBtn, UiLazy, UiPage, UiSheet, UiSk, UiSkRow } from "@/ui"
import { accountBody, ACCOUNT_FIELDS, DELIVERY, KIND, LINK_F, linkMap, linkRows, search, siteStock, withKind } from "@/views/purchases/litna"
import LitnaLogin from "@/views/purchases/LitnaLogin.vue"
import LitnaSiteSheet from "@/views/purchases/LitnaSiteSheet.vue"
import { useQuery, useQueryClient } from "@tanstack/vue-query"
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue"
import { errText } from "./admin"
import AdminTabs from "./AdminTabs.vue"

// Аккаунт местности на lit-na.ru (вход, получатель, доставка) и привязка наших товаров к товарам сайта (litnaId товара).
const qc = useQueryClient()
const { user, can, plain } = useSession()
const allowed = computed(() => can("create_purchases") || can("edit_purchases"))
const DOTS = "••••••••"
const { data: acc, isPending, isError, refetch } = useLitnaAccount()
const { data: products } = useProducts()
const HALF_HOUR = 1000 * 60 * 30
const { data: cat, isPending: catWait, isError: catErr, refetch: catRetry } = useLitnaCatalog({ on: allowed })

/* ---------- Аккаунт: форма заполняется с сервера, пока в ней нет несохранённого ---------- */
const d = reactive({ ...Object.fromEntries(ACCOUNT_FIELDS.map((k) => [k, ""])), delivery: { kind: "" } })
const body = () => accountBody(d)
const saved = ref(JSON.stringify(body()))
const dirty = computed(() => JSON.stringify(body()) !== saved.value)
// Адрес выбранного пункта: совпал с ним — адрес не «вписан руками». У уже ручного адреса неизвестен до нового выбора пункта.
let pointAddress = ""
function fill(a) {
    for (const k of ACCOUNT_FIELDS) d[k] = a[k] || ""
    d.delivery = { kind: "", ...a.delivery }
    pointAddress = a.delivery?.manual ? "" : d.address
    saved.value = JSON.stringify(body())
}
watch(acc, (a) => a && !dirty.value && fill(a), { immediate: true })

/* ---------- Сверка с кабинетом сайта: адрес могли поменять на сайте. Отличается — плашка, «Сохранить» активна (запишет наш адрес на сайт) ---------- */
const differs = ref(null) // { name, phone, email, address } с сайта или true (сайт не принял запись)
const unsaved = computed(() => dirty.value || !!differs.value)
let comparing = null
// две сверки сразу (вход и смена аккаунта в одном тике) на сайт не уходят
const compare = () => (comparing ??= compareNow().finally(() => (comparing = null)))
async function compareNow() {
    if (!acc.value?.login || !allowed.value) return (differs.value = null)
    try {
        const r = (await axiosInstance.get("/litna/account/address")).data
        if (r.same !== null) differs.value = r.same ? null : r.site || true
    } catch {
        /* сайт не ответил — сверка не состоялась, плашки нет */
    }
}
watch(() => acc.value?.login, compare, { immediate: true })
const siteLine = computed(() => (differs.value && differs.value !== true ? [differs.value.name, differs.value.phone, differs.value.email, differs.value.address].filter(Boolean).join(" · ") : ""))

const busy = ref("")
async function save() {
    busy.value = "save"
    // сохранённым считается отправленное: набранное во время запроса остаётся несохранённой правкой
    const sent = body()
    let site
    try {
        site = (await axiosInstance.put("/litna/account", sent)).data?.site
    } catch (e) {
        return toast({ type: "error", title: "Не сохранилось", text: errText(e, "Не удалось сохранить аккаунт") })
    } finally {
        busy.value = ""
    }
    saved.value = JSON.stringify(sent)
    qc.invalidateQueries({ queryKey: ["litna", "account"] })
    // site: адрес записан и в кабинет lit-na.ru; false — не записан: плашка «отличается» остаётся, «Сохранить» активна
    differs.value = site === false ? differs.value || true : null
    toast({ type: "success", title: "Аккаунт сохранён" })
}

/* ---------- Вход на сайт: по умолчанию гость; вход — общей формой (почта и пароль сайта), пароль у нас не показывается никак ---------- */
const lg = reactive({ open: false, failed: false })
const loginBad = computed(() => !!acc.value?.loginFailed || lg.failed)
// При входе получатель и адрес берутся из кабинета сайта — форма заполняется ими, даже если в ней было несохранённое
function loginOk(a) {
    Object.assign(lg, { open: false, failed: false })
    if (a) fill(a)
    compare()
    toast({ type: "success", title: "Вход выполнен" })
}
async function logout() {
    if (!(await confirm({ title: "Выйти из аккаунта lit-na.ru?", ok: "Выйти" }))) return
    busy.value = "logout"
    try {
        putLitnaAccount((await axiosInstance.post("/litna/account/logout", {})).data)
        lg.failed = false
    } catch (e) {
        toast({ type: "error", title: "Не удалось выйти", text: errText(e) })
    } finally {
        busy.value = ""
    }
}

/* ---------- Пункт выдачи: сначала город (запрос — через 1,2 с после последней буквы или по Enter), потом поиск по адресу среди загруженных.
   В delivery.title — name пункта (его ждёт сайт); адрес аккаунта = адрес пункта, пока его не поправили руками (delivery.manual):
   бесплатную доставку магазин везёт не в пункт, а по адресу ---------- */
const pvz = computed(() => !!KIND[d.delivery.kind]?.pvz)
const pts = reactive({ open: false, q: "", cityQ: "", city: "" })
// Окно закрыто — фоном грузятся пункты сохранённого города: к нажатию «Изменить» список уже готов (тот же ключ и кэш).
const ptsCity = computed(() => (pts.open ? pts.city : pvz.value ? d.delivery.city || "" : ""))
const {
    data: points,
    isPending: ptsWait,
    isFetching: ptsFetching,
    isError: ptsErr,
    refetch: ptsRetry
} = useQuery({
    // Ключ — город: ответ для прежнего города ложится в свой ключ и новый не подменяет; ушедший запрос отменяется (signal).
    // Первая за сутки загрузка пунктов Яндекса идёт около 35 с — свой таймаут с запасом, чтобы общий его не оборвал.
    queryKey: ["litna", "points", computed(() => KIND[d.delivery.kind]?.svc), ptsCity],
    queryFn: ({ queryKey: [, , kind, city], signal }) => axiosInstance.get("/litna/points", { params: { kind, city }, signal, timeout: 120_000 }),
    select: (r) => r.data || [],
    staleTime: HALF_HOUR,
    refetchOnWindowFocus: false,
    enabled: computed(() => allowed.value && !!ptsCity.value)
})
const pointList = computed(() => search(points.value || [], pts.q, (p) => `${p.name} ${p.address}`))
// Дольше 10 с — ещё строка «Это может занять время».
const ptsSlow = ref(false)
let slowTimer = 0
watch(ptsFetching, (on) => {
    clearTimeout(slowTimer)
    ptsSlow.value = false
    if (on) slowTimer = setTimeout(() => (ptsSlow.value = true), 10_000)
})
function openPoints() {
    pts.q = ""
    pts.cityQ = pts.city = d.delivery.city || ""
    pts.open = true
    // загрузка заранее могла не удаться — при открытии окна пробуем ещё раз, а не показываем старую ошибку
    if (ptsErr.value) ptsRetry()
}
let cityTimer = 0
onBeforeUnmount(() => (clearTimeout(cityTimer), clearTimeout(slowTimer)))
function cityInput(v) {
    pts.cityQ = v
    clearTimeout(cityTimer)
    cityTimer = setTimeout(cityGo, 1200)
}
function cityGo() {
    clearTimeout(cityTimer)
    pts.city = pts.cityQ.trim()
}
// Вписанный руками адрес выбор пункта не затирает
function pickPoint(p, close) {
    const keep = !!d.delivery.manual && !!d.address.trim()
    d.delivery = { kind: d.delivery.kind, code: p.code, title: p.name, city: p.city || pts.city, ...(keep && { manual: true }) }
    if (!keep) d.address = p.address
    pointAddress = p.address
    close()
}
function typeAddress(v) {
    d.address = v
    if (!pvz.value) return
    const dl = { ...d.delivery, manual: !!v.trim() && v.trim() !== pointAddress.trim() }
    if (!dl.manual) delete dl.manual
    d.delivery = dl
}
function setKind(kind) {
    const next = withKind(d.delivery, d.address, kind)
    d.delivery = next.delivery
    d.address = next.address
}

/* ---------- Привязка товаров: litnaId товаров и подсказки сайта. Каждая привязка сохраняется сразу из окна выбора;
   подсказка сама не сохраняется — в окне она выбрана заранее, человек подтверждает «Привязать» ---------- */
const siteById = computed(() => new Map((cat.value?.items || []).map((s) => [String(s.id), s])))
const map = computed(() => linkMap(products.value, cat.value?.suggest))
const rows = computed(() => linkRows(products.value || [], map.value, siteById.value))
const lf = ref("all")
const lq = ref("")
const linkList = computed(() => search(rows.value.filter(LINK_F[lf.value]), lq.value, (r) => `${r.p.name} ${r.site?.name || ""} ${r.site?.sku || ""}`))
const count = (f) => rows.value.filter(LINK_F[f]).length
const guesses = computed(() => count("guess"))

const pick = ref(null) // строка, для которой открыт выбор товара сайта
const linking = reactive(new Set()) // товары, чья привязка сохраняется
async function choose(siteId) {
    const product = pick.value._id
    linking.add(product)
    try {
        await axiosInstance.put("/litna/links", { links: [{ product, siteId }] })
        await qc.invalidateQueries({ queryKey: ["products"] })
    } catch (e) {
        toast({ type: "error", title: "Не сохранилось", text: errText(e, "Не удалось сохранить привязку") })
    } finally {
        linking.delete(product)
    }
}
</script>

<template>
    <UiPage title="Админка" :sub="user?.companyName || ''" :cls="unsaved ? 'has-abar' : ''">
        <AdminTabs cur="litna" />

        <!-- Без права создавать или править закупки данные аккаунта не показываются и с сервера не приходят: на их месте точки. -->
        <div v-if="!allowed" class="sets">
            <div style="display: grid; gap: inherit; grid-template-rows: auto 1fr">
                <section class="card sset sset--masked is-ro">
                    <header class="sset__h">
                        <span class="sset__i"><UiIcon name="lock" :size="22" /></span>
                        <div><h2>Аккаунт</h2></div>
                    </header>
                    <UiField :model-value="DOTS" label="Email" readonly />
                </section>
                <section class="card sset sset--masked is-ro">
                    <header class="sset__h">
                        <span class="sset__i"><UiIcon name="user" :size="22" /></span>
                        <div><h2>Получатель</h2></div>
                    </header>
                    <div class="pform__row pform__row--stack">
                        <UiField :model-value="DOTS" label="Имя" readonly />
                        <UiField :model-value="DOTS" label="Фамилия" readonly />
                    </div>
                    <div class="pform__row pform__row--stack">
                        <UiField :model-value="DOTS" label="Телефон" readonly />
                        <UiField :model-value="DOTS" label="Email" readonly />
                    </div>
                </section>
            </div>
            <section class="card sset sset--masked is-ro">
                <header class="sset__h">
                    <span class="sset__i"><UiIcon name="truck" :size="22" /></span>
                    <div><h2>Доставка</h2></div>
                </header>
                <UiField :model-value="DOTS" label="Адрес" readonly />
            </section>
        </div>
        <div v-else-if="isError && !acc" class="card card--pad"><UiError title="Не удалось загрузить «Аккаунт lit-na.ru»" @retry="refetch()" /></div>
        <template v-else-if="isPending">
            <p class="loading-note" role="status"><span class="spin"></span>Загружаем…</p>
            <div class="sets" aria-busy="true">
                <div v-for="i in 4" :key="i" class="card sset"><UiSk w="50%" :h="22" /><UiSk :h="96" :r="12" /></div>
            </div>
        </template>
        <template v-else>
            <UiBanner v-if="differs" tone="warning" title="Адрес в приложении и на сайте отличается" :text="siteLine && 'На сайте: ' + siteLine" style="margin-bottom: var(--sp-6)" />
            <!-- На компьютере две колонки одной высоты: слева вход и получатель, справа доставка. -->
            <div class="sets">
                <div style="display: grid; gap: inherit; grid-template-rows: auto 1fr">
                    <section class="card sset" :style="loginBad ? 'outline: 2px solid var(--danger); outline-offset: -2px' : ''">
                        <header class="sset__h">
                            <span class="sset__i"><UiIcon name="lock" :size="22" /></span>
                            <div><h2>Аккаунт</h2></div>
                        </header>
                        <LitnaLogin v-if="lg.open" :login="acc.login || ''" @done="loginOk" @failed="lg.failed = true">
                            <template #default="{ busy: wait }"><UiBtn label="Отмена" kind="secondary" data-track="Отмена — вход lit-na.ru" :disabled="wait" @click="lg.open = false" /></template>
                        </LitnaLogin>
                        <div v-else class="pickup" style="align-items: center">
                            <span v-if="!acc.login || loginBad" class="copyrow__i" :style="loginBad ? 'color: var(--danger-text)' : ''"><UiIcon :name="loginBad ? 'alert' : 'user'" :size="22" /></span>
                            <p style="flex: 1; min-width: 0; overflow-wrap: anywhere">
                                <template v-if="loginBad"
                                    ><b>Зайдите заново</b><small v-if="acc.login" class="muted" style="display: block">{{ acc.login }}</small></template
                                >
                                <b v-else-if="acc.login">{{ acc.login }}</b>
                                <template v-else>Гость</template>
                            </p>
                            <UiBtn v-if="acc.login && !loginBad" label="Выйти" kind="secondary" data-track="Выйти из lit-na.ru" :loading="busy === 'logout'" @click="logout" />
                            <UiBtn v-else :label="loginBad ? 'Войти' : 'Войти под аккаунтом'" kind="secondary" :data-track="loginBad ? 'Войти заново' : 'Войти под аккаунтом'" @click="lg.open = true" />
                        </div>
                    </section>
                    <section class="card sset">
                        <header class="sset__h">
                            <span class="sset__i"><UiIcon name="user" :size="22" /></span>
                            <div><h2>Получатель</h2></div>
                        </header>
                        <div class="pform__row pform__row--stack">
                            <UiField v-model="d.firstName" label="Имя" name="litna-first" autocomplete="off" />
                            <UiField v-model="d.lastName" label="Фамилия" name="litna-last" autocomplete="off" />
                        </div>
                        <div class="pform__row pform__row--stack">
                            <UiField v-model="d.phone" label="Телефон" type="tel" name="litna-phone" inputmode="tel" autocomplete="off" />
                            <UiField v-model="d.email" label="Email" type="email" name="litna-email" inputmode="email" autocomplete="off" />
                        </div>
                    </section>
                </div>
                <section class="card sset">
                    <header class="sset__h">
                        <span class="sset__i"><UiIcon name="truck" :size="22" /></span>
                        <div><h2>Доставка</h2></div>
                    </header>
                    <div class="rpicks" role="radiogroup" aria-label="Способ доставки">
                        <label v-for="o in DELIVERY" :key="o.value" class="rpick"
                            ><input type="radio" name="litna-delivery" :value="o.value" :checked="d.delivery.kind === o.value" @change="setKind(o.value)" /><span class="rpick__b"
                                ><b>{{ o.label }}</b></span
                            ></label
                        >
                    </div>
                    <div v-if="pvz" style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--sp-4); align-items: end">
                        <UiField :model-value="d.delivery.title || ''" label="Пункт выдачи" name="litna-point" :rows="2" readonly />
                        <UiBtn :label="d.delivery.code ? 'Изменить' : 'Выбрать'" kind="secondary" size="lg" data-track="Выбрать пункт выдачи" @click="openPoints" />
                    </div>
                    <UiField
                        v-if="d.delivery.kind"
                        :model-value="d.address"
                        label="Адрес"
                        name="litna-address"
                        :rows="pvz ? 2 : 0"
                        :hint="pvz ? '' : 'Пример: 410019, Россия, Саратовская область, Саратов, ул. им. Маяковского, д. 1'"
                        autocomplete="off"
                        @update:model-value="typeAddress"
                    />
                </section>
            </div>
            <div class="desk-only" style="margin-top: var(--sp-6); text-align: right">
                <UiBtn label="Сохранить" icon="check" size="lg" :loading="busy === 'save'" :disabled="!unsaved || (!!busy && busy !== 'save')" @click="save" />
            </div>
            <!-- Телефон: несохранённое — кнопка закреплена над нижним меню, пока не сохранят. -->
            <div v-if="unsaved" class="abar">
                <UiBtn label="Сохранить" icon="check" size="lg" style="max-width: none" :loading="busy === 'save'" :disabled="!!busy && busy !== 'save'" @click="save" />
            </div>

            <div class="sec-h">
                <h2>
                    Привязка товаров<small>{{ rows.length }}</small>
                </h2>
            </div>
            <div class="listtools">
                <div class="filterbar" role="group" aria-label="Отбор товаров">
                    <UiChip label="Все" :count="rows.length" :active="lf === 'all'" @click="lf = 'all'" />
                    <UiChip label="Без привязки" tone="accent" :count="count('free')" :active="lf === 'free'" @click="lf = 'free'" />
                    <UiChip v-if="guesses" label="Подсказки" :count="guesses" :active="lf === 'guess'" @click="lf = 'guess'" />
                </div>
                <form class="msearch__f lsearch" role="search" @submit.prevent="$event.target.querySelector('input').blur()">
                    <UiIcon name="search" />
                    <input v-model="lq" type="search" name="q" placeholder="Наш товар или товар сайта" aria-label="Наш товар или товар сайта" autocomplete="off" />
                    <button v-if="lq" type="button" class="msearch__x" aria-label="Очистить поиск" @click="lq = ''"><UiIcon name="x" :size="18" /></button>
                </form>
            </div>
            <div v-if="catErr && !cat" class="card card--pad"><UiError title="Не удалось загрузить каталог lit-na.ru" @retry="catRetry()" /></div>
            <template v-else-if="catWait || !products">
                <p class="loading-note" role="status"><span class="spin"></span>Загружаем каталог lit-na.ru…</p>
                <div class="card tbl tbl--sk"><UiSkRow v-for="i in 6" :key="i" /></div>
            </template>
            <div v-else-if="!linkList.length" class="card">
                <UiEmpty art="search" title="Ничего не нашли"><UiBtn label="Показать все" kind="secondary" @click="(lq = ''), (lf = 'all')" /></UiEmpty>
            </div>
            <div v-else class="card tbl" style="--cols: 48px minmax(0, 1fr) 52px">
                <UiLazy v-slot="{ item: r }" :items="linkList" :size="30" :reset-key="lf + '~' + lq">
                    <div class="trow" :class="{ 'is-new': r.guess, 'is-short': r.siteId == null }">
                        <span class="trow__cov"><UiCover :product="r.p" size="sm" /></span>
                        <div class="trow__main">
                            <span class="trow__n"
                                >{{ r.p.name }}<template v-if="r.guess"> <span class="tag tag--warning" style="margin-left: var(--sp-3)">подсказка</span></template></span
                            >
                            <span v-if="r.site" class="trow__m">{{ r.site.name }} · {{ money(r.site.price) }} · {{ siteStock(r.site) }}</span>
                            <span v-else class="trow__warn"><UiIcon name="alert" :size="16" />{{ r.siteId == null ? "нет привязки" : "нет на сайте" }}</span>
                        </div>
                        <div class="trow__ctl"></div>
                        <span class="trow__side"><span v-if="linking.has(r._id)" class="spin" role="status" aria-label="Сохраняем"></span><UiIconBtn v-else icon="edit" label="Выбрать товар сайта" @click="pick = r" /></span>
                    </div>
                </UiLazy>
            </div>
        </template>
    </UiPage>

    <UiSheet v-if="pts.open" :title="KIND[d.delivery.kind]?.label || 'Пункт выдачи'" size="lg" @close="pts.open = false">
        <template #default="{ close }">
            <form style="margin-bottom: var(--sp-5)" @submit.prevent="cityGo">
                <UiField :model-value="pts.cityQ" label="Город" name="litna-point-city" enterkeyhint="search" autocomplete="off" @update:model-value="cityInput" />
            </form>
            <p v-if="!pts.city" class="muted">Укажите город</p>
            <template v-else-if="ptsWait">
                <p class="loading-note" role="status"><span class="spin"></span>Загружаем пункты…</p>
                <p v-if="ptsSlow" class="muted">Это может занять время</p>
                <div aria-hidden="true" style="pointer-events: none">
                    <div v-for="i in 6" :key="i" class="sugg__p">
                        <UiSk w="20px" :h="20" :r="99" /><span class="sugg__n" style="display: grid; gap: var(--sp-3)"><UiSk :w="92 - (i % 3) * 14 + '%'" /><UiSk w="40%" :h="12" /></span>
                    </div>
                </div>
            </template>
            <UiError v-else-if="ptsErr" title="Не удалось загрузить пункты" @retry="ptsRetry()" />
            <p v-else-if="!points?.length" class="muted">В этом городе пунктов нет</p>
            <div v-else>
                <label class="msearch__f" style="margin-bottom: var(--sp-5)"><UiIcon name="search" /><input v-model="pts.q" type="search" name="q" placeholder="Адрес пункта" aria-label="Адрес пункта" autocomplete="off" /></label>
                <UiLazy v-slot="{ item: p }" :items="pointList" :size="30" :reset-key="pts.q">
                    <button type="button" class="sugg__p" data-track="Пункт выдачи" :aria-pressed="p.code === d.delivery.code" @click="pickPoint(p, close)">
                        <UiIcon :name="p.code === d.delivery.code ? 'check' : 'pin'" /><span class="sugg__n"
                            >{{ p.address || p.name }}<small v-if="p.hours">{{ p.hours }}</small></span
                        >
                    </button>
                </UiLazy>
                <p v-if="!pointList.length" class="muted">Ничего не нашли</p>
            </div>
        </template>
    </UiSheet>

    <LitnaSiteSheet v-if="pick" :title="pick.p.name" :items="cat?.items || []" :current="map[pick._id]?.siteId" @pick="choose" @close="pick = null" />
</template>
