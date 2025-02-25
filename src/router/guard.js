import router from '@/router';
import Cookies from 'js-cookie';

router.beforeEach((to, from, next) => {
    const isAuthenticated = Cookies.get('refreshToken') && Cookies.get('accessToken');

    if (to.matched.some((record) => record.meta.requiresAuth)) {
        if (!isAuthenticated) {
            next('/auth/login');
        } else {
            next();
        }
    } else {
        next();
    }
});
