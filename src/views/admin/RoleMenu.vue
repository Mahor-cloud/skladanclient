<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { tabsFor } from "@/domain/nav"
import { UiIcon, UiSeg } from "@/ui"
import { computed, nextTick, ref } from "vue"
import { menuRows, moveTab, toggleTab } from "./admin"

// «Нижнее меню на телефоне» роли: v-model — null («Авто») или свой набор id разделов (до 4, по порядку). ctx — права из редактора.
const props = defineProps({
    modelValue: { type: Array, default: null },
    ctx: { type: Object, required: true },
    readonly: Boolean
})
const emit = defineEmits(["update:modelValue"])
const menu = computed(() => props.modelValue)
const shown = computed(() => tabsFor(props.ctx, menu.value))
const rows = computed(() => (menu.value ? menuRows(props.ctx, menu.value) : []))
const MODES = [
    { value: "auto", label: "Авто" },
    { value: "custom", label: "Выбрать самому" }
]
const setMode = (m) => emit("update:modelValue", m === "custom" ? shown.value.map((n) => n.id) : null)
const box = ref(null)
async function move(id, d) {
    emit("update:modelValue", moveTab(menu.value, id, d))
    // фокус остаётся на той же стрелке — порядок можно менять клавиатурой подряд
    await nextTick()
    box.value?.querySelector(`[data-mv="${id}${d}"]`)?.focus()
}
</script>

<template>
    <section ref="box" class="rmenu">
        <header class="rmenu__h">
            <span class="pgroup__i"><UiIcon name="phone" :size="18" /></span>
            <div><h4>Нижнее меню на телефоне</h4></div>
        </header>
        <UiSeg :model-value="menu ? 'custom' : 'auto'" :options="MODES" size="sm" label="Состав меню" @update:model-value="!readonly && setMode($event)" />
        <div class="rmenu__grid">
            <div class="rmenu__list">
                <template v-if="menu">
                    <div v-for="(x, i) in rows" :key="x.n.id" class="rmrow" :class="{ 'is-off': !x.ok, 'is-on': menu.includes(x.n.id) }">
                        <label class="check" :class="{ 'is-disabled': !x.ok || (menu.length >= 4 && !menu.includes(x.n.id)) || readonly }"
                            ><input
                                type="checkbox"
                                :checked="menu.includes(x.n.id)"
                                :disabled="!x.ok || (menu.length >= 4 && !menu.includes(x.n.id)) || readonly"
                                @change="emit('update:modelValue', toggleTab(menu, x.n.id, $event.target.checked))"
                            /><span class="check__box" aria-hidden="true"><UiIcon name="check" :size="16" /></span
                            ><span class="check__text"
                                ><UiIcon :name="x.n.icon" :size="18" class="inl" /> {{ x.n.label }}<small v-if="!x.ok">нет права на этот раздел</small><small v-else-if="menu.length >= 4 && !menu.includes(x.n.id)">уже выбрано 4</small></span
                            ></label
                        >
                        <span v-if="menu.includes(x.n.id)" class="rmrow__mv"
                            ><button type="button" class="ibtn ibtn--soft" :data-mv="x.n.id + '-1'" :aria-label="'Выше: ' + x.n.label" :disabled="i === 0 || readonly" @click="move(x.n.id, -1)"><UiIcon name="down" :size="18" class="rot180" /></button
                            ><button type="button" class="ibtn ibtn--soft" :data-mv="x.n.id + '1'" :aria-label="'Ниже: ' + x.n.label" :disabled="i === menu.length - 1 || readonly" @click="move(x.n.id, 1)"><UiIcon name="down" :size="18" /></button
                        ></span>
                    </div>
                </template>
                <p v-else class="rmenu__auto"><UiIcon name="bolt" :size="16" class="inl" /> Первые четыре раздела, доступные по правам</p>
            </div>
            <figure class="rmenu__pv">
                <div class="rmenu__bar" :style="{ '--tabs': shown.length + 1 }">
                    <span v-for="(n, i) in shown" :key="n.id" :class="{ 'is-on': i === 0 }"
                        ><UiIcon :name="n.icon" /><small>{{ n.label }}</small></span
                    ><span><UiIcon name="user" /><small>Профиль</small></span>
                </div>
            </figure>
        </div>
    </section>
</template>
