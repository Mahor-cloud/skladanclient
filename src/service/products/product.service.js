import { useQuery } from "@tanstack/vue-query"
import axiosInstance from "../axios"
import { isAuthenticated } from "../auth/auth.helper"

const getProductData = async () => {
    return await axiosInstance.get("/products")
}

const getProductById = async (id) => {
    return await axiosInstance.get(`/products/${id}`)
}

export const productService = {
    getProducts(opts = {}) {
        const { isError, data, error, isSuccess, isFetching, failureCount } = useQuery({
            queryKey: ["products"],
            queryFn: getProductData,
            refetchOnWindowFocus: false,
            select: (data) => data.data,
            staleTime: 1000 * 60 * 5,
            refetchInterval: 1000 * 60 * 5,

            enabled: () => {
                const o = opts.enabled
                const base = typeof o === "function" ? o() : (o?.value ?? o ?? true)
                return isAuthenticated() && base
            }
        })
        return { isError, data, error, isSuccess, isFetching, failureCount }
    },

    getProductById(id) {
        const { isError, data, error, isSuccess, isFetching } = useQuery({
            queryKey: ["product", id],
            queryFn: () => getProductById(id),
            select: (data) => data.data,
            enabled: !!id,
            refetchOnWindowFocus: false,
            staleTime: 1000 * 60 * 5,
            refetchInterval: 1000 * 60 * 5
        })
        return { isError, data, error, isSuccess, isFetching }
    }
}
