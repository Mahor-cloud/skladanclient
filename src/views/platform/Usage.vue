<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { num, plural } from "@/domain/format"
import { PERMS } from "@/domain/perms"
import axiosInstance from "@/service/axios"
import { UiBtn, UiChip, UiEmpty, UiError, UiIcon, UiPage, UiSeg, UiSelect, UiSk } from "@/ui"
import { keepPreviousData, useQuery } from "@tanstack/vue-query"
import { computed, reactive } from "vue"
import StatCols from "../statistics/StatCols.vue"
import { dm, dur, fillDays, fillMonths, monthStart, mskDay, my, rolesLine } from "./usage"

// Использование интерфейса: что нажимают и сколько времени проводят на экранах. Данные копит счётчик service/usage.js.
const f = reactive({ days: 30, company: "", role: "", perm: "", device: "", user: "", userName: "", screen: "", sort: "ms", more: {} })
// Код права → его название из общего каталога прав
const PERM = Object.fromEntries(PERMS.flatMap(([, , list]) => list.map(([code, label]) => [code, label])))
// days: 0 — всё время (от первой записи); 90 и 365 — три и двенадцать календарных месяцев, считая нынешний
const MONTHS = { 90: 3, 365: 12 }
const params = computed(() => ({
    ...(!f.days ? { all: 1 } : { from: MONTHS[f.days] ? monthStart(MONTHS[f.days] - 1) : mskDay(f.days - 1), to: mskDay() }),
    company: f.company || undefined,
    role: f.role || undefined,
    perm: f.perm || undefined,
    device: f.device || undefined,
    user: f.user || undefined
}))
const { data, isPending, isError, isPlaceholderData, refetch } = useQuery({
    queryKey: ["usage", params],
    queryFn: async () => (await axiosInstance.get("/usage", { params: params.value })).data,
    placeholderData: keepPreviousData,
    staleTime: 60_000
})

// 7 и 30 дней считаются по дням; от трёх месяцев — целыми месяцами по готовым итогам (так решает сервер: data.by)
const PERIODS = [
    { value: 7, label: "7 дн." },
    { value: 30, label: "30 дн." },
    { value: 90, label: "3 мес." },
    { value: 365, label: "Год" },
    { value: 0, label: "Всё" }
]
const DEVICES = [
    { value: "", label: "Все" },
    { value: "phone", label: "Телефон" },
    { value: "desktop", label: "Большой экран" }
]
const SORTS = [
    { value: "ms", label: "Время" },
    { value: "avg", label: "На заход" },
    { value: "visits", label: "Заходы" }
]
const companies = computed(() => [{ value: "", label: "Все местности" }, ...(data.value?.companies || []).map((c) => ({ value: c._id, label: c.name }))])
const companyName = (id) => data.value?.companies.find((c) => c._id === id)?.name || ""
const roleOptions = computed(() => [{ value: "", label: "Все роли" }, ...(data.value?.roles || []).map((r) => ({ value: r.role || "-", label: r.role || "без роли" }))])

const sum = (list, key) => (list || []).reduce((s, x) => s + (x[key] || 0), 0)
const byMonth = computed(() => data.value?.by === "month")
const total = computed(() => {
    const d = data.value
    const src = byMonth.value ? d?.months : d?.days
    const ms = sum(src, "ms")
    // сумма «дней с заходом» по людям — пользователе-дни
    const userDays = sum(d?.users, "days")
    return { users: d?.users.length || 0, opens: sum(src, "opens"), clicks: sum(src, "clicks"), ms, perDay: userDays ? ms / userDays : 0 }
})
const byDevice = computed(() => Object.fromEntries((data.value?.devices || []).map((x) => [x.device, x.users])))
const chart = computed(() => {
    const d = data.value
    if (!d) return []
    const tip = (x) => `${x.users} ${plural(x.users, ["пользователь", "пользователя", "пользователей"])}, ${num(x.clicks)} наж., ${dur(x.ms)}`
    return byMonth.value
        ? fillMonths(d.from, d.to, d.months).map((x) => ({ key: x.month, l: my(x.month), v: [x.users], tip: `${my(x.month)}: ${tip(x)}` }))
        : fillDays(d.from, d.to, d.days).map((x) => ({ key: x.day, l: dm(x.day), v: [x.users], tip: `${dm(x.day)}: ${tip(x)}` }))
})

const avg = (s) => (s.visits ? s.ms / s.visits : 0)
const screens = computed(() => [...(data.value?.screens || [])].sort((a, b) => (f.sort === "avg" ? avg(b) - avg(a) : f.sort === "visits" ? b.visits - a.visits : b.ms - a.ms)))
const screenOptions = computed(() => [
    { value: "", label: "Все экраны" },
    ...[...new Set([...(data.value?.screens || []), ...(data.value?.elements || [])].map((e) => e.screen))].sort((a, b) => a.localeCompare(b, "ru")).map((s) => ({ value: s, label: s }))
])
const elements = computed(() => (data.value?.elements || []).filter((e) => !f.screen || e.screen === f.screen))
const KIND = { error: "ошибка", empty: "пусто" }

const cut = (key, list, n = 10) => (f.more[key] ? list : list.slice(0, n))
const pickUser = (u) => Object.assign(f, { user: u.user, userName: u.name || u.login })
const full = (day) => dm(day) + "." + day.slice(0, 4)
const period = computed(() => (!data.value ? "" : byMonth.value ? `${my(data.value.from)} — ${my(data.value.to)}` : `${full(data.value.from)} — ${full(data.value.to)}`))
// «последний раз»: день или, в длинном периоде, месяц
const at = (v) => (v?.length === 7 ? my(v) : dm(v))
</script>

<template>
    <UiPage v-if="isError && !data" title="Использование">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Использование»" @retry="refetch()" /></div>
    </UiPage>
    <UiPage v-else title="Использование" :sub="period">
        <div class="stools">
            <UiSeg v-model="f.days" :options="PERIODS" label="Период" />
            <UiSeg v-model="f.device" :options="DEVICES" label="Устройство" />
        </div>
        <div class="stools__f" style="margin-bottom: var(--sp-6)">
            <UiSelect v-model="f.company" :options="companies" aria-label="Местность" />
            <UiSelect v-model="f.role" :options="roleOptions" aria-label="Роль" />
            <UiChip v-if="f.perm" class="chip--filter" icon="x" :label="'Право: ' + (PERM[f.perm] || f.perm)" @click="f.perm = ''" />
            <UiChip v-if="f.user" class="chip--filter" icon="x" :label="f.userName" @click="(f.user = ''), (f.userName = '')" />
            <UiBtn v-if="f.company || f.role || f.perm || f.device || f.user" label="Сбросить" icon="x" kind="ghost" size="sm" @click="Object.assign(f, { company: '', role: '', perm: '', device: '', user: '', userName: '' })" />
        </div>
        <p v-if="isPlaceholderData" class="loading-note" role="status"><span class="spin"></span>Считаем…</p>

        <div v-if="isPending" class="kpis kpis--3">
            <div v-for="i in 3" :key="i" class="card kpi"><UiSk w="52%" :h="12" /><UiSk w="74%" :h="26" :r="8" /><UiSk w="60%" :h="12" /></div>
        </div>
        <div v-else-if="!total.users" class="card"><UiEmpty art="search" title="За период данных нет" /></div>
        <template v-else>
            <div class="kpis kpis--3 skpis">
                <div class="card kpi kpi--bar kpi--p">
                    <small>Пользователей</small><b>{{ total.users }}</b
                    ><span>телефон {{ byDevice.phone || 0 }} · большой экран {{ byDevice.desktop || 0 }}</span>
                </div>
                <div class="card kpi kpi--bar kpi--t">
                    <small>Время в приложении</small><b>{{ dur(total.ms) }}</b
                    ><span>{{ dur(total.perDay) }} на пользователя в день</span>
                </div>
                <div class="card kpi kpi--bar kpi--s">
                    <small>Нажатий</small><b>{{ num(total.clicks) }}</b
                    ><span>{{ num(total.opens) }} {{ plural(total.opens, ["заход", "захода", "заходов"]) }}</span>
                </div>
            </div>

            <div class="sgrid">
                <section class="card sblk sblk--wide">
                    <header class="sblk__h">
                        <h3>{{ byMonth ? "Пользователи по месяцам" : "Пользователи по дням" }}</h3>
                    </header>
                    <StatCols :groups="chart" :series="[{ name: 'Пользователи', tone: 'primary' }]" sparse :cls="byMonth ? '' : 'cols--days'" :label="byMonth ? 'Пользователи по месяцам' : 'Пользователи по дням'" />
                </section>

                <section class="card sblk sblk--wide">
                    <header class="sblk__h">
                        <h3>Экраны</h3>
                        <div class="sblk__s"><UiSeg v-model="f.sort" :options="SORTS" size="sm" label="Порядок экранов" /></div>
                    </header>
                    <div class="utbl" style="--n: 5">
                        <div class="utbl__h" aria-hidden="true"><span>Экран</span><span>Заходов</span><span>Польз.</span><span>Всего</span><span>Дольше всего</span><span>На заход</span></div>
                        <div v-for="s in cut('s', screens)" :key="s.screen" class="utbl__r">
                            <span class="utbl__n">{{ s.screen }}</span>
                            <span class="utbl__vs"
                                ><span><small>Заходов</small>{{ num(s.visits) }}</span
                                ><span><small>Польз.</small>{{ s.users }}</span
                                ><span><small>Всего</small>{{ dur(s.ms) }}</span
                                ><span><small>Дольше всего</small>{{ dur(s.maxMs) }}</span></span
                            >
                            <b data-l="на заход">{{ dur(avg(s)) }}</b>
                        </div>
                    </div>
                    <button v-if="screens.length > 10" type="button" class="morebtn" @click="f.more.s = !f.more.s">{{ f.more.s ? "Свернуть" : `Показать все ${screens.length}` }}<UiIcon :name="f.more.s ? 'down' : 'right'" :size="16" /></button>
                </section>

                <section class="card sblk sblk--wide">
                    <header class="sblk__h">
                        <h3>Нажатия</h3>
                        <div class="sblk__s"><UiSelect v-model="f.screen" :options="screenOptions" aria-label="Экран" /></div>
                    </header>
                    <div class="utbl" style="--n: 2">
                        <div class="utbl__h" aria-hidden="true"><span>Элемент</span><span>Польз.</span><span>Нажатий</span></div>
                        <div v-for="e in cut('e', elements, 15)" :key="e.screen + '~' + e.label" class="utbl__r">
                            <span class="utbl__n"
                                >{{ e.label }}<small>{{ f.screen ? "" : e.screen + " · " }}{{ rolesLine(e.roles) }}</small></span
                            >
                            <span class="utbl__vs"
                                ><span><small>Польз.</small>{{ e.users }}</span></span
                            >
                            <b data-l="нажатий">{{ num(e.clicks) }}</b>
                        </div>
                        <p v-if="!elements.length" class="muted">Нажатий нет.</p>
                    </div>
                    <button v-if="elements.length > 15" type="button" class="morebtn" @click="f.more.e = !f.more.e">{{ f.more.e ? "Свернуть" : `Показать все ${elements.length}` }}<UiIcon :name="f.more.e ? 'down' : 'right'" :size="16" /></button>
                </section>

                <section class="card sblk sblk--wide">
                    <header class="sblk__h"><h3>Пользователи</h3></header>
                    <div class="utbl" style="--n: 5">
                        <div class="utbl__h" aria-hidden="true"><span>Пользователь</span><span>Последний заход</span><span>Дней</span><span>Заходов</span><span>Нажатий</span><span>Время</span></div>
                        <div v-for="u in cut('u', data.users)" :key="u.user" class="utbl__r">
                            <span class="utbl__n"
                                ><button type="button" @click="pickUser(u)">{{ u.name || u.login || "удалён" }}</button><small>{{ u.role || "без роли" }}{{ f.company ? "" : " · " + companyName(u.company) }}</small></span
                            >
                            <span class="utbl__vs"
                                ><span><small>Последний заход</small>{{ dm(u.lastDay) }}</span
                                ><span><small>Дней</small>{{ u.days }}</span
                                ><span><small>Заходов</small>{{ num(u.opens) }}</span
                                ><span><small>Нажатий</small>{{ num(u.clicks) }}</span></span
                            >
                            <b data-l="время">{{ dur(u.ms) }}</b>
                        </div>
                    </div>
                    <button v-if="data.users.length > 10" type="button" class="morebtn" @click="f.more.u = !f.more.u">{{ f.more.u ? "Свернуть" : `Показать всех ${data.users.length}` }}<UiIcon :name="f.more.u ? 'down' : 'right'" :size="16" /></button>
                </section>

                <section class="card sblk">
                    <header class="sblk__h"><h3>Роли</h3></header>
                    <div class="utbl" style="--n: 3">
                        <div class="utbl__h" aria-hidden="true"><span>Роль</span><span>Польз.</span><span>Нажатий</span><span>Время</span></div>
                        <div v-for="r in data.roles" :key="r.role" class="utbl__r">
                            <span class="utbl__n"
                                ><button type="button" @click="f.role = r.role || '-'">{{ r.role || "без роли" }}</button></span
                            >
                            <span class="utbl__vs"
                                ><span><small>Польз.</small>{{ r.users }}</span
                                ><span><small>Нажатий</small>{{ num(r.clicks) }}</span></span
                            >
                            <b data-l="время">{{ dur(r.ms) }}</b>
                        </div>
                    </div>
                </section>

                <section class="card sblk">
                    <header class="sblk__h"><h3>Права</h3></header>
                    <div class="utbl" style="--n: 4">
                        <div class="utbl__h" aria-hidden="true"><span>Право</span><span>Ролей</span><span>Польз.</span><span>Нажатий</span><span>Время</span></div>
                        <div v-for="x in cut('r', data.perms, 8)" :key="x.perm" class="utbl__r">
                            <span class="utbl__n"
                                ><button type="button" @click="f.perm = x.perm">{{ PERM[x.perm] || x.perm }}</button></span
                            >
                            <span class="utbl__vs"
                                ><span><small>Ролей</small>{{ x.roles }}</span
                                ><span><small>Польз.</small>{{ x.users }}</span
                                ><span><small>Нажатий</small>{{ num(x.clicks) }}</span></span
                            >
                            <b data-l="время">{{ dur(x.ms) }}</b>
                        </div>
                        <p v-if="!data.perms.length" class="muted">Нет данных.</p>
                    </div>
                    <button v-if="data.perms.length > 8" type="button" class="morebtn" @click="f.more.r = !f.more.r">{{ f.more.r ? "Свернуть" : `Показать все ${data.perms.length}` }}<UiIcon :name="f.more.r ? 'down' : 'right'" :size="16" /></button>
                </section>

                <section class="card sblk">
                    <header class="sblk__h"><h3>Ошибки и пустые результаты</h3></header>
                    <div class="utbl" style="--n: 2">
                        <div class="utbl__h" aria-hidden="true"><span>Сообщение</span><span>Польз.</span><span>Раз</span></div>
                        <div v-for="p in cut('p', data.problems, 8)" :key="p.kind + '~' + p.screen + '~' + p.label" class="utbl__r">
                            <span class="utbl__n"
                                >{{ p.label }}<small>{{ p.screen }} · {{ KIND[p.kind] }}</small></span
                            >
                            <span class="utbl__vs"
                                ><span><small>Польз.</small>{{ p.users }}</span></span
                            >
                            <b data-l="раз">{{ num(p.count) }}</b>
                        </div>
                        <p v-if="!data.problems.length" class="muted">Не было.</p>
                    </div>
                    <button v-if="data.problems.length > 8" type="button" class="morebtn" @click="f.more.p = !f.more.p">
                        {{ f.more.p ? "Свернуть" : `Показать все ${data.problems.length}` }}<UiIcon :name="f.more.p ? 'down' : 'right'" :size="16" />
                    </button>
                </section>

                <section class="card sblk sblk--wide">
                    <header class="sblk__h"><h3>Не нажимали за период</h3></header>
                    <div class="utbl" style="--n: 2">
                        <div class="utbl__h" aria-hidden="true"><span>Элемент</span><span>Раньше нажимали</span><span>Последний раз</span></div>
                        <div v-for="e in cut('i', data.idle, 8)" :key="e.screen + '~' + e.label" class="utbl__r">
                            <span class="utbl__n"
                                >{{ e.label }}<small>{{ e.screen }}</small></span
                            >
                            <span class="utbl__vs"
                                ><span><small>Раньше нажимали</small>{{ num(e.before) }}</span></span
                            >
                            <b data-l="последний раз">{{ at(e.lastDay) }}</b>
                        </div>
                        <p v-if="!data.idle.length" class="muted">Таких нет.</p>
                    </div>
                    <button v-if="data.idle.length > 8" type="button" class="morebtn" @click="f.more.i = !f.more.i">{{ f.more.i ? "Свернуть" : `Показать все ${data.idle.length}` }}<UiIcon :name="f.more.i ? 'down' : 'right'" :size="16" /></button>
                </section>
            </div>
        </template>
    </UiPage>
</template>
