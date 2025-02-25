<script setup>
import { useLayout } from "@/layout/composables/layout"
import { useQuery } from "@tanstack/vue-query"
import { computed, onBeforeMount, ref, watch } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()

const { layoutState, setActiveMenuItem, toggleMenu } = useLayout()

const props = defineProps({
    item: {
        type: Object,
        default: () => ({})
    },
    index: {
        type: Number,
        default: 0
    },
    root: {
        type: Boolean,
        default: true
    },
    parentItemKey: {
        type: String,
        default: null
    }
})

const isActiveMenu = ref(false)
const itemKey = ref(null)

onBeforeMount(() => {
    itemKey.value = props.parentItemKey ? props.parentItemKey + "-" + props.index : String(props.index)

    const activeItem = layoutState.activeMenuItem

    isActiveMenu.value = activeItem === itemKey.value || activeItem ? activeItem.startsWith(itemKey.value + "-") : false
})

watch(
    () => layoutState.activeMenuItem,
    (newVal) => {
        isActiveMenu.value = newVal === itemKey.value || newVal.startsWith(itemKey.value + "-")
    }
)
const user = ref(JSON.parse(localStorage.getItem("user")))

const { data: ordersData, isSuccess: isOrdersSuccess } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => await axiosInstance.get("/orders"),
    refetchOnWindowFocus: true,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const { data: purchasesData, isSuccess: isPurchasesSuccess } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => await axiosInstance.get("/purchases"),
    refetchOnWindowFocus: true,
    select: (data) => data.data,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5
})

const badgeInfo = computed(() => {
    if (props.item.label === "Заказы") {
        const severity = ordersData.value?.filter((order) => order.isPaid && !order.confirmedPaid && !order.isCompleted).length > 0 ? "success" : "primary"
        const value = ordersData.value?.filter((order) => !order.isCompleted).length
        return { severity, value }
    }
    if (props.item.label === "Закупка") {
        const severity = purchasesData.value?.filter((purchase) => !purchase.isPaid && purchase.isCreated).length > 0 ? "success" : "primary"
        const value = purchasesData.value?.filter((purchase) => !purchase.isCompleted && purchase.isCreated).length
        return { severity, value }
    }
})

function itemClick(event, item) {
    if (item.disabled) {
        event.preventDefault()
        return
    }

    if ((item.to || item.url) && (layoutState.staticMenuMobileActive || layoutState.overlayMenuActive)) {
        toggleMenu()
    }

    if (item.command) {
        item.command({ originalEvent: event, item: item })
    }

    const foundItemKey = item.items ? (isActiveMenu.value ? props.parentItemKey : itemKey) : itemKey.value

    setActiveMenuItem(foundItemKey)
}

function checkActiveRoute(item) {
    return route.path === item.to
}
</script>

<template>
    <li :class="{ 'layout-root-menuitem': root, 'active-menuitem': isActiveMenu }">
        <div v-if="root && item.visible !== false" class="layout-menuitem-root-text">{{ item.label }}</div>
        <a v-if="(!item.to || item.items) && item.visible !== false" :href="item.url" @click="itemClick($event, item, index)" :class="item.class" :target="item.target" tabindex="0">
            <i :class="item.icon" class="layout-menuitem-icon"></i>
            <span class="layout-menuitem-text">{{ item.label }}</span>
            <i class="pi pi-fw pi-angle-down layout-submenu-toggler" v-if="item.items"></i>
        </a>
        <router-link v-if="item.to && !item.items && item.visible !== false" @click="itemClick($event, item, index)" :class="[item.class, { 'active-route': checkActiveRoute(item) }]" tabindex="0" :to="item.to">
            <i :class="item.icon" class="layout-menuitem-icon"></i>
            <span class="layout-menuitem-text">{{ item.label }} </span>
            <Badge v-if="badgeInfo?.value > 0" :severity="badgeInfo?.severity" class="ml-2" :value="badgeInfo?.value" />
        </router-link>
        <Transition v-if="item.items && item.visible !== false" name="layout-submenu">
            <ul v-show="root ? true : isActiveMenu" class="layout-submenu">
                <app-menu-item v-for="(child, i) in item.items" :key="child" :index="i" :item="child" :parentItemKey="itemKey" :root="false"></app-menu-item>
            </ul>
        </Transition>
    </li>
</template>

<style lang="scss" scoped></style>
