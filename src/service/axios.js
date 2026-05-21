/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import axios from "axios"
import Cookies from "js-cookie"
import { authService } from "./auth/auth.service"

export const axiosClassic = axios.create({
    baseURL: `/api`,
    headers: {
        "Content-Type": "application/json"
    }
})

const axiosInstance = axios.create({
    baseURL: `/api`,
    headers: {
        "Content-Type": "application/json"
    }
})

const errorCatch = (error) =>
    error.response && error.response.data
        ? typeof error.response.data.message === "object"
            ? error.response.data.message[0]
            : error.response.data.message
        : error.message

let refreshPromise = null
function refreshTokensOnce() {
    if (!refreshPromise) {
        refreshPromise = authService
            .getNewTokens()
            .finally(() => {
                refreshPromise = null
            })
    }
    return refreshPromise
}

function isAccessTokenExpired(token) {
    if (!token) return true
    try {
        const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
        const exp = JSON.parse(atob(b64)).exp
        if (!exp) return true

        return exp * 1000 <= Date.now() + 10_000
    } catch {
        return true
    }
}

axiosInstance.interceptors.request.use(async (config) => {
    let accessToken = Cookies.get("accessToken")
    const refreshToken = Cookies.get("refreshToken")
    if (refreshToken && isAccessTokenExpired(accessToken)) {
        try {
            await refreshTokensOnce()
            accessToken = Cookies.get("accessToken")
        } catch {

        }
    }
    if (config.headers && accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
})

axiosInstance.interceptors.response.use(
    (config) => config,
    async (error) => {
        const originalRequest = error.config
        const status = error?.response?.status
        const isAuthError =
            status === 401 ||
            errorCatch(error) === "jwt expired" ||
            errorCatch(error) === "jwt must be provided"

        if (isAuthError && originalRequest && !originalRequest._isRetry) {
            originalRequest._isRetry = true
            try {
                await refreshTokensOnce()
                return axiosInstance.request(originalRequest)
            } catch (e) {
                const rs = e?.response?.status
                if (rs === 401 || rs === 403) {
                    const msg = e?.response?.data?.message
                    let isSuper = false
                    try {
                        isSuper = !!JSON.parse(localStorage.getItem("user") || "null")?.isSuperAdmin
                    } catch {
                        isSuper = false
                    }
                    if (msg === "SESSION_SUPERSEDED" && !isSuper) {
                        authService.logout("/auth/access?reason=session")
                    } else {
                        authService.logout()
                    }
                }
            }
        }
        throw error
    }
)
export default axiosInstance
