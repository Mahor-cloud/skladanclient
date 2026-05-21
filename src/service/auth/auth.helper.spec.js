/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const cookieStore = {}

vi.mock('js-cookie', () => ({
    default: {
        set: vi.fn((name, value) => { cookieStore[name] = value }),
        remove: vi.fn((name) => { delete cookieStore[name] }),
        get: vi.fn((name) => cookieStore[name]),
    },
}))

import { saveTokensStorage, removeTokensStorage, saveToStorage } from './auth.helper.js'
import Cookies from 'js-cookie'

const makeTokenData = (overrides = {}) => ({
    accessToken: 'acc-token-123',
    refreshToken: 'ref-token-456',
    user: { _id: 'u1', login: 'admin', name: 'Председатель', role: { permissions: [] } },
    ...overrides,
})

describe('saveTokensStorage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls Cookies.set for accessToken', () => {
        saveTokensStorage(makeTokenData())
        expect(Cookies.set).toHaveBeenCalledWith(
            'accessToken',
            'acc-token-123',
            expect.any(Object)
        )
    })

    it('calls Cookies.set for refreshToken', () => {
        saveTokensStorage(makeTokenData())
        expect(Cookies.set).toHaveBeenCalledWith(
            'refreshToken',
            'ref-token-456',
            expect.any(Object)
        )
    })

    it('sets accessToken with expires=1 day', () => {
        saveTokensStorage(makeTokenData())
        const [, , opts] = Cookies.set.mock.calls.find(([name]) => name === 'accessToken')
        expect(opts.expires).toBe(1)
    })

    it('sets refreshToken with expires=30 days', () => {
        saveTokensStorage(makeTokenData())
        const [, , opts] = Cookies.set.mock.calls.find(([name]) => name === 'refreshToken')
        expect(opts.expires).toBe(30)
    })

    it('sets sameSite=strict on both cookies', () => {
        saveTokensStorage(makeTokenData())
        for (const [, , opts] of Cookies.set.mock.calls) {
            expect(opts.sameSite).toBe('strict')
        }
    })
})

describe('removeTokensStorage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('removes accessToken cookie', () => {
        removeTokensStorage()
        expect(Cookies.remove).toHaveBeenCalledWith('accessToken')
    })

    it('removes refreshToken cookie', () => {
        removeTokensStorage()
        expect(Cookies.remove).toHaveBeenCalledWith('refreshToken')
    })

    it('calls Cookies.remove exactly twice (one per token)', () => {
        removeTokensStorage()
        expect(Cookies.remove).toHaveBeenCalledTimes(2)
    })
})

describe('saveToStorage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    it('saves user object to localStorage under key "user"', () => {
        const data = makeTokenData()
        saveToStorage(data)
        const stored = JSON.parse(localStorage.getItem('user'))
        expect(stored).toEqual(data.user)
    })

    it('also calls saveTokensStorage (sets both cookies)', () => {
        saveToStorage(makeTokenData())
        const names = Cookies.set.mock.calls.map(([name]) => name)
        expect(names).toContain('accessToken')
        expect(names).toContain('refreshToken')
    })

    it('stores user as valid JSON (parseable)', () => {
        saveToStorage(makeTokenData())
        expect(() => JSON.parse(localStorage.getItem('user'))).not.toThrow()
    })

    it('overwrites previous user in localStorage on repeated calls', () => {
        saveToStorage(makeTokenData({ user: { _id: 'u1', name: 'First' } }))
        saveToStorage(makeTokenData({ user: { _id: 'u2', name: 'Second' } }))
        const stored = JSON.parse(localStorage.getItem('user'))
        expect(stored.name).toBe('Second')
    })
})
