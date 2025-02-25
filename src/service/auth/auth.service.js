import Cookies from "js-cookie"
import { axiosClassic } from "../axios"
import { removeTokensStorage, saveToStorage } from "./auth.helper"
export const authService = {
    logout() {
        removeTokensStorage()
        localStorage.removeItem("user")
    },

    async login(login, password) {
        try {
            const response = await axiosClassic.post("/auth/login", { login, password })
            if (response.data.accessToken) {
                saveToStorage(response.data)
            }
            return response
        } catch (e) {
            throw new Error(e)
        }
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
    }
}
