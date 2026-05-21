import { onBeforeUnmount, onMounted, ref } from "vue"

export function usePwaInstall() {
    const deferredPrompt = ref(null)
    const canInstall = ref(false)
    const isInstalled = ref(false)
    const isIOS = ref(false)

    function checkInstalled() {
        const standalone =
            (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
            window.navigator.standalone === true ||
            document.referrer.startsWith("android-app://")
        isInstalled.value = !!standalone
    }

    function detectIOS() {
        const ua = window.navigator.userAgent || ""
        const iOSDevice = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
        isIOS.value = iOSDevice && !isInstalled.value
    }

    const onBIP = (e) => {

        e.preventDefault()
        deferredPrompt.value = e
        canInstall.value = true
    }
    const onInstalled = () => {
        isInstalled.value = true
        canInstall.value = false
        deferredPrompt.value = null
    }

    async function promptInstall() {
        const ev = deferredPrompt.value
        if (!ev) return
        ev.prompt()
        try {
            await ev.userChoice
        } catch {

        }
        deferredPrompt.value = null
        canInstall.value = false
    }

    onMounted(() => {
        checkInstalled()
        detectIOS()
        window.addEventListener("beforeinstallprompt", onBIP)
        window.addEventListener("appinstalled", onInstalled)
    })
    onBeforeUnmount(() => {
        window.removeEventListener("beforeinstallprompt", onBIP)
        window.removeEventListener("appinstalled", onInstalled)
    })

    return { canInstall, isInstalled, isIOS, promptInstall }
}
