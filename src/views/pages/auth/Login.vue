<script setup>
import { authService } from '@/service/auth/auth.service';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const login = ref('');
const password = ref('');
const checked = ref(false);
const router = useRouter();
const handle = ref(false);
const errorMessage = ref('');

const saveCredentials = () => {
    if (checked.value) {
        localStorage.setItem('login', login.value);
        localStorage.setItem('password', password.value);
    } else {
        localStorage.removeItem('login');
        localStorage.removeItem('password');
    }
};

const loadCredentials = () => {
    const savedLogin = localStorage.getItem('login');
    const savedPassword = localStorage.getItem('password');
    if (savedLogin && savedPassword) {
        login.value = savedLogin;
        password.value = savedPassword;
        checked.value = true;
    }
};

const handleLogin = async () => {
    try {
        handle.value = true;
        const response = await authService.login(login.value, password.value);
        const userData = response.data.user;
        if ((userData.login, userData.password, userData._id)) {
            saveCredentials();
            router.push('/');
        } else {
            console.log(userData);
        }
    } catch (e) {
        console.error(e.message);
        errorMessage.value = 'Ошибка входа';
    }
};

onMounted(() => {
    loadCredentials();
});
</script>

<template>
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, rgb(10, 90, 185) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <img src="/demo/images/litkom.png" class="mb-8 w-20 shrink-0 mx-auto" alt="logo" />
                        <span class="text-muted-color font-medium">Войдите чтобы продолжить</span>
                    </div>

                    <div>
                        <label for="login" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Login</label>
                        <InputText :invalid="handle && errorMessage.length > 0" id="login" type="text" placeholder="Login" class="w-full md:w-[30rem] mb-8" v-model="login" />

                        <label for="password" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
                        <Password :invalid="handle && errorMessage.length > 0" id="password" v-model="password" placeholder="Password" :toggleMask="true" class="mb-4" fluid :feedback="false"></Password>

                        <div class="flex items-center justify-between mt-2 mb-8 gap-8">
                            <div class="flex items-center">
                                <Checkbox v-model="checked" id="rememberme" @change="saveCredentials" binary class="mr-2"></Checkbox>
                                <label for="rememberme">Запомнить меня?</label>
                            </div>
                            <span class="font-medium no-underline ml-2 text-right cursor-pointer text-primary">Забыли пароль?</span>
                        </div>
                        <Button label="Войти" style="background: rgb(10, 90, 185)" class="w-full" @click="handleLogin"></Button>
                        <small v-if="handle" class="text-red-500 mx-auto">{{ errorMessage }}</small>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}
</style>
