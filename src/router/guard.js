/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import router from '@/router';
import Cookies from 'js-cookie';

function loadUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        return null;
    }
}

const SUPER_ADMIN_ALLOWED = new Set(['/companies', '/auth/login', '/auth/access', '/auth/error']);

router.beforeEach((to, from, next) => {
    const isAuthenticated = Cookies.get('refreshToken') && Cookies.get('accessToken');

    if (to.matched.some((record) => record.meta.requiresAuth)) {
        if (!isAuthenticated) {
            return next('/auth/login');
        }
        const user = loadUser();
        if (!user) return next('/auth/login');

        if (user.isSuperAdmin) {
            const path = to.path.replace(/\/$/, '') || '/';
            const allowedRoots = ['/companies', '/seeds', '/observability']
            const allowed = allowedRoots.some((r) => path === r || path.startsWith(r + '/'))
            if (!allowed) {
                return next('/companies');
            }
            return next();
        }

        if (to.meta?.superAdmin) {
            return next('/auth/access');
        }

        const requiredPermission = to.meta?.permission;
        if (requiredPermission) {
            const perms = user.role?.permissions || [];
            const list = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
            const ok = list.some((p) => perms.includes(p));
            if (!ok) return next('/auth/access');
        }
        return next();
    }
    return next();
});
