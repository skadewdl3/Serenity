<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef, watch, nextTick } from "vue";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { readFile } from "@tauri-apps/plugin-fs";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import Toolbar from "./Toolbar.vue";
import DefinitionDrawer from "./DefinitionDrawer.vue";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

const props = defineProps<{ filePath: string }>();
const emit = defineEmits<{
    back: [];
    nextPage: [];
    prevPage: [];
    selectionChange: [text: string];
    selectionClear: [];
}>();

const pdfDoc = shallowRef<PDFDocumentProxy | null>(null);
const currentPage = ref(1);
const totalPages = ref(0);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const textLayerRef = ref<HTMLDivElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const pageWidth = ref(0);
const pageHeight = ref(0);
const isLoading = ref(true);
const isRendering = ref(false);
const selectedText = ref("");
const isDefinitionDrawerOpen = ref(false);
const wordForDefinition = ref<string | null>(null);

let renderTask: any = null;

// =======================
// PDF LOADING & RENDERING
// =======================
async function renderPage(pageNum: number) {
    if (!pdfDoc.value || !canvasRef.value || !textLayerRef.value) return;

    if (renderTask) {
        try {
            renderTask.cancel();
        } catch (_) {}
        renderTask = null;
    }

    isRendering.value = true;

    const page: PDFPageProxy = await pdfDoc.value.getPage(pageNum);
    const containerWidth = containerRef.value?.clientWidth ?? 800;
    const viewport = page.getViewport({ scale: 1 });
    const scale = containerWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    pageWidth.value = scaledViewport.width;
    pageHeight.value = scaledViewport.height;

    const canvas = canvasRef.value;
    const context = canvas!.getContext("2d")!;
    const outputScale = window.devicePixelRatio || 1;

    canvas!.width = Math.floor(scaledViewport.width * outputScale);
    canvas!.height = Math.floor(scaledViewport.height * outputScale);

    const transform =
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

    renderTask = page.render({
        canvas: canvasRef.value,
        canvasContext: context,
        viewport: scaledViewport,
        transform,
    });

    await renderTask.promise;
    renderTask = null;

    console.log("Page rendered");

    // Setup text layer
    const textLayer = textLayerRef.value;
    textLayer.innerHTML = "";
    textLayer.className = "textLayer";

    // Render text content
    const textContent = await page.getTextContent();

    console.log("Text items:", textContent.items.length);

    // Create text layer spans
    textContent.items.forEach((item: any, _index: number) => {
        if (!item.str) return;

        const span = document.createElement("span");
        span.textContent = item.str;

        const tx = item.transform;
        const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);

        span.style.position = "absolute";
        span.style.left = `${tx[4] * scale}px`;
        span.style.bottom = `${tx[5] * scale}px`;
        span.style.fontSize = `${fontHeight * scale}px`;
        span.style.fontFamily = item.fontName || "sans-serif";
        span.style.whiteSpace = "pre";
        span.style.color = "transparent";
        span.style.userSelect = "text";
        span.style.pointerEvents = "all";

        // Handle justified text - if item has width, set it explicitly and adjust spacing
        if (item.width && item.str.length > 1) {
            const itemWidth = item.width * scale;
            span.style.width = `${itemWidth}px`;
            span.style.display = "inline-block";
            span.style.textAlign = "justify";
            span.style.textAlignLast = "justify";
        }

        textLayer.appendChild(span);
    });

    console.log("Text layer rendered");
    handleNextPage();
    handlePrevPage();
    isRendering.value = false;
}

async function loadPDF() {
    if (!props.filePath) return;
    isLoading.value = true;

    try {
        const fileData = await readFile(props.filePath);
        const loadingTask = getDocument({ data: fileData });
        pdfDoc.value = await loadingTask.promise;
        totalPages.value = pdfDoc.value.numPages;
        currentPage.value = 1;
        await nextTick();
        await renderPage(1);
    } catch (err) {
        console.error("PDF load error:", err);
    } finally {
        isLoading.value = false;
    }
}

// =======================
// PAGE CONTROLS
// =======================
function handleNextPage() {
    if (currentPage.value < totalPages.value && !isRendering.value) {
        currentPage.value++;
        renderPage(currentPage.value);
    }
}

function handlePrevPage() {
    if (currentPage.value > 1 && !isRendering.value) {
        currentPage.value--;
        renderPage(currentPage.value);
    }
}

function handleBack() {
    emit("back");
}

// =======================
// TEXT SELECTION LOGIC
// =======================
let lastSelection = "";

function handleSelectionChange() {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();

    // Only process if selection is within our text layer
    if (text && textLayerRef.value) {
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (
            range &&
            textLayerRef.value.contains(range.commonAncestorContainer)
        ) {
            if (text !== lastSelection) {
                lastSelection = text;
                selectedText.value = text;
                emit("selectionChange", text);
            }
            return;
        }
    }

    // Clear selection if no text or outside text layer
    if (!text && lastSelection) {
        lastSelection = "";
        selectedText.value = "";
        emit("selectionClear");
    }
}

// =======================
// SHRINK/EXPAND SELECTION
// =======================
/**
 * Build a character-level index map for the textLayer.
 * Returns { fullText, map } where map[i] = { node: TextNode, offset: number }
 */
function buildTextIndexMap() {
    const textLayer = textLayerRef.value;
    if (!textLayer)
        return {
            fullText: "",
            map: [] as Array<{ node: Node; offset: number }>,
        };

    let fullText = "";
    const map: Array<{ node: Node; offset: number }> = [];

    // iterate child spans in DOM order (pdf.js creates spans in reading order)
    for (const spanEl of Array.from(textLayer.children)) {
        // prefer the span's text node if present
        const textNode =
            spanEl.firstChild && spanEl.firstChild.nodeType === Node.TEXT_NODE
                ? (spanEl.firstChild as Node)
                : null;
        const spanText = spanEl.textContent || "";

        if (!spanText) continue;

        if (textNode) {
            // map each character to the text node + local offset
            for (let i = 0; i < spanText.length; i++) {
                map.push({ node: textNode, offset: i });
                fullText += spanText[i];
            }
        } else {
            // fallback: map character to the span element itself (less ideal)
            for (let i = 0; i < spanText.length; i++) {
                map.push({ node: spanEl, offset: i });
                fullText += spanText[i];
            }
        }
    }

    return { fullText, map };
}

/**
 * Attempt to compute global start/end indices for the current DOM selection.
 * Returns { startIdx, endIdx } where endIdx is exclusive.
 * If it fails to find an exact mapping, falls back to text search of selection string.
 */
function getSelectionGlobalIndices(): {
    startIdx: number;
    endIdx: number;
} | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    const { map, fullText } = buildTextIndexMap();

    if (!map.length) return null;

    // normalize nodes to text nodes if they are element wrappers
    const normalizeNode = (node: Node) => {
        if (
            node.nodeType === Node.ELEMENT_NODE &&
            node.firstChild &&
            node.firstChild.nodeType === Node.TEXT_NODE
        ) {
            return node.firstChild as Node;
        }
        return node;
    };

    const sNode = normalizeNode(range.startContainer);
    const eNode = normalizeNode(range.endContainer);
    const sOffset = range.startOffset;
    const eOffset = range.endOffset;

    // Try to find indices by matching node + offset in map
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < map.length; i++) {
        const entry = map[i];
        if (entry.node === sNode && entry.offset === sOffset) {
            startIdx = i;
            break;
        }
    }

    // For end, if selection ends at an exact char boundary, find the first map index *after*
    // the last selected character. We try to find the first map index where node===eNode && offset===eOffset,
    // which corresponds to the next character position (i.e., exclusive end).
    for (let i = 0; i < map.length; i++) {
        const entry = map[i];
        if (entry.node === eNode && entry.offset === eOffset) {
            endIdx = i;
            break;
        }
    }

    // If we found both start and end indices, return them
    if (startIdx !== -1 && endIdx !== -1) return { startIdx, endIdx };

    // fallback: locate selection string in fullText
    const selText = sel.toString();
    if (!selText) return null;

    const idx = fullText.indexOf(selText);
    if (idx !== -1) {
        return { startIdx: idx, endIdx: idx + selText.length };
    }

    // last resort: try approximate search (first occurrence)
    return null;
}

/**
 * Set DOM selection (Range) using global character indices (start inclusive, end exclusive).
 */
function setSelectionFromGlobalIndices(startIdx: number, endIdx: number) {
    const { map } = buildTextIndexMap();
    if (!map.length) return;

    // clamp
    const s = Math.max(0, Math.min(startIdx, map.length));
    const e = Math.max(0, Math.min(endIdx, map.length));

    if (s >= e) {
        // clear selection
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
        lastSelection = "";
        selectedText.value = "";
        emit("selectionClear");
        return;
    }

    // Compute start node & offset
    const startEntry = map[s];
    const startNode =
        startEntry.node.nodeType === Node.ELEMENT_NODE &&
        startEntry.node.firstChild
            ? startEntry.node.firstChild!
            : startEntry.node;
    const startOffset = startEntry.offset;

    // Compute end as exclusive position: if e < map.length, use map[e] (start of next char),
    // otherwise set to last char's node offset + 1
    let endNode: Node;
    let endOffset: number;

    if (e < map.length) {
        const nextEntry = map[e];
        endNode =
            nextEntry.node.nodeType === Node.ELEMENT_NODE &&
            nextEntry.node.firstChild
                ? nextEntry.node.firstChild!
                : nextEntry.node;
        endOffset = nextEntry.offset;
    } else {
        const lastEntry = map[map.length - 1];
        endNode =
            lastEntry.node.nodeType === Node.ELEMENT_NODE &&
            lastEntry.node.firstChild
                ? lastEntry.node.firstChild!
                : lastEntry.node;
        endOffset = lastEntry.offset + 1;
    }

    try {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);

        const sel = window.getSelection();
        if (!sel) return;

        sel.removeAllRanges();
        sel.addRange(range);

        const newText = sel.toString().trim();
        if (newText) {
            lastSelection = newText;
            selectedText.value = newText;
            emit("selectionChange", newText);
        } else {
            lastSelection = "";
            selectedText.value = "";
            emit("selectionClear");
        }
    } catch (err) {
        console.warn("setSelectionFromGlobalIndices failed:", err);
    }
}

/**
 * Adjust selection using global indices.
 * delta < 0 : shrink selection FROM START (move start forward by |delta| chars)
 * delta > 0 : expand selection AT END (move end forward by delta chars)
 */
function adjustSelection(delta: number) {
    const indices = getSelectionGlobalIndices();
    if (!indices) return;

    let { startIdx, endIdx } = indices;

    const { fullText } = buildTextIndexMap();
    if (delta < 0) {
        endIdx = Math.min(endIdx + delta, fullText.length);
    } else {
        endIdx = Math.min(endIdx + delta, fullText.length);
    }

    setSelectionFromGlobalIndices(startIdx, endIdx);
}

function handleShrinkSelection() {
    adjustSelection(-1);
}

function handleExpandSelection() {
    adjustSelection(1);
}

function handleLookupSelection() {
    wordForDefinition.value = selectedText.value;
    isDefinitionDrawerOpen.value = true;
    window.getSelection()?.removeAllRanges();
}

onMounted(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    loadPDF();
});

onUnmounted(() => {
    document.removeEventListener("selectionchange", handleSelectionChange);
});

// Watch for file changes
watch(
    () => props.filePath,
    () => {
        currentPage.value = 1;
        loadPDF();
    },
);
</script>

<template>
    <div class="flex flex-col h-screen w-screen bg-gray-100">
        <div
            ref="containerRef"
            class="flex-1 overflow-auto bg-white flex items-center justify-center"
        >
            <div
                v-if="isLoading"
                class="flex flex-col items-center justify-center h-full text-gray-600"
            >
                <div
                    class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
                ></div>
                <p class="mt-4">Loading PDF...</p>
            </div>
            <div
                v-else
                class="relative bg-white"
                :style="{
                    width: pageWidth ? `${pageWidth}px` : '100%',
                    height: pageHeight ? `${pageHeight}px` : 'auto',
                }"
            >
                <canvas
                    ref="canvasRef"
                    class="absolute top-0 left-0"
                    :style="{
                        width: pageWidth ? `${pageWidth}px` : '100%',
                        height: pageHeight ? `${pageHeight}px` : 'auto',
                    }"
                ></canvas>
                <div
                    ref="textLayerRef"
                    class="absolute top-0 left-0 textLayer"
                    :style="{
                        width: pageWidth ? `${pageWidth}px` : '100%',
                        height: pageHeight ? `${pageHeight}px` : 'auto',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                        pointerEvents: 'auto',
                    }"
                ></div>
            </div>
        </div>
        <Toolbar
            :current-page="currentPage"
            :total-pages="totalPages"
            :is-rendering="isRendering"
            :is-loading="isLoading"
            :selected-text="selectedText"
            @back="handleBack"
            @next-page="handleNextPage"
            @prev-page="handlePrevPage"
            @shrink-selection="handleShrinkSelection"
            @expand-selection="handleExpandSelection"
            @lookup-selection="handleLookupSelection"
        />
        <DefinitionDrawer
            v-model:open="isDefinitionDrawerOpen"
            :word="wordForDefinition"
        />
    </div>
</template>

<style scoped>
.textLayer span {
    user-select: text !important;
    color: transparent;
}

.textLayer span::selection {
    background: rgba(0, 123, 255, 0.3);
    color: transparent;
}
</style>
