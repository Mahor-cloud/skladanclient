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

axiosInstance.interceptors.request.use((config) => {
    const accessToken = Cookies.get("accessToken")
    if (config.headers && accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
})

const errorCatch = (error) => (error.response && error.response.data ? (typeof error.response.data.message === "object" ? error.response.data.message[0] : error.response.data.message) : error.message)

axiosInstance.interceptors.response.use(
    (config) => config,
    async (error) => {
        console.log(error.message, error.status)
        const originalRequest = error.config
        if ((error.response.status === 401 || errorCatch(error) === "jwt expired" || errorCatch(error) === "jwt must be provided") && error.config && !error.config._isRetry) {
            originalRequest._isRetry = true
            try {
                await authService.getNewTokens()
                return axiosInstance.request(originalRequest)
            } catch (e) {
                console.warn(errorCatch(error))
                if (errorCatch(error) !== "Unauthorized" || errorCatch(error) === "jwt expired") {
                    authService.logout()
                }
            }
        }
        throw error
    }
)
export default axiosInstance
