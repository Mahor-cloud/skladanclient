/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import Cookies from 'js-cookie'

const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:'
const cookieDefaults = {
    sameSite: 'strict',
    secure: isHttps
}

export const saveTokensStorage = (data) => {
    Cookies.set('accessToken', data.accessToken, { ...cookieDefaults, expires: 1 })
    Cookies.set('refreshToken', data.refreshToken, { ...cookieDefaults, expires: 30 })
}

export const saveToStorage = (data) => {
    saveTokensStorage(data)
    localStorage.setItem('user', JSON.stringify(data.user))
}

export const removeTokensStorage = () => {
    Cookies.remove('accessToken')
    Cookies.remove('refreshToken')
}

export const isAuthenticated = () => !!Cookies.get('refreshToken')
