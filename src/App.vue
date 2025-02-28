<script setup>
import { useRegisterSW } from "virtual:pwa-register/vue"
import { computed, onMounted, ref } from "vue"

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW()
const visible = ref(false)

onMounted(() => {
    console.log("onMounted")
    console.log("offlineReady", offlineReady.value)
    console.log("needRefresh", needRefresh.value)

    updateServiceWorker()
})

const close = async () => {
    offlineReady.value = false
    needRefresh.value = false
    visible.value = false
}
const isVisible = computed(() => {
    if (!visible.value) {
        return offlineReady.value || needRefresh.value
    }
    return visible.value
})
</script>

<template>
    <Dialog v-if="offlineReady || needRefresh" :visible="isVisible" :modal="true" v-on:update:visible="close">
        <template #header>
            <div class="inline-flex items-center justify-center gap-2">
                <span class="font-bold whitespace-nowrap">Необходимо обновить!</span>
            </div>
        </template>
        <template #footer>
            <Button label="Cancel" text severity="secondary" @click="close" autofocus />
            <Button
                label="Обновить"
                severity="warn"
                @click="
                    () => {
                        updateServiceWorker()
                        close()
                    }
                "
                autofocus
            />
        </template>
    </Dialog>
    <router-view />
</template>

<style scoped></style>
