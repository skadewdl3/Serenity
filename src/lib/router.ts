import { createRouter, createWebHistory } from 'vue-router';
import Home from '@/pages/Home.vue';
import Recents from '@/pages/Recents.vue';
import Reader from '@/pages/Reader.vue';

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home,
    },
    {
        path: '/recents',
        name: 'Recents',
        component: Recents,
    },
    {
        path: '/viewer',
        name: 'Viewer',
        component: Reader,
    },
    {
        path: '/settings',
        name: 'Settings',
        component: () => import('@/pages/Settings.vue'),
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
