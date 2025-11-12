<script setup lang="ts">
import { ref, watch, defineEmits, defineProps } from "vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    ArrowLeft,
    ArrowRight,
    ChevronLeft,
    BookOpen,
    ChevronRight,
    ZoomIn,
    ZoomOut,
} from "lucide-vue-next";

const props = defineProps<{
    currentPage: number;
    totalPages: number;
    isRendering: boolean;
    isLoading: boolean;
    selectedText: string | null;
    scale: number;
}>();

const MIN_SCALE = 0.5;
const MAX_SCALE = 4.0;

const emit = defineEmits([
    "nextPage",
    "prevPage",
    "back",
    "shrinkSelection",
    "expandSelection",
    "lookupSelection",
    "zoomIn",
    "zoomOut",
]);

const showSelectionToolbar = ref(false);
const transitionName = ref("p-to-d");

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
function handleBack() {
    emit("back");
}
function handleNext() {
    emit("nextPage");
}
function handlePrev() {
    emit("prevPage");
}
function handleShrink() {
    emit("shrinkSelection");
}
function handleExpand() {
    emit("expandSelection");
}
function handleLookup() {
    emit("lookupSelection");
}
function handleZoomIn() {
    emit("zoomIn");
}
function handleZoomOut() {
    emit("zoomOut");
}
</script>

<template>
    <div
        class="absolute z-10 h-20 transition-colors duration-300 bottom-0 left-0 right-0 w-full border-t landscape:h-16 landscape:w-2/5 landscape:min-w-[320px] landscape:left-auto landscape:right-4 landscape:bottom-4 landscape:rounded-lg landscape:shadow-lg landscape:border"
        :class="showSelectionToolbar ? 'bg-gray-50' : 'bg-white'"
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
                <div class="flex flex-col items-end gap-1">
                    <div class="flex items-center gap-2">
                        <Button
                            @click="handleLookup"
                            size="icon"
                            variant="outline"
                            title="Lookup"
                        >
                            <BookOpen class="h-4 w-4" />
                        </Button>

                        <ButtonGroup>
                            <Button
                                @click="handleShrink"
                                size="icon"
                                variant="outline"
                                title="Shrink selection (reduce by 1 char)"
                            >
                                <ChevronLeft class="h-4 w-4" />
                            </Button>

                            <Button
                                @click="handleExpand"
                                size="icon"
                                variant="outline"
                                title="Expand selection (add 1 char)"
                            >
                                <ChevronRight class="h-4 w-4" />
                            </Button>
                        </ButtonGroup>
                    </div>
                </div>
            </div>

            <!-- ✅ Pagination toolbar -->
            <div v-else class="flex items-center justify-between h-full px-4">
                <!-- Left: Zoom controls -->
                <div class="w-24 flex justify-start">
                    <ButtonGroup>
                        <Button
                            @click="handleZoomOut"
                            :disabled="
                                props.isLoading ||
                                props.isRendering ||
                                props.scale <= MIN_SCALE
                            "
                            variant="outline"
                            size="icon"
                            title="Zoom Out"
                        >
                            <ZoomOut class="h-4 w-4" />
                        </Button>
                        <Button
                            @click="handleZoomIn"
                            :disabled="
                                props.isLoading ||
                                props.isRendering ||
                                props.scale >= MAX_SCALE
                            "
                            variant="outline"
                            size="icon"
                            title="Zoom In"
                        >
                            <ZoomIn class="h-4 w-4" />
                        </Button>
                    </ButtonGroup>
                </div>

                <!-- Center: Page numbers -->
                <div class="flex items-center">
                    <span class="text-sm font-medium text-gray-700">
                        <template
                            v-if="!props.isLoading && props.totalPages > 0"
                        >
                            {{ props.currentPage }} / {{ props.totalPages }}
                        </template>
                    </span>
                </div>

                <!-- Right: Page navigation -->
                <div class="w-24 flex justify-end">
                    <ButtonGroup>
                        <Button
                            @click="handlePrev"
                            :disabled="
                                props.currentPage <= 1 || props.isRendering
                            "
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
