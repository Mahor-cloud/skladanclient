/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { useSession } from "@/composables/useSession"
import router from "@/router"
import Cookies from "js-cookie"

const { user, can, isSuper } = useSession()

router.beforeEach((to) => {
    if (!to.matched.some((r) => r.meta.requiresAuth)) return true
    if (!Cookies.get("refreshToken") || !Cookies.get("accessToken") || !user.value) return "/auth/login"

    // Супер-админу доступны только разделы платформы; остальным они закрыты.
    if (isSuper.value) return to.meta.superAdmin ? true : "/companies"
    if (to.meta.superAdmin) return "/auth/access"

    const need = to.meta.permission
    if (need && ![].concat(need).some((p) => can(p))) return "/auth/access"
    return true
})
