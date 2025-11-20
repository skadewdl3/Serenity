import type { Component } from 'vue';
import HomeToolbar from '@/components/HomeToolbar.vue';
import SettingsToolbar from '@/components/SettingsToolbar.vue';
import Toolbar from '@/components/Toolbar.vue';

export const routeToolbarMap: Record<string, Component | null> = {
    'Home': HomeToolbar,
    'Settings': SettingsToolbar,
    'Viewer': Toolbar,
    'Recents': null,
};
