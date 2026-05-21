/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import Cookies from "js-cookie"
import { queryClient } from "../queryClient"
import { axiosClassic } from "../axios"
import { removeTokensStorage, saveToStorage } from "./auth.helper"
export const authService = {
    logout(redirect = "/auth/login") {
        removeTokensStorage()
        localStorage.removeItem("user")
        localStorage.removeItem("cart")
        queryClient.clear()
        try {
            window.location.replace(window.location.origin + "/#" + redirect)
        } catch {
            window.location.hash = "#" + redirect
        }
    },

    async login(login, password) {
        const response = await axiosClassic.post("/auth/login", { login, password })
        if (response.data.accessToken) {
            queryClient.clear()
            localStorage.removeItem("cart")
            saveToStorage(response.data)
        }
        return response
    },

    getNewTokens: async function () {
        const refreshToken = Cookies.get("refreshToken")
        const response = await axiosClassic.post(
            "/auth/login/access-token",
            { refreshToken },
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        )
        if (response.data.accessToken) {
            saveToStorage(response.data)
        }
        return response
    },

    landingRoute() {
        const user = JSON.parse(localStorage.getItem("user") || "null")
        return user?.isSuperAdmin ? "/companies" : "/"
    }
}
