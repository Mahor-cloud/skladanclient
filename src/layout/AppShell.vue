<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { isWide } from "@/composables/useBreakpoint"
import { useCart } from "@/composables/useCart"
import { useNav } from "@/composables/useNav"
import { useRealtime } from "@/composables/useRealtime"
import { useSession } from "@/composables/useSession"
import { cartLines, cartTotal } from "@/domain/cart"
import { money, pcs, plural } from "@/domain/format"
import { useProducts } from "@/service/queries"
import { pane, paneTarget, PEEK, peekClose } from "@/ui/pane"
import UiAvatar from "@/ui/UiAvatar.vue"
import UiBadge from "@/ui/UiBadge.vue"
import UiIcon from "@/ui/UiIcon.vue"
import UiInvBar from "@/ui/UiInvBar.vue"
import UiLogo from "@/ui/UiLogo.vue"
import UiWordmark from "@/ui/UiWordmark.vue"
import { computed, defineAsyncComponent, defineComponent, h, nextTick, provide, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"

// Каркас: разделы слева · экран раздела · правая колонка (деталь или колонка раздела); на телефоне — нижнее меню и полоса корзины.
const Profile = defineAsyncComponent(() => import("@/views/core/Profile.vue"))
const PushSheet = defineAsyncComponent(() => import("@/views/core/PushSheet.vue"))

const route = useRoute()
const router = useRouter()
const { user, can, roleTitle } = useSession()
const { items, tabs, home, badges } = useNav()
const { cart, count, kinds } = useCart()
const { data: products } = useProducts()
useRealtime()

const groups = computed(() => [...new Set(items.value.map((n) => n.group))])
const navOn = (n) => route.meta.nav === n.id
// Профиль и «О чём сообщать» — окна поверх любого экрана: адрес экрана тот же, меняется только ?sheet=.
const sheet = computed(() => route.query.sheet)
const profileTo = computed(() => ({ path: route.path, query: { ...route.query, sheet: "profile" } }))

const view = ref(null)
const setPane = (el) => (paneTarget.value = el)
const total = computed(() => cartTotal(cartLines(cart, products.value)))
const cartMeta = computed(() => `${kinds.value} ${plural(kinds.value, ["товар", "товара", "товаров"])} · ${pcs(count.value)}`)
const bar = ref(null)
watch(count, async (n, was) => {
    if (!n || was) return
    await nextTick()
    // Полоса появляется с подскоком — только когда корзина перестала быть пустой.
    bar.value?.classList.remove("is-in")
    void bar.value?.offsetWidth
    bar.value?.classList.add("is-in")
})
// На широком экране полоса видна, только когда корзину справа вытеснил товар: нажатие возвращает корзину.
const cartAway = computed(() => isWide.value && pane.details > 0 && pane.aside === "cart")
function onCartbar() {
    if (cartAway.value && pane.close) pane.close()
    else router.push("/cart")
}

// Деталь, открытая через peek(): тот же компонент, что у маршрута, но адрес не меняется.
const PeekHost = defineComponent({
    setup() {
        provide(PEEK, {
            close: peekClose,
            get key() {
                return pane.peek?.key
            }
        })
        return () => (pane.peek ? h(pane.peek.component, { ...pane.peek.props, key: pane.peek.key }) : null)
    }
})
</script>

<template>
    <a class="skip" href="#view" @click.prevent="view.focus()">К содержимому</a>
    <aside class="side" aria-label="Разделы">
        <RouterLink class="logo" :to="home" aria-label="СкладАН — на главную">
            <UiLogo draw class="logo__m" /><span class="logo__t"
                ><UiWordmark /><small v-if="user?.companyName">{{ user.companyName }}</small></span
            >
        </RouterLink>
        <nav class="side__nav" aria-label="Разделы">
            <div v-for="g in groups" :key="g" class="side__g">
                <h4>{{ g }}</h4>
                <RouterLink v-for="n in items.filter((x) => x.group === g)" :key="n.id" class="side__a" :class="{ 'is-on': navOn(n) }" :aria-current="navOn(n) ? 'page' : null" :to="n.path" :title="n.label">
                    <UiIcon :name="n.icon" :size="22" /><span class="side__l">{{ n.label }}</span
                    ><span class="side__b"><UiBadge v-if="badges[n.id]" :n="badges[n.id].n" :tone="badges[n.id].tone" :data-badge="n.id === 'storage' ? 'cart' : null" /></span>
                </RouterLink>
            </div>
        </nav>
        <RouterLink class="side__me" :to="profileTo" title="Профиль" :aria-label="`Профиль: ${user?.name}, ${roleTitle}`">
            <UiAvatar :user="user" size="sm" /><span class="side__l"
                ><b>{{ user?.name }}</b
                ><small>{{ roleTitle }}</small></span
            ><UiIcon name="dots" :size="18" class="side__sw" />
        </RouterLink>
    </aside>
    <main id="view" ref="view" class="view" tabindex="-1" :data-screen="route.meta.screen || route.name">
        <UiInvBar />
        <RouterView />
    </main>
    <aside id="pane" :ref="setPane" class="pane" aria-label="Детали"></aside>
    <PeekHost />
    <a v-if="can('create_orders')" ref="bar" class="cartbar" :href="router.resolve('/cart').href" data-cartbar :hidden="!count" aria-label="Корзина — открыть" @click.prevent="onCartbar">
        <span class="cartbar__i" data-fly-target><UiIcon name="cart" :size="24" /><UiBadge :n="count" /></span>
        <span class="cartbar__t"
            ><small>{{ cartMeta }}</small
            ><b>{{ money(total) }}</b></span
        >
        <span class="cartbar__go">Оформить<UiIcon name="right" :size="18" /></span>
    </a>
    <nav class="tabbar" aria-label="Основные разделы" :style="{ '--tabs': tabs.length + 1 }">
        <RouterLink v-for="n in tabs" :key="n.id" class="tab" :class="{ 'is-on': navOn(n) && !sheet }" :aria-current="navOn(n) && !sheet ? 'page' : null" :to="n.path">
            <span class="tab__i"><UiIcon :name="n.icon" :size="24" /><UiBadge v-if="badges[n.id]" :n="badges[n.id].n" :tone="badges[n.id].tone" :data-badge="n.id === 'storage' ? 'cart' : null" /></span><span class="tab__l">{{ n.label }}</span>
        </RouterLink>
        <RouterLink class="tab" :class="{ 'is-on': sheet === 'profile' }" :to="profileTo">
            <span class="tab__i"><UiIcon name="user" :size="24" /></span><span class="tab__l">Профиль</span>
        </RouterLink>
    </nav>
    <Profile v-if="sheet === 'profile'" />
    <PushSheet v-else-if="sheet === 'push'" />
</template>
