<script setup lang="ts">
import { ref, watch, defineProps } from "vue";
import { useSwipe } from "@vueuse/core";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Fullscreen,
    Clipboard,
    Home,
} from "lucide-vue-next";
import emitter from "@/lib/events";

const props = defineProps<{
    currentPage: number;
    totalPages: number;
    isRendering: boolean;
    isLoading: boolean;
    selectedText: string | null;
    scale: number;
}>();

const showSelectionToolbar = ref(false);
const transitionName = ref("p-to-d");

const paginationToolbar = ref<HTMLElement | null>(null);

const { direction } = useSwipe(paginationToolbar, {
    onSwipeEnd: () => {
        if (direction.value === "up") {
            emitter.emit("openToolbarDrawer");
        }
    },
});

watch(
    () => props.selectedText,
    (newVal, oldVal) => {
        const newIsSelection = !!newVal && newVal.trim().length > 0;
        const oldIsSelection = !!oldVal && oldVal.trim().length > 0;

        if (newIsSelection && !oldIsSelection) {
            transitionName.value = "p-to-d";
        } else if (!newIsSelection && oldIsSelection) {
            transitionName.value = "d-to-p";
        }

        showSelectionToolbar.value = newIsSelection;
    },
);

// Handlers
function handleNext() {
    emitter.emit("nextPage");
}
function handlePrev() {
    emitter.emit("prevPage");
}

function handleLookup() {
    emitter.emit("lookupSelection");
}

function handleCopy() {
    emitter.emit("copySelection");
}
</script>

<template>
    <div
        ref="paginationToolbar"
        class="absolute z-10 h-20 bg-white transition-colors duration-300 bottom-0 left-0 right-0 w-full border-t landscape:h-16 landscape:w-2/5 landscape:min-w-[320px] landscape:left-auto landscape:right-4 landscape:bottom-4 landscape:rounded-lg landscape:shadow-lg landscape:border"
    >
        <Transition :name="transitionName" mode="out-in">
            <!-- ✅ Selection toolbar -->
            <div
                v-if="showSelectionToolbar"
                class="flex items-center justify-between h-full px-4"
            >
                <!-- Left: selected text -->
                <div class="flex-1 flex items-center min-w-0">
                    <div
                        class="text-sm text-gray-700 truncate"
                        title="Selected text"
                    >
                        {{ props.selectedText }}
                    </div>
                </div>

                <!-- Right: controls -->
                <ButtonGroup>
                    <Button
                        @click="handleLookup"
                        size="icon"
                        variant="outline"
                        title="Lookup"
                    >
                        <BookOpen class="h-4 w-4" />
                    </Button>
                    <Button
                        @click="handleCopy"
                        size="icon"
                        variant="outline"
                        title="Clipboard"
                    >
                        <Clipboard class="h-4 w-4" />
                    </Button>
                </ButtonGroup>
            </div>

            <!-- ✅ Pagination toolbar -->
            <div v-else class="flex items-center justify-between h-full px-4">
                <!-- Left -->
                <ButtonGroup>
                    <Button
                        @click="emitter.emit('goBack')"
                        variant="outline"
                        size="icon"
                        title="Back"
                    >
                        <Home class="h-4 w-4" />
                    </Button>
                    <Button
                        @click="emitter.emit('fitToWidth')"
                        variant="outline"
                        size="icon"
                        title="Fit to Width"
                    >
                        <Fullscreen class="h-4 w-4" />
                    </Button>
                </ButtonGroup>

                <!-- Center: Page numbers -->
                <div class="flex items-center justify-center">
                    <span class="text-sm font-medium text-gray-700">
                        <template
                            v-if="!props.isLoading && props.totalPages > 0"
                        >
                            {{ props.currentPage }} / {{ props.totalPages }}
                        </template>
                    </span>
                </div>

                <!-- Right: Page navigation -->
                <ButtonGroup>
                    <Button
                        @click="handlePrev"
                        :disabled="props.currentPage <= 1 || props.isRendering"
                        variant="outline"
                        size="icon"
                        title="Previous Page"
                    >
                        <ArrowLeft class="h-4 w-4" />
                    </Button>

                    <Button
                        @click="handleNext"
                        :disabled="
                            props.currentPage >= props.totalPages ||
                            props.isRendering
                        "
                        variant="outline"
                        size="icon"
                        title="Next Page"
                    >
                        <ArrowRight class="h-4 w-4" />
                    </Button>
                </ButtonGroup>
            </div>
        </Transition>
    </div>
</template>

<style>
/* Paginaton to Definition */
.p-to-d-enter-active,
.p-to-d-leave-active {
    transition: all 0.2s ease-in-out;
}
.p-to-d-leave-active {
    position: absolute;
    width: 100%;
}
.p-to-d-enter-from {
    opacity: 0;
    transform: translateY(-1rem); /* from top */
}
.p-to-d-leave-to {
    opacity: 0;
    transform: translateY(1rem); /* to bottom */
}

/* Definition to Pagination */
.d-to-p-enter-active,
.d-to-p-leave-active {
    transition: all 0.2s ease-in-out;
}
.d-to-p-leave-active {
    position: absolute;
    width: 100%;
}
.d-to-p-enter-from {
    opacity: 0;
    transform: translateY(1rem); /* from bottom */
}
.d-to-p-leave-to {
    opacity: 0;
    transform: translateY(-1rem); /* to top */
}
</style>
