<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '@/stores/appStore';
import { storeToRefs } from 'pinia';
import { routeToolbarMap } from '@/lib/toolbarConfig';

const route = useRoute();
const store = useAppStore();
const { transitionDirection, hideToolbar } = storeToRefs(store);

// Get the toolbar component for the current route
const currentToolbar = computed<Component | null>(() => {
    const routeName = route.name as string;
    
    // For Viewer route, check hideToolbar state
    if (routeName === 'Viewer' && hideToolbar.value) {
        return null;
    }
    
    return routeToolbarMap[routeName] || null;
});

// Determine transition name based on navigation direction
const toolbarTransition = computed(() => {
    // Always use the same transition since both directions slide from/to bottom
    return 'toolbar-slide';
});
</script>

<template>
    <Transition :name="toolbarTransition" mode="out-in">
        <component :is="currentToolbar" v-if="currentToolbar" :key="route.name as string" />
    </Transition>
</template>

<style>
/* Toolbar slides in from bottom, exits to bottom */
.toolbar-slide-enter-active {
    transition: all 0.3s ease 0.1s; /* 500ms delay */
}

.toolbar-slide-leave-active {
    transition: all 0.3s ease;
}

.toolbar-slide-enter-from {
    opacity: 0;
    transform: translateY(100px); /* Enter from bottom */
}

.toolbar-slide-enter-to {
    opacity: 1;
    transform: translateY(0); /* End at normal position */
}

.toolbar-slide-leave-to {
    opacity: 0;
    transform: translateY(100px); /* Exit to bottom */
}
</style>


