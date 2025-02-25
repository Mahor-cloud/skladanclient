import { useQuery } from "@tanstack/vue-query"
import axiosInstance from "../axios"

const getProductData = async () => {
    return await axiosInstance.get("/products")
}

const getProductById = async (id) => {
    return await axiosInstance.get(`/products/${id}`)
}

export const productService = {
    getProducts() {
        const { isError, data, error, isSuccess, isFetching } = useQuery({
            queryKey: ["products"],
            queryFn: getProductData,
            refetchOnWindowFocus: true,
            select: (data) => data.data,
            staleTime: 1000 * 60 * 5,
            refetchInterval: 1000 * 60 * 5
        })
        return { isError, data, error, isSuccess, isFetching }
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
