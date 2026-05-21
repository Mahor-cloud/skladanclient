/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useBreakpoint } from './useBreakpoint.js'

function withSetup(width) {
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
    })

    let result
    const Wrapper = defineComponent({
        setup() {
            result = useBreakpoint()
            return () => h('div')
        },
    })

    const wrapper = mount(Wrapper)
    return { result, wrapper }
}

describe('useBreakpoint — isMobile', () => {
    it('is true when window.innerWidth is 375 (typical phone)', () => {
        const { result } = withSetup(375)
        expect(result.isMobile).toBe(true)
    })

    it('is true when window.innerWidth is 575 (boundary below mobile limit)', () => {
        const { result } = withSetup(575)
        expect(result.isMobile).toBe(true)
    })

    it('is false when window.innerWidth is exactly 576 (tablet start)', () => {
        const { result } = withSetup(576)
        expect(result.isMobile).toBe(false)
    })

    it('is false when window.innerWidth is 768 (desktop start)', () => {
        const { result } = withSetup(768)
        expect(result.isMobile).toBe(false)
    })
})

describe('useBreakpoint — isTablet', () => {
    it('is true when window.innerWidth is 576 (tablet lower boundary)', () => {
        const { result } = withSetup(576)
        expect(result.isTablet).toBe(true)
    })

    it('is true when window.innerWidth is 700', () => {
        const { result } = withSetup(700)
        expect(result.isTablet).toBe(true)
    })

    it('is true when window.innerWidth is 767 (boundary before desktop)', () => {
        const { result } = withSetup(767)
        expect(result.isTablet).toBe(true)
    })

    it('is false when window.innerWidth is exactly 768 (desktop start)', () => {
        const { result } = withSetup(768)
        expect(result.isTablet).toBe(false)
    })

    it('is false when window.innerWidth is 375 (mobile)', () => {
        const { result } = withSetup(375)
        expect(result.isTablet).toBe(false)
    })
})

describe('useBreakpoint — isDesktop', () => {
    it('is true when window.innerWidth is 768 (desktop lower boundary)', () => {
        const { result } = withSetup(768)
        expect(result.isDesktop).toBe(true)
    })

    it('is true when window.innerWidth is 1024', () => {
        const { result } = withSetup(1024)
        expect(result.isDesktop).toBe(true)
    })

    it('is false when window.innerWidth is 767 (just below desktop)', () => {
        const { result } = withSetup(767)
        expect(result.isDesktop).toBe(false)
    })

    it('is false when window.innerWidth is 375 (mobile)', () => {
        const { result } = withSetup(375)
        expect(result.isDesktop).toBe(false)
    })
})

describe('useBreakpoint — isWide', () => {
    it('is true when window.innerWidth is 1200 (wide lower boundary)', () => {
        const { result } = withSetup(1200)
        expect(result.isWide).toBe(true)
    })

    it('is true when window.innerWidth is 1920 (full HD)', () => {
        const { result } = withSetup(1920)
        expect(result.isWide).toBe(true)
    })

    it('is false when window.innerWidth is 1199', () => {
        const { result } = withSetup(1199)
        expect(result.isWide).toBe(false)
    })

    it('is false when window.innerWidth is 768', () => {
        const { result } = withSetup(768)
        expect(result.isWide).toBe(false)
    })
})

describe('useBreakpoint — width ref', () => {
    it('initializes width.value from window.innerWidth', () => {
        const { result } = withSetup(412)
        expect(result.width.value).toBe(412)
    })
})

describe('useBreakpoint — mutually exclusive at boundaries', () => {
    it('at width=576: isTablet=true, isMobile=false', () => {
        const { result } = withSetup(576)
        expect(result.isTablet).toBe(true)
        expect(result.isMobile).toBe(false)
    })

    it('at width=768: isDesktop=true, isTablet=false', () => {
        const { result } = withSetup(768)
        expect(result.isDesktop).toBe(true)
        expect(result.isTablet).toBe(false)
    })

    it('at width=1200: isWide=true, isDesktop=true (wide is subset of desktop)', () => {
        const { result } = withSetup(1200)
        expect(result.isWide).toBe(true)
        expect(result.isDesktop).toBe(true)
    })
})
