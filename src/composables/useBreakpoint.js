import { onBeforeUnmount, onMounted, ref } from "vue"

export function useBreakpoint() {
    const width = ref(typeof window !== "undefined" ? window.innerWidth : 1024)

    const onResize = () => {
        width.value = window.innerWidth
    }

    onMounted(() => {
        window.addEventListener("resize", onResize, { passive: true })
        onResize()
    })

    onBeforeUnmount(() => {
        window.removeEventListener("resize", onResize)
    })

    const isMobile = () => width.value < 576
    const isTablet = () => width.value >= 576 && width.value < 768
    const isDesktop = () => width.value >= 768
    const isWide = () => width.value >= 1200

    return {
        width,

        get isMobile() { return width.value < 576 },
        get isTablet() { return width.value >= 576 && width.value < 768 },
        get isDesktop() { return width.value >= 768 },
        get isWide() { return width.value >= 1200 },

        isMobileFn: isMobile,
        isTabletFn: isTablet,
        isDesktopFn: isDesktop,
        isWideFn: isWide
    }
}
