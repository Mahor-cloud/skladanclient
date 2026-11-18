<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { money, num, pcs } from "@/domain/format"
import { available, physical } from "@/domain/stock"
import { UiBtn, UiCover, UiIcon, UiStepper } from "@/ui"
import { computed, nextTick, ref } from "vue"
import { needOf, overBy, qtyIn, rcvIn } from "./purchase"

// Строка позиции закупки. Своё количество читает из правок d и отдаёт изменения событием set(поле, id, n):
// при вводе перерисовывается только эта строка, а не весь список. mode: draft | unpaid | receive | done.
const props = defineProps({
    line: { type: Object, required: true },
    mode: { type: String, required: true },
    d: { type: Object, required: true },
    pm: { type: Object, required: true }
})
const emit = defineEmits(["set", "clamped"])
const el = ref(null)

const q = computed(() => qtyIn(props.d, props.line, props.mode))
const rcv = computed(() => rcvIn(props.d, props.line))
const t = computed(() => Number(props.line.p.targetQty) || 0)
const need = computed(() => needOf(props.line.p))
const over = computed(() => overBy(props.line.p, q.value, props.line.q0, props.pm.exceed))
const full = computed(() => rcv.value >= props.line.q0)

async function addFirst() {
    emit("set", "qty", props.line._id, need.value || 1)
    await nextTick()
    el.value?.querySelector(".stepper__v")?.focus({ preventScroll: true })
}
</script>

<template>
    <div v-if="mode === 'draft'" ref="el" class="trow trow--pu" :class="{ 'is-in': q > 0, 'is-over': over && !pm.exceed, 'is-over-ok': over && pm.exceed }">
        <span class="trow__cov"
            ><RouterLink :to="{ name: 'product', params: { id: line._id } }" tabindex="-1" aria-hidden="true"><UiCover :product="line.p" size="sm" /></RouterLink
        ></span>
        <div class="trow__main">
            <span class="trow__n">{{ line.p.name }}</span>
            <span class="trow__m"
                >{{ line.p.category }}<span class="mob"> · склад {{ physical(line.p) }} · доступно {{ available(line.p) }} · цель {{ t || "—" }}</span></span
            >
            <span v-if="over" class="trow__warn" :class="{ 'is-ok': pm.exceed }"
                ><UiIcon :name="pm.exceed ? 'info' : 'alert'" :size="16" />{{ pm.exceed ? `Сверх цели на ${over} — вы можете подтвердить` : `Больше цели на ${over} — нужно подтверждение председателя` }}</span
            >
            <span v-else-if="need && !q" class="trow__hint"><UiIcon name="bolt" :size="14" />до цели не хватает {{ need }}</span>
        </div>
        <span class="trow__c">{{ physical(line.p) }}</span>
        <span class="trow__c"
            ><span :class="{ neg: available(line.p) <= 0 }">{{ available(line.p) }}</span></span
        >
        <span class="trow__c">{{ t || "—" }}</span>
        <div class="trow__ctl">
            <b v-if="!pm.edit" class="qty">{{ q ? pcs(q) : "—" }}</b>
            <UiStepper v-else-if="q > 0" :model-value="q" :label="'В закупку: ' + line.p.name" @update:model-value="emit('set', 'qty', line._id, $event)" />
            <UiBtn v-else kind="secondary" block icon="plus" class="btn--add" :label="need ? `В закупку ${need}` : 'В закупку'" @click="addFirst" />
        </div>
        <span class="trow__side"
            ><b v-if="q">{{ money(line.p.price * q) }}</b
            ><small v-else class="muted">{{ money(line.p.price) }}/шт.</small></span
        >
    </div>

    <div v-else-if="mode === 'unpaid'" class="trow" :class="{ 'is-new': line.added }">
        <span class="trow__cov"><UiCover :product="line.p" size="sm" /></span>
        <div class="trow__main">
            <span class="trow__n"
                >{{ line.p.name }}<template v-if="line.added"> <span class="tag tag--primary">новая</span></template></span
            >
            <span class="trow__m">{{ line.p.category }} · {{ money(line.p.price) }}/шт.</span>
        </div>
        <span class="trow__c">{{ money(line.p.price) }}</span>
        <div class="trow__ctl">
            <UiStepper v-if="line.added" :model-value="q" :label="'Количество: ' + line.p.name" @update:model-value="emit('set', 'added', line._id, $event)" />
            <b v-else class="qty">{{ pcs(q) }}</b>
        </div>
        <span class="trow__side"
            ><b>{{ money(line.p.price * q) }}</b></span
        >
    </div>

    <div v-else-if="mode === 'receive'" class="trow" :class="[full ? 'is-full' : 'is-short', { 'is-locked': line.conf === line.q0 }]">
        <span class="trow__cov"><UiCover :product="line.p" size="sm" /></span>
        <div class="trow__main">
            <span class="trow__n">{{ line.p.name }}</span>
            <span class="trow__m"
                ><span class="mob"
                    >заказано {{ line.q0 }}<template v-if="line.conf"> · принято ранее {{ line.conf }}</template></span
                ><span class="desk">{{ line.p.category }}</span></span
            >
        </div>
        <span class="trow__c">{{ num(line.q0) }}</span>
        <span class="trow__c">{{ line.conf ? num(line.conf) : "—" }}</span>
        <div class="trow__ctl">
            <div v-if="pm.edit && line.conf < line.q0" class="rcv">
                <UiStepper :model-value="rcv" :min="line.conf" :max="line.q0" :trash="false" :label="'Принято: ' + line.p.name" @update:model-value="emit('set', 'rcv', line._id, $event)" @clamped="emit('clamped', line)" />
                <button type="button" class="btn btn--outline btn--md rcv__all" :disabled="full" @click="emit('set', 'rcv', line._id, line.q0)">Всё</button>
            </div>
            <b v-else class="qty" :class="{ pos: full }">{{ num(rcv) }} из {{ num(line.q0) }}</b>
        </div>
        <span class="trow__side">
            <span v-if="full" class="tag tag--success"><UiIcon name="check" :size="14" />{{ line.conf === line.q0 ? "Принято" : "Полностью" }}</span>
            <span v-else class="tag tag--warning">Не хватает {{ line.q0 - rcv }}</span>
        </span>
    </div>

    <div v-else class="trow is-full">
        <span class="trow__cov"><UiCover :product="line.p" size="sm" /></span>
        <div class="trow__main">
            <span class="trow__n">{{ line.p.name }}</span>
            <span class="trow__m">{{ line.p.category }} · {{ num(line.conf) }} из {{ pcs(line.q0) }} · {{ money(line.p.price) }}/шт.</span>
        </div>
        <span class="trow__c">{{ num(line.q0) }}</span>
        <span class="trow__c"
            ><span class="pos">{{ num(line.conf) }}</span></span
        >
        <div class="trow__ctl"></div>
        <span class="trow__side"
            ><b>{{ money(line.p.price * line.q0) }}</b></span
        >
    </div>
</template>
