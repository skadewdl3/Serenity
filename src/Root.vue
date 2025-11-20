<script setup lang="ts">
import { useColorMode } from "@vueuse/core";
import { useAppStore } from "@/stores/appStore";
import { storeToRefs } from "pinia";
import { ref, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { onBackKeyDown } from "tauri-plugin-app-events-api";
import emitter from "@/lib/events";
import ToolbarWrapper from "@/components/ToolbarWrapper.vue";

useColorMode();

const store = useAppStore();
const router = useRouter();
const { transitionDirection } = storeToRefs(store);

const transitionName = ref('scale-push');

// Watch for changes in transition direction
watch(transitionDirection, (newVal) => {
    console.log('[Root] transitionDirection changed to:', newVal);
});

// Watch for changes in transition name
watch(transitionName, (newVal) => {
    console.log('[Root] transitionName changed to:', newVal);
});

// Update transition name based on store's transition direction
router.beforeEach((to, from, next) => {
    console.log('[Root] beforeEach - navigating from:', from.name, 'to:', to.name);
    console.log('[Root] beforeEach - current transitionDirection:', transitionDirection.value);
    transitionName.value = transitionDirection.value === 'push' ? 'scale-push' : 'scale-pop';
    console.log('[Root] beforeEach - setting transitionName to:', transitionName.value);
    next();
});

onMounted(() => {
    console.log('[Root] Component mounted');
    // Listen for back button events on Android
    onBackKeyDown(() => {
        console.log('[Root] Back button pressed');
        // Check if there's more than just Home in the stack
        if (store.navigationStack.length > 1) {
            console.log('[Root] Emitting goBack event');
            // Emit the goBack event to let components handle it
            emitter.emit("goBack");
            return false; // Prevent default back button behavior
        }
        console.log('[Root] Stack empty, allowing default behavior');
        // If stack is empty (only Home), allow default behavior (exit app)
        return true;
    });
});
</script>

<template>
    <div class="relative w-screen h-screen">
        <router-view v-slot="{ Component }">
            <transition :name="transitionName" mode="out-in">
                <component :is="Component" :key="$route.path" />
            </transition>
        </router-view>

        <ToolbarWrapper />
    </div>
</template>
