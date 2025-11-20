<script setup lang="ts">
import VueZoomable from "vue-zoomable";
import {
    ref,
    useTemplateRef,
    watch,
    computed,
    onUnmounted,
    nextTick,
} from "vue";
import {
    useEventListener,
    useWindowSize,
    refDebounced,
    useElementBounding,
    refAutoReset,
    useSwipe,
    useDark,
} from "@vueuse/core";
import { VuePDF } from "@tato30/vue-pdf";
import "@tato30/vue-pdf/style.css";
import * as PDFJS from "pdfjs-dist";
import emitter from "@/lib/events";
import { useAppStore } from "@/stores/appStore";

// --- Props & Emits ---
const { pdfTask, pdf, currentPage } = defineProps<{
    pdfTask: PDFJS.PDFDocumentLoadingTask;
    pdf: PDFJS.PDFDocumentProxy;
    currentPage: number;
    pageCount: number;
    loading: boolean;
}>();
const isDark = useDark();
const emit = defineEmits<{
    loaded: [data: any];
}>();

const store = useAppStore();
const pageWrapper = useTemplateRef("pageWrapper");

// --- Constants ---
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.25;
const DEFAULT_SCALE = 0.9;

// --- Viewer State ---
function handleClick() {
    emitter.emit("toggleToolbar");
}

const { direction } = useSwipe(pageWrapper);
const isZooming = refAutoReset(false, 100);
const isPanning = refAutoReset(false, 100);
const scale = ref(DEFAULT_SCALE);
const pdfScale = refDebounced(scale, 1000);
const pan = ref({ x: 0, y: 0 });
const centerPan = ref({ x: 0, y: 0 });
const viewerWrapper = useTemplateRef("wrapper");
const { width, height } = useElementBounding(viewerWrapper);
const { width: windowWidth, height: windowHeight } = useWindowSize();

const allowPan = computed(() => {
    return {
        x: width.value > windowWidth.value,
        y: height.value > windowHeight.value,
    };
});

watch(scale, (newScale) => {
    emitter.emit("zoomChanged", newScale);
});

watch(direction, () => {
    if ((allowPan.value.x && isPanning.value) || isZooming.value) return;
    if (direction.value === "left") {
        emitter.emit("nextPage");
    } else if (direction.value === "right") {
        emitter.emit("prevPage");
    }
});

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
    if (!pdf) return;
    scale.value = DEFAULT_SCALE;
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
        emitter.emit("selectionChange", text);
    } else if (!text && lastSelection) {
        lastSelection = "";
        emitter.emit("selectionClear");
    }
}

useEventListener(document, "selectionchange", handleSelection);

// --- Click to Navigate / Toggle Toolbar ---
function handlePageClick(e: MouseEvent) {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    const deadZone = 0.3;
    const side = (width * (1 - deadZone)) / 2;

    if (!lastSelection) {
        if (x < side) emitter.emit("prevPage");
        else if (x > width - side) emitter.emit("nextPage");
        else store.hideToolbar = !store.hideToolbar;
    }
}

let firstPageLoaded = false;
async function onPageLoad(data: any) {
    if (!firstPageLoaded) {
        await nextTick(); // Wait for the DOM to update
        if (viewerWrapper.value) {
            const rect = viewerWrapper.value.getBoundingClientRect();
            let panY = windowHeight.value / 2 - rect.height / 2;
            let panX = 0;
            centerPan.value = { x: panX, y: panY };
        }
    }
    setTimeout(() => {
        firstPageLoaded = true;
        emit("loaded", data);
    }, 50);
}

watch(centerPan, () => {
    pan.value = centerPan.value;
});

function handlePan(_data: any) {
    isPanning.value = true;
    if (!allowPan.value.x) {
        pan.value.x = centerPan.value.x;
    }
    if (!allowPan.value.y) {
        pan.value.y = centerPan.value.y;
    }
}

emitter.on("zoomIn", zoomIn);
emitter.on("zoomOut", zoomOut);
emitter.on("resetZoom", resetZoom);
emitter.on("fitToWidth", fitToWidth);

onUnmounted(() => {
    emitter.off("zoomIn", zoomIn);
    emitter.off("zoomOut", zoomOut);
    emitter.off("resetZoom", resetZoom);
    emitter.off("fitToWidth", fitToWidth);
});
</script>

<template>
    <div
        class="pdf-viewer screen h-screen"
        ref="pageWrapper"
        @click="handlePageClick"
    >
        <VueZoomable
            ref="zoomableContainer"
            @click="handleClick"
            v-model:zoom="scale"
            :min-scale="0.5"
            :max-scale="4"
            :zooming-elastic="false"
            :disabled="false"
            class="w-full h-full overflow-hidden"
            v-model:pan="pan"
            @panned="handlePan"
            @zoom="isZooming = true"
            :min-zoom="MIN_ZOOM"
            :max-zoom="MAX_ZOOM"
            :enable-control-button="false"
        >
            <div id="wrapper" ref="wrapper">
                <VuePDF
                    v-if="pdfTask"
                    class="w-full h-full"
                    :pdf="pdfTask as any"
                    fit-parent
                    ref="viewer"
                    :page="currentPage"
                    :scale="pdfScale"
                    @loaded="onPageLoad"
                    :class="{ 'invert-94': isDark && store.invertPdfInDarkMode }"
                    text-layer
                />
            </div>
        </VueZoomable>
    </div>
</template>

<style scoped>
/* Selection highlight */
.vue-pdf-page .textLayer span::selection,
.vue-pdf-page .textLayer span::-moz-selection {
    background: rgba(0, 123, 255, 0.3) !important;
    color: transparent !important;
}
</style>

