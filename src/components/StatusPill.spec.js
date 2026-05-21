/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusPill from './StatusPill.vue'

function mountPill(props) {
    return mount(StatusPill, { props })
}

describe('StatusPill — variantClass', () => {
    it('applies status-pill--done for "Завершен"', () => {
        const wrapper = mountPill({ status: 'Завершен' })
        expect(wrapper.find('span.status-pill').classes()).toContain('status-pill--done')
    })

    it('applies status-pill--done for "Завершена" (inventory)', () => {
        const wrapper = mountPill({ status: 'Завершена' })
        expect(wrapper.find('span.status-pill').classes()).toContain('status-pill--done')
    })

    it('applies status-pill--partial for "Частично завершен"', () => {
        const wrapper = mountPill({ status: 'Частично завершен' })
        expect(wrapper.find('span.status-pill').classes()).toContain('status-pill--partial')
    })

    it('applies status-pill--ready for "К выдаче"', () => {
        const wrapper = mountPill({ status: 'К выдаче' })
        expect(wrapper.find('span.status-pill').classes()).toContain('status-pill--ready')
    })

    it('applies status-pill--ready for "Получен"', () => {
        const wrapper = mountPill({ status: 'Получен' })
        expect(wrapper.find('span.status-pill').classes()).toContain('status-pill--ready')
    })

    it('applies status-pill--pending for "Оплачен"', () => {
        const wrapper = mountPill({ status: 'Оплачен' })
        expect(wrapper.find('span.status-pill').classes()).toContain('status-pill--pending')
    })

    it('applies status-pill--pending for "Ожидание оплаты"', () => {
        const wrapper = mountPill({ status: 'Ожидание оплаты' })
        expect(wrapper.find('span.status-pill').classes()).toContain('status-pill--pending')
    })

    it('applies status-pill--draft for "Новый"', () => {
        const wrapper = mountPill({ status: 'Новый' })
        expect(wrapper.find('span.status-pill').classes()).toContain('status-pill--draft')
    })

    it('applies status-pill--draft as fallback for unknown status', () => {
        const wrapper = mountPill({ status: 'Неизвестный статус' })
        expect(wrapper.find('span.status-pill').classes()).toContain('status-pill--draft')
    })

    it('status matching is case-insensitive (uses toLowerCase)', () => {
        const wrapper = mountPill({ status: 'ЗАВЕРШЕН' })
        expect(wrapper.find('span.status-pill').classes()).toContain('status-pill--done')
    })

    it('"Частично завершен" does NOT get status-pill--done (partial check precedes done check)', () => {
        const wrapper = mountPill({ status: 'Частично завершен' })
        expect(wrapper.find('span.status-pill').classes()).not.toContain('status-pill--done')
    })
})

describe('StatusPill — rendering', () => {
    it('renders the status text inside the span', () => {
        const wrapper = mountPill({ status: 'Новый' })
        expect(wrapper.text()).toContain('Новый')
    })

    it('does not render <i> element when icon prop is empty (default)', () => {
        const wrapper = mountPill({ status: 'Новый' })
        expect(wrapper.find('i').exists()).toBe(false)
    })

    it('renders <i> element with correct pi class when icon prop is provided', () => {
        const wrapper = mountPill({ status: 'Завершен', icon: 'check' })
        const icon = wrapper.find('i')
        expect(icon.exists()).toBe(true)
        expect(icon.classes()).toContain('pi-check')
    })

    it('applies status-pill--md class when size="md"', () => {
        const wrapper = mountPill({ status: 'Новый', size: 'md' })
        expect(wrapper.find('span.status-pill').classes()).toContain('status-pill--md')
    })

    it('does not apply status-pill--md class when size="sm" (default)', () => {
        const wrapper = mountPill({ status: 'Новый', size: 'sm' })
        expect(wrapper.find('span.status-pill').classes()).not.toContain('status-pill--md')
    })

    it('renders root element as <span>', () => {
        const wrapper = mountPill({ status: 'Новый' })
        expect(wrapper.element.tagName.toLowerCase()).toBe('span')
    })
})
