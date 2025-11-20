<script setup lang="ts">
import { readFile } from "@tauri-apps/plugin-fs";
import { shallowRef, onMounted, ref, watch, onUnmounted } from "vue";
import PdfViewer from "@/components/PdfViewer.vue";
import DefinitionDrawer from "@/components/DefinitionDrawer.vue";
import ToolbarDrawer from "@/components/ToolbarDrawer.vue";
import { refAutoReset, useScreenOrientation } from "@vueuse/core";
import * as PDFJS from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import emitter, { type RecentFile } from "@/lib/events";
import { Spinner } from "@/components/ui/spinner";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/stores/appStore";
import { storeToRefs } from "pinia";

const store = useAppStore();
const { selectedFilePath } = storeToRefs(store);

const quote = ref<string>("Loading...");
invoke<string>("get_random_loading_quote").then((res) => {
    quote.value = res;
});

// --- Tauri Worker Setup ---
PDFJS.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// --- PDF State (Custom Composable) ---
const pdfTask = shallowRef<PDFJS.PDFDocumentLoadingTask | null>(null);
const pdf = shallowRef<PDFJS.PDFDocumentProxy | null>(null);
const pageData = ref(null);
const pageCount = ref(0);
const isPdfLoading = ref(false);
const currentPage = ref(1);
const { orientation } = useScreenOrientation();
const rotating = refAutoReset(false, 10);

// --- UI State ---
const scale = ref(store.defaultZoom);
const selectedText = ref("");
const isToolbarVisible = ref(true);
const isDefinitionDrawerOpen = ref(false);
const isToolbarDrawerOpen = ref(false);
const wordForDefinition = ref<string | null>(null);

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;


// Sync reader state to store for Toolbar
watch([currentPage, pageCount, isPdfLoading, selectedText, scale, isToolbarVisible], () => {
    store.updateReaderState({
        currentPage: currentPage.value,
        totalPages: pageCount.value,
        isLoading: isPdfLoading.value,
        isRendering: false,
        selectedText: selectedText.value,
        scale: scale.value,
        toolbarVisible: isToolbarVisible.value,
    });
}, { immediate: true });

watch(orientation, () => {
    rotating.value = true;
});

watch(currentPage, (newPage) => {
    if (selectedFilePath.value) {
        emitter.emit("editRecentsEntry", {
            path: selectedFilePath.value,
            pageNumber: newPage,
        });
    }
});

async function loadPdf(filePath: string) {
    if (!filePath) {
        console.error("No file path provided");
        return;
    }

    isPdfLoading.value = true;

    try {
        const fileData = await readFile(filePath);
        const uint8Array = new Uint8Array(fileData);

        if (pdfTask.value) {
            await pdfTask.value.destroy();
        }

        pdfTask.value = PDFJS.getDocument({ data: uint8Array });
        pdf.value = await pdfTask.value.promise;
        pageCount.value = pdf.value.numPages;
        currentPage.value = 1; // Reset to first page when new PDF is loaded

        const recentsRaw = localStorage.getItem("recentFiles");
        if (recentsRaw) {
            const recents = JSON.parse(recentsRaw) as RecentFile[];
            const currentFile = recents.find(
                (file) => file.path === selectedFilePath.value,
            );
            if (currentFile && currentFile.pageNumber) {
                currentPage.value = currentFile.pageNumber;
            }
        }

    } catch (error) {
        console.error("Error loading PDF:", error);
    } finally {
        isPdfLoading.value = false;
    }
}

function loaded(data: any) {
    pageData.value = data;
    emitter.emit("pdfLoaded", data);
}

// --- Page Navigation ---
function handleNextPage() {
    if (currentPage.value < pageCount.value) {
        currentPage.value++;
    }
}
function handlePrevPage() {
    if (currentPage.value > 1) {
        currentPage.value--;
    }
}

function handleFitToWidth() {
    scale.value = 1.0;
}

function handleLookupSelection() {
    if (selectedText.value) {
        wordForDefinition.value = selectedText.value;
        isDefinitionDrawerOpen.value = true;
        window.getSelection()?.removeAllRanges();
    }
}

function handleCopySelection() {
    if (selectedText.value) {
        navigator.clipboard.writeText(selectedText.value);
    }
}

function handleToggleToolbar() {
    isToolbarVisible.value = !isToolbarVisible.value;
}

function handleOpenToolbarDrawer() {
    isToolbarDrawerOpen.value = true;
}

function handleZoomChange(newScale: number) {
    scale.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
}

function handleGoBack() {
    store.popRoute();
}

onMounted(async () => {
    emitter.on("goBack", handleGoBack);
    emitter.on("nextPage", handleNextPage);
    emitter.on("prevPage", handlePrevPage);
    emitter.on("fitToWidth", handleFitToWidth);
    emitter.on("lookupSelection", handleLookupSelection);
    emitter.on("copySelection", handleCopySelection);
    emitter.on("toggleToolbar", handleToggleToolbar);
    emitter.on("openToolbarDrawer", handleOpenToolbarDrawer);
    emitter.on("zoomChanged", handleZoomChange);

    if (selectedFilePath.value) {
        loadPdf(selectedFilePath.value);
    }
});

onUnmounted(() => {
    emitter.off("goBack", handleGoBack);
    emitter.off("nextPage", handleNextPage);
    emitter.off("prevPage", handlePrevPage);
    emitter.off("fitToWidth", handleFitToWidth);
    emitter.off("lookupSelection", handleLookupSelection);
    emitter.off("copySelection", handleCopySelection);
    emitter.off("toggleToolbar", handleToggleToolbar);
    emitter.off("openToolbarDrawer", handleOpenToolbarDrawer);
    emitter.off("zoomChanged", handleZoomChange);

    if (pdfTask.value) {
        pdfTask.value.destroy();
    }
});
</script>

<template>
    <div class="w-full h-full">
        <div
            class="fixed left-0 top-0 z-10 grid h-screen w-screen bg-background"
            v-if="isPdfLoading"
        >
            <span
                class="place-self-center flex flex-col items-center justify-center gap-8"
            >
                <Spinner v-if="isPdfLoading" class="mx-auto scale-250" />
                <p class="text-center text-muted-foreground">
                    {{ quote || "Loading" }}...
                </p>
            </span>
        </div>
        <PdfViewer
            v-if="pdfTask && pdf && !rotating"
            :key="orientation"
            :pdf-task="pdfTask"
            :page-count="pageCount"
            :pdf="pdf"
            @loaded="loaded"
            :current-page="currentPage"
            :loading="isPdfLoading"
        />
        <transition>
            <p v-if="rotating">ROTATING!</p>
        </transition>

        <DefinitionDrawer
            v-model:open="isDefinitionDrawerOpen"
            :word="wordForDefinition"
        />
        <ToolbarDrawer
            v-model:open="isToolbarDrawerOpen"
            :scale="scale"
            :min-scale="MIN_ZOOM"
            :max-scale="MAX_ZOOM"
        />
    </div>
</template>
