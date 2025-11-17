<script setup lang="ts">
import { readFile } from "@tauri-apps/plugin-fs";
import { shallowRef, onMounted, ref, watch, onUnmounted } from "vue";
import PdfViewer from "./PdfViewer.vue";
import Toolbar from "./Toolbar.vue";
import DefinitionDrawer from "./DefinitionDrawer.vue";
import ToolbarDrawer from "./ToolbarDrawer.vue";
import { refAutoReset, useScreenOrientation } from "@vueuse/core";
import * as PDFJS from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import emitter from "@/lib/events";
import { Spinner } from "@/components/ui/spinner";

const props = defineProps({
    filePath: String,
});
const emit = defineEmits(["back"]);

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
const scale = ref(1);
const selectedText = ref("");
const isToolbarVisible = ref(true);
const isDefinitionDrawerOpen = ref(false);
const isToolbarDrawerOpen = ref(false);
const wordForDefinition = ref<string | null>(null);

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;

watch(orientation, () => {
    rotating.value = true;
});

onMounted(async () => {
    if (!props.filePath) return;

    isPdfLoading.value = true;
    try {
        const data = await readFile(props.filePath);
        const loadingTask = PDFJS.getDocument({
            data,
        });
        pdfTask.value = loadingTask;
        const doc = await loadingTask.promise;
        pdf.value = doc;
        pageCount.value = doc.numPages;
        isPdfLoading.value = false;
    } catch (err) {
        console.error("Failed to load PDF:", err);
    }
});

function back() {
    emit("back");
}

// --- Page Navigation ---
function next() {
    if (currentPage.value < pageCount.value) {
        currentPage.value++;
    }
}
function prev() {
    if (currentPage.value > 1) {
        currentPage.value--;
    }
}

function loaded(data: any) {
    pageData.value = data;
    emitter.emit("pdfLoaded", data);
}

function handleZoomChanged(newScale: number) {
    scale.value = newScale;
}

function handleSelectionChange(text: string) {
    selectedText.value = text;
}

function handleSelectionClear() {
    selectedText.value = "";
}

function handleToggleToolbar() {
    isToolbarVisible.value = !isToolbarVisible.value;
}

function handleOpenToolbarDrawer() {
    isToolbarDrawerOpen.value = true;
}

function handleLookupSelection() {
    wordForDefinition.value = selectedText.value;
    isDefinitionDrawerOpen.value = true;
    window.getSelection()?.removeAllRanges();
}

emitter.on("nextPage", next);
emitter.on("prevPage", prev);
emitter.on("goBack", back);
emitter.on("zoomChanged", handleZoomChanged);
emitter.on("selectionChange", handleSelectionChange);
emitter.on("selectionClear", handleSelectionClear);
emitter.on("toggleToolbar", handleToggleToolbar);
emitter.on("openToolbarDrawer", handleOpenToolbarDrawer);
emitter.on("lookupSelection", handleLookupSelection);

onUnmounted(() => {
    emitter.off("nextPage", next);
    emitter.off("prevPage", prev);
    emitter.off("goBack", back);
    emitter.off("zoomChanged", handleZoomChanged);
    emitter.off("selectionChange", handleSelectionChange);
    emitter.off("selectionClear", handleSelectionClear);
    emitter.off("toggleToolbar", handleToggleToolbar);
    emitter.off("openToolbarDrawer", handleOpenToolbarDrawer);
    emitter.off("lookupSelection", handleLookupSelection);
});
</script>

<template>
    <div class="w-screen h-screen grid" v-if="isPdfLoading">
        <span class="place-self-center">
            <Spinner v-if="isPdfLoading" class="mx-auto scale-250" />
        </span>
    </div>
    <template v-else>
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
        <Toolbar
            :current-page="currentPage"
            :total-pages="pageCount"
            :is-loading="isPdfLoading"
            :is-rendering="false"
            :selected-text="selectedText"
            :scale="scale"
            class="fixed bottom-0 transition-transform duration-300"
            :class="{
                'translate-y-full landscape:translate-y-[calc(100%+1rem)]':
                    !isToolbarVisible,
            }"
        />
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
    </template>
</template>
