/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import axiosInstance from "@/service/axios"

/* Фото товара: кадр обложки 360×420 (6:7) в WebP — его делает окно кадрирования и он же — фото с lit-na.ru без окна. */
export const PHOTO = { W: 360, H: 420, quality: 0.9, max: 512 * 1024 }

/** Кадр по умолчанию, как при открытии окна кадрирования: картинка заполняет рамку по центру. */
export function frameBlob(img) {
    const { W, H } = PHOTO
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight)
    const cv = document.createElement("canvas")
    cv.width = W
    cv.height = H
    const g = cv.getContext("2d")
    g.imageSmoothingQuality = "high"
    g.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)
    return new Promise((res) => cv.toBlob(res, "image/webp", PHOTO.quality))
}

/** Картинка как data:-адрес — так её читает и загрузка с устройства (blob:-адреса политика содержимого не пускает). */
export const dataUrl = (blob) =>
    new Promise((res, rej) => {
        const fr = new FileReader()
        fr.onerror = rej
        fr.onload = () => res(fr.result)
        fr.readAsDataURL(blob)
    })

/** Фото товара с lit-na.ru (через наш сервер) готовым кадром; null — не вышло (нет картинки, сеть, слишком большое). */
export async function sitePhoto(siteId) {
    try {
        const { data } = await axiosInstance.get(`/litna/image/${siteId}`, { responseType: "blob" })
        if (!/^image\//.test(data.type)) return null
        const img = new Image()
        img.src = await dataUrl(data)
        await img.decode()
        const blob = await frameBlob(img)
        return blob && blob.size <= PHOTO.max ? blob : null
    } catch {
        return null
    }
}
