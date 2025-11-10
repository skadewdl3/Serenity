<script setup lang="ts">
import { ref, watch, defineEmits, defineProps } from "vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    ArrowLeft,
    ArrowRight,
    ChevronLeft,
    BookOpen,
    Home,
    ChevronRight,
} from "lucide-vue-next";

const props = defineProps<{
    currentPage: number;
    totalPages: number;
    isRendering: boolean;
    isLoading: boolean;
    selectedText: string | null;
}>();

const emit = defineEmits([
    "nextPage",
    "prevPage",
    "back",
    "shrinkSelection",
    "expandSelection",
    "lookupSelection",
]);

const showSelectionToolbar = ref(false);

watch(
    () => props.selectedText,
    (val) => {
        showSelectionToolbar.value = !!val && val.trim().length > 0;
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
</script>

<template>
    <!-- ✅ Selection toolbar -->
    <div
        v-if="showSelectionToolbar"
        class="flex items-center justify-between px-4 py-3 bg-gray-50 border-t"
    >
        <!-- Left: selected text -->
        <div class="flex-1 flex items-center">
            <div class="text-sm text-gray-700 truncate" title="Selected text">
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
    <div
        v-else
        class="flex items-center justify-between px-4 py-3 border-t bg-white"
    >
        <div class="flex items-center gap-2">
            <Button
                @click="handleBack"
                variant="outline"
                size="icon"
                title="Close"
            >
                <Home class="h-4 w-4" />
            </Button>
            <Button
                @click="handleBack"
                variant="ghost"
                class="invisible"
                size="icon"
                title="Close"
            >
                <Home class="h-4 w-4" />
            </Button>
        </div>
        <span class="text-sm font-medium text-gray-700 text-center">
            <template v-if="!props.isLoading && props.totalPages > 0">
                {{ props.currentPage }} / {{ props.totalPages }}
            </template>
        </span>

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
                    props.currentPage >= props.totalPages || props.isRendering
                "
                variant="outline"
                size="icon"
                title="Next Page"
            >
                <ArrowRight class="h-4 w-4" />
            </Button>
        </ButtonGroup>
    </div>
</template>

<style scoped>
/* Layout handled by Tailwind */
</style>
