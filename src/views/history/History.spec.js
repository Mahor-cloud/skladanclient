

import { describe, it, expect } from 'vitest'

const EVENT_LABELS_RU = {
    'order-created': 'Заказ создан',
    'order-updated': 'Заказ обновлён',
    'order-deleted': 'Заказ удалён',
    'order-surcharge-pending': 'Требуется доплата',
    'order-refund-pending': 'Требуется возврат',
    'purchase-created': 'Закупка создана',
    'purchase-updated': 'Закупка обновлена',
    'purchase-deleted': 'Закупка удалена',
    'inventory-created': 'Инвентаризация начата',
    'inventory-updated': 'Инвентаризация обновлена',
    'inventory-edited-after-completion': 'Завершённая инвентаризация переписана',
    'inventory-deleted': 'Инвентаризация удалена',
    'inventory-deleted-after-completion': 'Завершённая инвентаризация удалена',
    'product-created': 'Товар создан',
    'product-updated': 'Товар обновлён',
    'product-deleted': 'Товар удалён',
    'user-created': 'Пользователь создан',
    'user-updated': 'Пользователь обновлён',
    'user-deleted': 'Пользователь удалён',
    'role-created': 'Роль создана',
    'role-updated': 'Роль обновлена',
    'role-deleted': 'Роль удалена',
}

function eventLabel(type) {
    return EVENT_LABELS_RU[type] || type
}

describe('eventLabel', () => {
    it('returns "Заказ создан" for "order-created"', () => {
        expect(eventLabel('order-created')).toBe('Заказ создан')
    })

    it('returns "Заказ обновлён" for "order-updated"', () => {
        expect(eventLabel('order-updated')).toBe('Заказ обновлён')
    })

    it('returns "Заказ удалён" for "order-deleted"', () => {
        expect(eventLabel('order-deleted')).toBe('Заказ удалён')
    })

    it('returns "Требуется доплата" for "order-surcharge-pending"', () => {
        expect(eventLabel('order-surcharge-pending')).toBe('Требуется доплата')
    })

    it('returns "Требуется возврат" for "order-refund-pending"', () => {
        expect(eventLabel('order-refund-pending')).toBe('Требуется возврат')
    })

    it('returns "Закупка создана" for "purchase-created"', () => {
        expect(eventLabel('purchase-created')).toBe('Закупка создана')
    })

    it('returns "Закупка обновлена" for "purchase-updated"', () => {
        expect(eventLabel('purchase-updated')).toBe('Закупка обновлена')
    })

    it('returns "Закупка удалена" for "purchase-deleted"', () => {
        expect(eventLabel('purchase-deleted')).toBe('Закупка удалена')
    })

    it('returns "Инвентаризация начата" for "inventory-created"', () => {
        expect(eventLabel('inventory-created')).toBe('Инвентаризация начата')
    })

    it('returns "Инвентаризация обновлена" for "inventory-updated"', () => {
        expect(eventLabel('inventory-updated')).toBe('Инвентаризация обновлена')
    })

    it('returns "Завершённая инвентаризация переписана" for "inventory-edited-after-completion"', () => {
        expect(eventLabel('inventory-edited-after-completion')).toBe(
            'Завершённая инвентаризация переписана'
        )
    })

    it('returns "Инвентаризация удалена" for "inventory-deleted"', () => {
        expect(eventLabel('inventory-deleted')).toBe('Инвентаризация удалена')
    })

    it('returns "Завершённая инвентаризация удалена" for "inventory-deleted-after-completion"', () => {
        expect(eventLabel('inventory-deleted-after-completion')).toBe(
            'Завершённая инвентаризация удалена'
        )
    })

    it('returns "Товар создан" for "product-created"', () => {
        expect(eventLabel('product-created')).toBe('Товар создан')
    })

    it('returns "Товар обновлён" for "product-updated"', () => {
        expect(eventLabel('product-updated')).toBe('Товар обновлён')
    })

    it('returns "Товар удалён" for "product-deleted"', () => {
        expect(eventLabel('product-deleted')).toBe('Товар удалён')
    })

    it('returns "Пользователь создан" for "user-created"', () => {
        expect(eventLabel('user-created')).toBe('Пользователь создан')
    })

    it('returns "Пользователь обновлён" for "user-updated"', () => {
        expect(eventLabel('user-updated')).toBe('Пользователь обновлён')
    })

    it('returns "Пользователь удалён" for "user-deleted"', () => {
        expect(eventLabel('user-deleted')).toBe('Пользователь удалён')
    })

    it('returns "Роль создана" for "role-created"', () => {
        expect(eventLabel('role-created')).toBe('Роль создана')
    })

    it('returns "Роль обновлена" for "role-updated"', () => {
        expect(eventLabel('role-updated')).toBe('Роль обновлена')
    })

    it('returns "Роль удалена" for "role-deleted"', () => {
        expect(eventLabel('role-deleted')).toBe('Роль удалена')
    })

    it('falls back to raw changeType string for unknown type', () => {
        expect(eventLabel('unknown-custom-type')).toBe('unknown-custom-type')
    })

    it('falls back to empty string when type is empty string', () => {

        expect(eventLabel('')).toBe('')
    })

    it('all known labels contain Cyrillic characters', () => {
        const cyrillicRe = /[а-яёА-ЯЁ]/
        for (const [key, label] of Object.entries(EVENT_LABELS_RU)) {
            expect(cyrillicRe.test(label), `label for "${key}" should be Cyrillic`).toBe(true)
        }
    })
})
