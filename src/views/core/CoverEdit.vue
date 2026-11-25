<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { COVER_COLORS, coverColor, COVERS, coverType, stockCover } from "@/domain/covers"
import { money } from "@/domain/format"
import axiosInstance from "@/service/axios"
import { toast, UiBtn, UiCover, UiIcon } from "@/ui"
import { KIND_COVERS } from "@/ui/keys"
import { computed, inject, ref } from "vue"
import KindSheet from "./KindSheet.vue"
import { PHOTO } from "./photo"
import PhotoCrop from "./PhotoCrop.vue"

// Обложка в форме товара — каталог и шаблон «Семена»: предпросмотр, фото (файл → кадрирование → WebP) и цвет рисунка.
// Что делать с готовым фото, решает форма: события photo(blob) и remove; kind — открыть окно вида.
// litna — id товара lit-na.ru с картинкой: «Фото с lit-na.ru» ведёт его картинку тем же путём, что и файл с устройства.
// own — своя позиция «Моего склада»: вида у неё нет, поэтому без строк о виде; вместо окна вида — выбор типа её обложки (v-model:type).
const props = defineProps({
    id: { type: [String, Number], default: "" },
    name: { type: String, default: "" },
    category: { type: String, default: "" },
    price: { type: [String, Number], default: "" },
    photo: { type: String, default: undefined }, // картинка, которая сейчас у товара: новая или с сервера
    color: { type: String, default: "" },
    litna: { type: [Number, String], default: null },
    own: Boolean,
    type: { type: String, default: "" } // own: тип обложки, "" — по умолчанию
})
const emit = defineEmits(["update:color", "update:type", "photo", "remove", "kind"])
const kindCovers = inject(KIND_COVERS, ref({}))

const fake = computed(() => ({ _id: props.id || "new", name: props.name || "Новый товар", category: props.category || "Прочее", coverColor: props.color, cover: props.type }))
const typeOpen = ref(false)
// Что показывает предпросмотр: фото товара → настоящая обложка из набора (по названию) → рисунок.
const hasPhoto = computed(() => !!(props.photo || stockCover(fake.value)))
const typeLabel = computed(() => COVERS[coverType(fake.value, kindCovers.value)].label.toLowerCase())

const crop = ref("") // картинка, открытая в окне кадрирования
const src = ref("") // исходник принятого фото: его можно кадрировать заново
function openImage(file) {
    if (!/^image\//.test(file.type)) return toast({ type: "error", title: "Это не картинка" })
    const fr = new FileReader()
    fr.onerror = () => toast({ type: "error", title: "Не получилось прочитать файл" })
    fr.onload = () => (crop.value = fr.result)
    fr.readAsDataURL(file)
}
function pickFile(ev) {
    const file = ev.target.files?.[0]
    ev.target.value = ""
    if (file) openImage(file)
}
// Картинку сайта отдаёт наш сервер (запрос с авторизацией): напрямую с сайта политика содержимого не пускает.
const fetching = ref(false)
async function fromSite() {
    fetching.value = true
    try {
        openImage((await axiosInstance.get(`/litna/image/${props.litna}`, { responseType: "blob" })).data)
    } catch {
        toast({ type: "error", title: "Не удалось загрузить фото с lit-na.ru" })
    } finally {
        fetching.value = false
    }
}
function cropped(blob) {
    // Сервер принимает картинки до 512 КБ; кадр 360×420 в WebP намного меньше, запас — на браузеры, отдающие PNG.
    if (blob.size > PHOTO.max) return toast({ type: "error", title: "Фото больше 512 КБ" })
    src.value = crop.value
    emit("photo", blob)
}
function remove() {
    src.value = ""
    emit("remove")
}
</script>

<template>
    <div class="pform__preview">
        <UiCover :product="fake" size="md" :photo="photo" :color="color" />
        <div class="pform__pv">
            <b>{{ name || "Название товара" }}</b>
            <template v-if="!own">
                <small>{{ category || "вид не выбран" }} · {{ price !== "" ? money(price) : "цена не указана" }}</small>
                <small>{{ hasPhoto ? "Фото" : `Обложка вида: ${typeLabel}` }}</small>
            </template>
            <div class="pform__ph">
                <label class="btn btn--secondary btn--sm pform__file"
                    ><UiIcon name="image" :size="18" /><span class="btn__l">{{ hasPhoto ? "Заменить фото" : "Загрузить фото" }}</span
                    ><input type="file" class="sr" accept="image/*" @change="pickFile"
                /></label>
                <UiBtn v-if="litna != null" label="Фото с lit-na.ru" icon="download" kind="ghost" size="sm" :loading="fetching" @click="fromSite" />
                <UiBtn v-if="src && photo" label="Кадрировать" icon="sliders" kind="ghost" size="sm" @click="crop = src" />
                <UiBtn v-if="photo" label="Убрать фото" icon="trash" kind="ghost" size="sm" @click="remove" />
                <UiBtn v-if="own" label="Обложка" icon="layers" kind="ghost" size="sm" @click="typeOpen = true" />
                <UiBtn v-else label="Вид: название и обложка" icon="layers" kind="ghost" size="sm" :disabled="!category.trim()" :title="category.trim() ? 'Название вида и тип его обложки' : 'Сначала выберите вид'" @click="$emit('kind')" />
            </div>
        </div>
    </div>
    <div v-if="!hasPhoto" class="field pform__colors">
        <span class="field__label">Цвет обложки</span>
        <div class="swatches" role="group" aria-label="Цвет обложки">
            <button type="button" class="swatch swatch--auto" :class="{ 'is-on': !color }" :aria-pressed="!color" title="Как у вида" aria-label="Цвет как у вида" @click="$emit('update:color', '')">
                <UiIcon name="repeat" :size="18" />
            </button>
            <button
                v-for="[hex, nm] in COVER_COLORS"
                :key="hex"
                type="button"
                class="swatch"
                :class="{ 'is-on': color === hex }"
                :style="{ '--sw': hex }"
                :aria-pressed="color === hex"
                :title="nm"
                :aria-label="'Цвет обложки: ' + nm"
                @click="$emit('update:color', hex)"
            ></button>
        </div>
    </div>
    <PhotoCrop v-if="crop" :src="crop" :tint="coverColor(fake, { kindCovers })" @done="cropped" @close="crop = ''" />
    <KindSheet v-if="typeOpen" :item="fake" @done="(_, t) => emit('update:type', t)" @close="typeOpen = false" />
</template>
