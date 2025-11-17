<script setup lang="ts">
import VueZoomable from "vue-zoomable";
import {
    onMounted,
    ref,
    shallowRef,
    useTemplateRef,
    watch,
    computed,
} from "vue";
import {
    useElementSize,
    useDebounceFn,
    useEventListener,
    useWindowSize,
    useElementBounding,
    useScreenOrientation,
    computedWithControl,
} from "@vueuse/core";
import { VuePDF } from "@tato30/vue-pdf";
import "@tato30/vue-pdf/style.css";
import * as PDFJS from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { readFile } from "@tauri-apps/plugin-fs";

import Toolbar from "./Toolbar.vue";
import DefinitionDrawer from "./DefinitionDrawer.vue";
import ToolbarDrawer from "./ToolbarDrawer.vue";

// --- Tauri Worker Setup ---
PDFJS.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// --- Props & Emits ---
const props = defineProps<{ filePath: string }>();
const emit = defineEmits<{
    back: [];
    nextPage: [];
    prevPage: [];
    selectionChange: [text: string];
    selectionClear: [];
}>();

// --- PDF State (Custom Composable) ---
const pdfTask = shallowRef<PDFJS.PDFDocumentLoadingTask | null>(null);
const pdf = shallowRef<PDFJS.PDFDocumentProxy | null>(null);
const pageData = ref(null);
const pageCount = ref(0);
const isPdfLoading = ref(false);
const centerPan = ref({ x: 0, y: 0 });

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
    } catch (err) {
        console.error("Failed to load PDF:", err);
    }
});

// --- Constants ---
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.25;
const DEFAULT_SCALE = 0.9;

// --- Viewer State ---
const currentPage = ref(1);
const scale = ref(DEFAULT_SCALE);
const pdfScale = ref(DEFAULT_SCALE);
const pan = ref({ x: 0, y: 0 });
const viewerWrapper = useTemplateRef("wrapper");
const viewer = useTemplateRef("viewer");
const { width, height } = useElementBounding(viewerWrapper);
const { angle } = useScreenOrientation();
const WINDOW_WIDTH =
    angle.value === 90 || angle.value === 270
        ? window.innerHeight
        : window.innerWidth;
const WINDOW_HEIGHT =
    angle.value === 90 || angle.value === 270
        ? window.innerWidth
        : window.innerHeight;

const windowWidth = computed(() => {
    switch (angle.value) {
        case 0:
            return WINDOW_WIDTH;
        case 90:
            return WINDOW_HEIGHT;
        case 180:
        case -90:
            return WINDOW_WIDTH;
        case 270:
            return WINDOW_HEIGHT;
    }
    return 0;
});

const windowHeight = computed(() => {
    switch (angle.value) {
        case 0:
            return WINDOW_HEIGHT;
        case 90:
            return WINDOW_WIDTH;
        case 180:
        case -90:
            return WINDOW_HEIGHT;
        case 270:
            return WINDOW_WIDTH;
    }

    return 0;
});

const allowPan = computedWithControl(angle, () => {
    return {
        x: width.value > windowWidth.value,
        y: height.value > windowHeight.value,
    };
});
const key = ref(0);

watch(angle, () => {
    scale.value = DEFAULT_SCALE;
    pdfScale.value = DEFAULT_SCALE;
    console.log("angle", angle.value);
    console.log("window", windowWidth.value, windowHeight.value);

    let panY = windowHeight.value / 2 - pageData.value?.height / 2;
    let panX = windowWidth.value / 2 - pageData.value?.width / 2;
    centerPan.value = { x: panX, y: panY };
    pan.value = { x: panX, y: panY };
    key.value = Math.random();
});

const selectedText = ref("");
const isDefinitionDrawerOpen = ref(false);
const isToolbarDrawerOpen = ref(false);
const wordForDefinition = ref<string | null>(null);
const isToolbarVisible = ref(true);

function openToolbarDrawer() {
    isToolbarDrawerOpen.value = true;
}

// --- Page Navigation ---
function goNext() {
    if (currentPage.value < pageCount.value) {
        currentPage.value++;
        emit("nextPage");
    }
}
function goPrev() {
    if (currentPage.value > 1) {
        currentPage.value--;
        emit("prevPage");
    }
}
function goBack() {
    emit("back");
}

// --- Zoom ---
function zoomIn() {
    scale.value = Math.min(MAX_ZOOM, scale.value + ZOOM_STEP);
}
function zoomOut() {
    scale.value = Math.max(MIN_ZOOM, scale.value - ZOOM_STEP);
}
function resetZoom() {
    scale.value = 1;
}

async function fitToWidth() {
    if (!pdf.value) return;
    scale.value = DEFAULT_SCALE;
    pdfScale.value = DEFAULT_SCALE;
    pan.value = centerPan.value;
}

// --- Text Selection ---
let lastSelection = "";
function handleSelection() {
    const sel = window.getSelection();
    if (!sel) return;
    const text = sel.toString().trim();

    if (text && text !== lastSelection) {
        lastSelection = text;
        selectedText.value = text;
        emit("selectionChange", text);
    } else if (!text && lastSelection) {
        lastSelection = "";
        selectedText.value = "";
        emit("selectionClear");
    }
}

useEventListener(document, "selectionchange", handleSelection);

function lookupSelection() {
    wordForDefinition.value = selectedText.value;
    isDefinitionDrawerOpen.value = true;
    window.getSelection()?.removeAllRanges();
}

// --- Click to Navigate / Toggle Toolbar ---
function handlePageClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const deadZone = 0.3;
    const side = (width * (1 - deadZone)) / 2;

    if (!selectedText.value) {
        if (x < side) goPrev();
        else if (x > width - side) goNext();
        else isToolbarVisible.value = !isToolbarVisible.value;
    }
}

let firstPageLoad = false;

function onPageLoad(data) {
    pageData.value = data;
    if (firstPageLoad) return;
    let panY = window.innerHeight / 2 - data.height / 2;
    let panX = window.innerWidth / 2 - data.width / 2;
    centerPan.value = { x: panX, y: panY };
    pan.value = { x: panX, y: panY };
    setTimeout(() => {
        firstPageLoad = true;
        isPdfLoading.value = false;
    }, 50);
}

watch(centerPan, () => {
    pan.value = centerPan.value;
});

function handlePan(data) {
    if (!allowPan.value.x) {
        pan.value.x = centerPan.value.x;
    }
    if (!allowPan.value.y) {
        pan.value.y = centerPan.value.y;
    }
}

const handleZoom = useDebounceFn((data) => {
    pdfScale.value = data.scale;
}, 1000);
</script>

<template>
    <div class="w-full h-screen grid place-items-center" v-if="isPdfLoading">
        <div class="z-10 flex items-center justify-center flex-col">
            <div
                class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
            ></div>
            <p class="mt-4">Loading PDF...</p>
        </div>
    </div>
    <VueZoomable
        :key="key"
        selector="#wrapper"
        class="h-screen w-screen"
        zoom-origin="content-center"
        v-model:zoom="scale"
        v-model:pan="pan"
        @panned="handlePan"
        @zoom="handleZoom"
        :min-zoom="MIN_ZOOM"
        :max-zoom="MAX_ZOOM"
        :enable-control-button="false"
        @click="handlePageClick"
        touch-enabled
    >
        <div id="wrapper" class="w-full" ref="wrapper">
            <VuePDF
                v-if="pdfTask"
                :pdf="pdfTask"
                fit-parent
                ref="viewer"
                :page="currentPage"
                :scale="pdfScale"
                @loaded="onPageLoad"
                text-layer
                annotation-layer
            />
        </div>
    </VueZoomable>
    <!-- Scrollable PDF Container -->

    <!-- Toolbar -->
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
        @next-page="goNext"
        @prev-page="goPrev"
        @lookup-selection="lookupSelection"
        @open-toolbar-drawer="openToolbarDrawer"
        @back="goBack"
        @fit-to-width="fitToWidth"
    />

    <!-- Definition Drawer -->
    <DefinitionDrawer
        v-model:open="isDefinitionDrawerOpen"
        :word="wordForDefinition"
    />

    <!-- Toolbar Drawer -->
    <ToolbarDrawer
        v-model:open="isToolbarDrawerOpen"
        v-model:scale="scale"
        :min-scale="MIN_ZOOM"
        :max-scale="MAX_ZOOM"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @reset-zoom="resetZoom"
        @back="goBack"
    />
</template>

<style scoped>
/* Selection highlight */
.vue-pdf-page .textLayer span::selection,
.vue-pdf-page .textLayer span::-moz-selection {
    background: rgba(0, 123, 255, 0.3) !important;
    color: transparent !important;
}
</style>
