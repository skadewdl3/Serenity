<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useColorMode, useScroll } from "@vueuse/core";
import {
    Moon,
    Sun,
    Laptop,
    Trash2,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAppStore } from "@/stores/appStore";

const mode = useColorMode();
const store = useAppStore();

const scrollContainer = ref<HTMLElement | null>(null);
const { y } = useScroll(scrollContainer);

const isScrolled = computed(() => y.value > 20);

const zoomValue = ref([store.defaultZoom]);

watch(
    () => zoomValue.value[0],
    (newVal) => {
        store.defaultZoom = newVal;
    }
);

function clearHistory() {
    store.clearHistory();
}
</script>

<template>
    <div ref="scrollContainer" class="w-full max-w-4xl mx-auto p-8 h-screen bg-background text-foreground relative overflow-y-auto">
        <div class="min-h-full pb-20">
            <!-- Dynamic Header -->
            <div
                class="sticky top-0 z-50 transition-all duration-300 ease-in-out flex items-center justify-center -mx-8 px-8 mb-8"
                :class="[
                    isScrolled
                        ? 'py-4 bg-background/80 backdrop-blur-md border-b shadow-sm'
                        : 'py-20 bg-transparent'
                ]"
            >
                <!-- Back button is now handled globally in Root.vue -->

                <h1
                        class="font-bold text-foreground text-center font-serif transition-all duration-300 origin-center"
                        :class="isScrolled ? 'text-2xl' : 'text-6xl'"
                    >
                        Settings
                    </h1>
                </div>

                <div class="space-y-8">
                    <!-- Appearance -->
                    <section class="space-y-4">
                        <h2 class="text-xl font-semibold">Appearance</h2>
                        
                        <!-- Theme -->
                        <div class="flex items-center justify-between">
                            <Label>Theme</Label>
                            <div class="flex items-center gap-2 bg-muted p-1 rounded-lg">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    :class="{ 'bg-background shadow-sm': mode === 'light' }"
                                    @click="mode = 'light'"
                                >
                                    <Sun class="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    :class="{ 'bg-background shadow-sm': mode === 'dark' }"
                                    @click="mode = 'dark'"
                                >
                                    <Moon class="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    :class="{ 'bg-background shadow-sm': mode === 'auto' }"
                                    @click="mode = 'auto'"
                                >
                                    <Laptop class="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        
                        <!-- Default Zoom -->
                        <div class="space-y-3">
                            <div class="flex justify-between">
                                <Label>Default Zoom</Label>
                                <span class="text-sm text-muted-foreground">{{ (store.defaultZoom * 100).toFixed(0) }}%</span>
                            </div>
                            <Slider
                                v-model="zoomValue"
                                :min="0.5"
                                :max="2.0"
                                :step="0.1"
                                class="w-full"
                            />
                        </div>

                        <!-- Invert PDF in Dark Mode -->
                        <div class="flex items-center justify-between">
                            <div class="space-y-0.5">
                                <Label>Invert PDF in Dark Mode</Label>
                                <p class="text-sm text-muted-foreground">
                                    Invert colors for a better reading experience at night.
                                </p>
                            </div>
                            <Switch
                                :checked="store.invertPdfInDarkMode"
                                @update:checked="(val: boolean) => store.invertPdfInDarkMode = val"
                            />
                        </div>
                    </section>

                    <div class="h-px bg-border"></div>

                    <!-- Interface -->
                    <section class="space-y-4">
                        <h2 class="text-xl font-semibold">Interface</h2>
                        
                        <!-- Floating Toolbars -->
                        <div class="flex items-center justify-between">
                            <div class="space-y-0.5">
                                <Label>Floating Toolbars</Label>
                                <p class="text-sm text-muted-foreground">
                                    Display toolbars as floating pills instead of fixed bars.
                                </p>
                            </div>
                            <Switch
                                :checked="store.floatingToolbars"
                                @update:checked="(val: boolean) => store.floatingToolbars = val"
                            />
                        </div>
                    </section>

                    <div class="h-px bg-border"></div>

                    <!-- Data -->
                    <section class="space-y-4">
                        <h2 class="text-xl font-semibold">Data</h2>
                        
                        <div class="flex items-center justify-between">
                            <div class="space-y-0.5">
                                <Label>Clear History</Label>
                                <p class="text-sm text-muted-foreground">
                                    Remove all recent files from the home screen.
                                </p>
                            </div>
                            <Button variant="destructive" size="sm" @click="clearHistory">
                                <Trash2 class="h-4 w-4 mr-2" />
                                Clear History
                            </Button>
                        </div>
                    </section>
                </div>
            </div>
    </div>
</template>
