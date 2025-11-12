<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef, watch } from "vue";
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
const scale = ref(1.0);
const liveCssScale = ref(1.0); // for live pinch-zoom transform
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.25;

const frontCanvasRef = ref<HTMLCanvasElement | null>(null);
const frontTextLayerRef = ref<HTMLDivElement | null>(null);
const backCanvasRef = ref<HTMLCanvasElement | null>(null);
const backTextLayerRef = ref<HTMLDivElement | null>(null);

// 'front' is the canvas currently visible to the user
const activeCanvasName = ref<"front" | "back">("front");
// z-index refs to manage stacking
const frontZIndex = ref(2);
const backZIndex = ref(1);

const containerRef = ref<HTMLDivElement | null>(null);
const pageWidth = ref(0);
const pageHeight = ref(0);
const isLoading = ref(true);
const isRendering = ref(false);
const selectedText = ref("");
const isDefinitionDrawerOpen = ref(false);
const wordForDefinition = ref<string | null>(null);
const pageWrapperRef = ref<HTMLDivElement | null>(null);
const isToolbarVisible = ref(true);

let renderTask: any = null;
let currentRenderingPage = 0;

// =======================
// PDF LOADING & RENDERING
// =======================
async function renderPage(
    pageNum: number,
    canvas: HTMLCanvasElement,
    textLayer: HTMLDivElement,
) {
    console.log("renderPage called with pageNum:", pageNum);

    if (!pdfDoc.value) {
        console.log("No pdfDoc");
        return;
    }
    if (!containerRef.value) {
        console.log("No containerRef");
        return;
    }

    console.log(
        "All refs present, container width:",
        containerRef.value.clientWidth,
    );

    // Cancel any ongoing render
    if (renderTask) {
        try {
            renderTask.cancel();
        } catch (_) {}
        renderTask = null;
    }

    // Track which page this render is for
    const thisRenderPage = pageNum;
    currentRenderingPage = thisRenderPage;
    isRendering.value = true;

    try {
        const page: PDFPageProxy = await pdfDoc.value.getPage(pageNum);
        console.log("Got page:", pageNum);

        const scaledViewport = page.getViewport({ scale: scale.value });

        console.log(
            "Calculated scale:",
            scale,
            "viewport:",
            scaledViewport.width,
            "x",
            scaledViewport.height,
        );

        const newWidth = scaledViewport.width;
        const newHeight = scaledViewport.height;

        const context = canvas.getContext("2d");
        if (!context) {
            console.log("No canvas context");
            return { width: 0, height: 0 };
        }

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(newWidth * outputScale);
        canvas.height = Math.floor(newHeight * outputScale);

        console.log("Canvas dimensions set:", canvas.width, "x", canvas.height);

        const transform =
            outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : undefined;

        renderTask = page.render({
            canvasContext: context,
            viewport: scaledViewport,
            transform,
        });

        console.log("Starting render...");
        await renderTask.promise;
        renderTask = null;

        console.log("Page rendered successfully!");

        // Only update text layer if this render wasn't superseded
        if (currentRenderingPage !== thisRenderPage) {
            console.log("Render superseded, skipping text layer");
            return;
        }

        // Setup text layer
        textLayer.innerHTML = "";
        textLayer.className = "textLayer";

        // Render text content
        const textContent = await page.getTextContent();
        console.log("Text items:", textContent.items.length);

        // Create text layer spans
        textContent.items.forEach((item: any) => {
            if (!item.str) return;

            const span = document.createElement("span");
            span.textContent = item.str;

            const tx = item.transform;
            const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);

            span.style.position = "absolute";
            span.style.left = `${tx[4] * scale.value}px`;
            span.style.bottom = `${tx[5] * scale.value}px`;
            span.style.fontSize = `${fontHeight * scale.value}px`;
            span.style.fontFamily = item.fontName || "sans-serif";
            span.style.whiteSpace = "pre";
            span.style.color = "transparent";
            span.style.userSelect = "text";
            span.style.pointerEvents = "all";

            if (item.width) {
                span.style.width = `${item.width * scale.value}px`;
                span.style.overflow = "visible";
            }

            textLayer.appendChild(span);
        });

        console.log(
            "Text layer rendered, total spans:",
            textLayer.children.length,
        );

        return { width: newWidth, height: newHeight };
    } catch (error: any) {
        if (error?.name !== "RenderingCancelledException") {
            console.error("Error rendering page:", error);
        }
        return { width: 0, height: 0 };
    } finally {
        // Only set isRendering to false if this is still the current render
        if (currentRenderingPage === thisRenderPage) {
            isRendering.value = false;
            console.log("isRendering set to false");
        }
    }
}

async function loadPDF() {
    if (!props.filePath) return;
    isLoading.value = true;
    currentPage.value = 1;

    try {
        console.log("Loading PDF:", props.filePath);
        const fileData = await readFile(props.filePath);
        console.log("File loaded, size:", fileData.length);

        const loadingTask = getDocument({ data: fileData });
        pdfDoc.value = await loadingTask.promise;
        totalPages.value = pdfDoc.value.numPages;

        console.log("PDF loaded, pages:", totalPages.value);

        // Wait for container to be ready
        await new Promise((resolve) => setTimeout(resolve, 150));

        if (pdfDoc.value && containerRef.value) {
            const page = await pdfDoc.value.getPage(1);
            const containerWidth = containerRef.value.clientWidth;
            const viewport = page.getViewport({ scale: 1 });
            scale.value = containerWidth / viewport.width;
        }

        if (frontCanvasRef.value && frontTextLayerRef.value) {
            const { width, height } = await renderPage(
                1,
                frontCanvasRef.value,
                frontTextLayerRef.value,
            );
            pageWidth.value = width;
            pageHeight.value = height;
        }
    } catch (err) {
        console.error("PDF load error:", err);
    } finally {
        isLoading.value = false;
    }
}

// =======================
// PAGE CONTROLS
// =======================
async function handleNextPage() {
    if (currentPage.value < totalPages.value) {
        currentPage.value++;
        const canvas =
            activeCanvasName.value === "front"
                ? frontCanvasRef.value
                : backCanvasRef.value;
        const textLayer =
            activeCanvasName.value === "front"
                ? frontTextLayerRef.value
                : backTextLayerRef.value;
        if (canvas && textLayer) {
            const { width, height } = await renderPage(
                currentPage.value,
                canvas,
                textLayer,
            );
            pageWidth.value = width;
            pageHeight.value = height;
        }
    }
}

async function handlePrevPage() {
    if (currentPage.value > 1) {
        currentPage.value--;
        const canvas =
            activeCanvasName.value === "front"
                ? frontCanvasRef.value
                : backCanvasRef.value;
        const textLayer =
            activeCanvasName.value === "front"
                ? frontTextLayerRef.value
                : backTextLayerRef.value;
        if (canvas && textLayer) {
            const { width, height } = await renderPage(
                currentPage.value,
                canvas,
                textLayer,
            );
            pageWidth.value = width;
            pageHeight.value = height;
        }
    }
}

function handleBack() {
    emit("back");
}

function handleZoomIn() {
    if (liveCssScale.value < MAX_ZOOM) {
        liveCssScale.value = Math.min(MAX_ZOOM, liveCssScale.value + ZOOM_STEP);

        // Schedule re-render after button zoom
        clearTimeout(zoomRenderTimeout);
        zoomRenderTimeout = setTimeout(async () => {
            if (pdfDoc.value && containerRef.value && !isRendering.value) {
                // Determine front and back buffers
                const backCanvas =
                    activeCanvasName.value === "front"
                        ? backCanvasRef.value
                        : frontCanvasRef.value;
                const backTextLayer =
                    activeCanvasName.value === "front"
                        ? backTextLayerRef.value
                        : frontTextLayerRef.value;

                if (!backCanvas || !backTextLayer) return;

                // Save current scroll position
                const container = containerRef.value;
                const scrollLeft = container.scrollLeft;
                const scrollTop = container.scrollTop;
                const oldWidth = pageWidth.value * liveCssScale.value;
                const oldHeight = pageHeight.value * liveCssScale.value;

                const scrollXPercent =
                    oldWidth > 0
                        ? (scrollLeft + container.clientWidth / 2) / oldWidth
                        : 0.5;
                const scrollYPercent =
                    oldHeight > 0
                        ? (scrollTop + container.clientHeight / 2) / oldHeight
                        : 0.5;

                // Update base scale and re-render on the back buffer
                scale.value = scale.value * liveCssScale.value;
                const { width, height } = await renderPage(
                    currentPage.value,
                    backCanvas,
                    backTextLayer,
                );

                // Swap buffers and update dimensions
                activeCanvasName.value =
                    activeCanvasName.value === "front" ? "back" : "front";
                pageWidth.value = width;
                pageHeight.value = height;
                liveCssScale.value = 1.0; // Reset live scale

                // Restore scroll position after render
                await new Promise((resolve) => setTimeout(resolve, 50));

                container.scrollLeft =
                    scrollXPercent * width - container.clientWidth / 2;
                container.scrollTop =
                    scrollYPercent * height - container.clientHeight / 2;
            }
        }, 300);
    }
}

function handleZoomOut() {
    if (liveCssScale.value > MIN_ZOOM) {
        liveCssScale.value = Math.max(
            MIN_ZOOM,

            liveCssScale.value - ZOOM_STEP,
        );

        // Schedule re-render after button zoom

        clearTimeout(zoomRenderTimeout);

        zoomRenderTimeout = setTimeout(async () => {
            if (pdfDoc.value && containerRef.value && !isRendering.value) {
                // Determine front and back buffers

                const backCanvas =
                    activeCanvasName.value === "front"
                        ? backCanvasRef.value
                        : frontCanvasRef.value;

                const backTextLayer =
                    activeCanvasName.value === "front"
                        ? backTextLayerRef.value
                        : frontTextLayerRef.value;

                if (!backCanvas || !backTextLayer) return;

                // Save current scroll position

                const container = containerRef.value;

                const scrollLeft = container.scrollLeft;

                const scrollTop = container.scrollTop;

                const oldWidth = pageWidth.value * liveCssScale.value;

                const oldHeight = pageHeight.value * liveCssScale.value;

                const scrollXPercent =
                    oldWidth > 0
                        ? (scrollLeft + container.clientWidth / 2) / oldWidth
                        : 0.5;

                const contentOffsetX =
                    oldWidth < container.clientWidth
                        ? (container.clientWidth - oldWidth) / 2
                        : 0;
                const scrollYPercent =
                    oldHeight > 0
                        ? (scrollTop + container.clientHeight / 2) / oldHeight
                        : 0.5;

                // Update base scale and re-render on the back buffer

                scale.value = scale.value * liveCssScale.value;

                const { width, height } = await renderPage(
                    currentPage.value,

                    backCanvas,

                    backTextLayer,
                );

                // Swap buffers and update dimensions

                activeCanvasName.value =
                    activeCanvasName.value === "front" ? "back" : "front";

                pageWidth.value = width;

                pageHeight.value = height;

                liveCssScale.value = 1.0; // Reset live scale

                // Restore scroll position after render

                await new Promise((resolve) => setTimeout(resolve, 50));

                container.scrollLeft =
                    scrollXPercent * width - container.clientWidth / 2;

                container.scrollTop =
                    scrollYPercent * height - container.clientHeight / 2;
            }
        }, 300);
    }
}

// =======================
// TEXT SELECTION LOGIC
// =======================
let lastSelection = "";

function handleSelectionChange() {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();

    const activeTextLayer =
        activeCanvasName.value === "front"
            ? frontTextLayerRef.value
            : backTextLayerRef.value;

    // Only process if selection is within our text layer
    if (text && activeTextLayer) {
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (range && activeTextLayer.contains(range.commonAncestorContainer)) {
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
function buildTextIndexMap(textLayer: HTMLDivElement | null) {
    if (!textLayer)
        return {
            fullText: "",
            map: [] as Array<{ node: Node; offset: number }>,
        };

    let fullText = "";
    const map: Array<{ node: Node; offset: number }> = [];

    for (const spanEl of Array.from(textLayer.children)) {
        const textNode =
            spanEl.firstChild && spanEl.firstChild.nodeType === Node.TEXT_NODE
                ? (spanEl.firstChild as Node)
                : null;
        const spanText = spanEl.textContent || "";

        if (!spanText) continue;

        if (textNode) {
            for (let i = 0; i < spanText.length; i++) {
                map.push({ node: textNode, offset: i });
                fullText += spanText[i];
            }
        } else {
            for (let i = 0; i < spanText.length; i++) {
                map.push({ node: spanEl, offset: i });
                fullText += spanText[i];
            }
        }
    }

    return { fullText, map };
}

function getSelectionGlobalIndices(): {
    startIdx: number;
    endIdx: number;
} | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    const activeTextLayer =
        activeCanvasName.value === "front"
            ? frontTextLayerRef.value
            : backTextLayerRef.value;
    const { map, fullText } = buildTextIndexMap(activeTextLayer);

    if (!map.length) return null;

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

    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < map.length; i++) {
        const entry = map[i];
        if (entry.node === sNode && entry.offset === sOffset) {
            startIdx = i;
            break;
        }
    }

    for (let i = 0; i < map.length; i++) {
        const entry = map[i];
        if (entry.node === eNode && entry.offset === eOffset) {
            endIdx = i;
            break;
        }
    }

    if (startIdx !== -1 && endIdx !== -1) return { startIdx, endIdx };

    const selText = sel.toString();
    if (!selText) return null;

    const idx = fullText.indexOf(selText);
    if (idx !== -1) {
        return { startIdx: idx, endIdx: idx + selText.length };
    }

    return null;
}

function setSelectionFromGlobalIndices(startIdx: number, endIdx: number) {
    const activeTextLayer =
        activeCanvasName.value === "front"
            ? frontTextLayerRef.value
            : backTextLayerRef.value;
    const { map } = buildTextIndexMap(activeTextLayer);
    if (!map.length) return;

    const s = Math.max(0, Math.min(startIdx, map.length));
    const e = Math.max(0, Math.min(endIdx, map.length));

    if (s >= e) {
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
        lastSelection = "";
        selectedText.value = "";
        emit("selectionClear");
        return;
    }

    const startEntry = map[s];
    const startNode =
        startEntry.node.nodeType === Node.ELEMENT_NODE &&
        startEntry.node.firstChild
            ? startEntry.node.firstChild!
            : startEntry.node;
    const startOffset = startEntry.offset;

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

function adjustSelection(delta: number) {
    const indices = getSelectionGlobalIndices();
    if (!indices) return;

    let { startIdx, endIdx } = indices;
    const { fullText } = buildTextIndexMap();

    if (delta < 0) {
        endIdx = Math.max(startIdx + 1, endIdx + delta);
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

function toggleToolbar() {
    isToolbarVisible.value = !isToolbarVisible.value;
}

function handlePageClick(event: MouseEvent) {
    const activeTextLayer =
        activeCanvasName.value === "front"
            ? frontTextLayerRef.value
            : backTextLayerRef.value;
    if (activeTextLayer && activeTextLayer.contains(event.target as Node)) {
        return;
    }

    const container = pageWrapperRef.value;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const containerWidth = rect.width; // Use actual rendered width (with zoom applied)

    const deadZonePercentage = 0.3;
    const sideWidth = (containerWidth * (1 - deadZonePercentage)) / 2;

    const isPaginationToolbarActive = !selectedText.value;

    if (isPaginationToolbarActive) {
        if (clickX < sideWidth) {
            handlePrevPage();
        } else if (clickX > containerWidth - sideWidth) {
            handleNextPage();
        } else {
            toggleToolbar();
        }
    }
}

let resizeTimeout: any = null;
async function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(async () => {
        if (pdfDoc.value && !isRendering.value && containerRef.value) {
            const page = await pdfDoc.value.getPage(currentPage.value);
            const containerWidth = containerRef.value.clientWidth;
            const viewport = page.getViewport({ scale: 1 });
            scale.value = containerWidth / viewport.width;

            const canvas =
                activeCanvasName.value === "front"
                    ? frontCanvasRef.value
                    : backCanvasRef.value;
            const textLayer =
                activeCanvasName.value === "front"
                    ? frontTextLayerRef.value
                    : backTextLayerRef.value;
            if (canvas && textLayer) {
                const { width, height } = await renderPage(
                    currentPage.value,
                    canvas,
                    textLayer,
                );
                pageWidth.value = width;
                pageHeight.value = height;
            }
        }
    }, 300);
}

// =======================
// PINCH TO ZOOM
// =======================
let initialPinchDistance = 0;
let initialZoom = 1.0;
let zoomRenderTimeout: any = null;

function getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function handleTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
        event.preventDefault();
        initialPinchDistance = getTouchDistance(
            event.touches[0],
            event.touches[1],
        );
        initialZoom = liveCssScale.value;

        // Clear any pending render
        clearTimeout(zoomRenderTimeout);
    }
}

function handleTouchMove(event: TouchEvent) {
    if (event.touches.length === 2) {
        event.preventDefault();
        const currentDistance = getTouchDistance(
            event.touches[0],
            event.touches[1],
        );
        const scale = currentDistance / initialPinchDistance;
        const newZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, initialZoom * scale),
        );
        liveCssScale.value = newZoom;

        // Clear any pending render while still zooming
        clearTimeout(zoomRenderTimeout);
    }
}

function handleTouchEnd(event: TouchEvent) {
    if (event.touches.length < 2) {
        initialPinchDistance = 0;

        // User finished zooming, schedule a re-render
        clearTimeout(zoomRenderTimeout);
        zoomRenderTimeout = setTimeout(async () => {
            if (pdfDoc.value && containerRef.value && !isRendering.value) {
                // The canvas that was just zoomed via CSS
                const frontCanvas =
                    activeCanvasName.value === "front"
                        ? frontCanvasRef.value
                        : backCanvasRef.value;
                // The canvas we will render on
                const backCanvas =
                    activeCanvasName.value === "front"
                        ? backCanvasRef.value
                        : frontCanvasRef.value;
                const backTextLayer =
                    activeCanvasName.value === "front"
                        ? backTextLayerRef.value
                        : frontTextLayerRef.value;

                if (!frontCanvas || !backCanvas || !backTextLayer) return;

                // Center the scaled canvas. The transform-origin: center takes care of this.
                // The user mentioned centering it, let's ensure scroll position is maintained.
                const container = containerRef.value;
                const scrollLeft = container.scrollLeft;
                const scrollTop = container.scrollTop;
                const oldWidth = pageWidth.value * liveCssScale.value;
                const oldHeight = pageHeight.value * liveCssScale.value;

                const scrollXPercent =
                    oldWidth > 0
                        ? (scrollLeft + container.clientWidth / 2) / oldWidth
                        : 0.5;
                const scrollYPercent =
                    oldHeight > 0
                        ? (scrollTop + container.clientHeight / 2) / oldHeight
                        : 0.5;

                // Update base scale to incorporate the new zoom level
                const zoomToApply = liveCssScale.value;
                scale.value = scale.value * zoomToApply;

                // Re-render on the back buffer
                const { width, height } = await renderPage(
                    currentPage.value,
                    backCanvas,
                    backTextLayer,
                );

                // --- SWAP BUFFERS ---
                // 1. Switch visibility
                const newActive =
                    activeCanvasName.value === "front" ? "back" : "front";
                activeCanvasName.value = newActive;

                // 2. Update dimensions
                pageWidth.value = width;
                pageHeight.value = height;

                // 3. After 10ms, switch z-indices
                setTimeout(() => {
                    if (newActive === "front") {
                        frontZIndex.value = 2;
                        backZIndex.value = 1;
                    } else {
                        frontZIndex.value = 1;
                        backZIndex.value = 2;
                    }
                }, 10);

                // Reset the live CSS scale for the new front buffer
                liveCssScale.value = 1.0;

                // Restore scroll position for the newly rendered canvas
                await new Promise((resolve) => setTimeout(resolve, 50));
                container.scrollLeft =
                    scrollXPercent * width - container.clientWidth / 2;
                container.scrollTop =
                    scrollYPercent * height - container.clientHeight / 2;
            }
        }, 100); // Reduced delay for faster re-render after pinch
    }
}

onMounted(() => {
    window.addEventListener("resize", handleResize);
    document.addEventListener("selectionchange", handleSelectionChange);

    // Prevent browser zoom completely
    const preventZoom = (e: WheelEvent | TouchEvent) => {
        if (e instanceof WheelEvent && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
        }
        // Prevent pinch zoom
        if (e instanceof TouchEvent && e.touches.length > 1) {
            e.preventDefault();
        }
    };

    document.addEventListener("wheel", preventZoom, { passive: false });
    document.addEventListener("touchmove", preventZoom, { passive: false });

    // Add touch handlers to container for pinch zoom
    const container = containerRef.value;
    if (container) {
        container.addEventListener("touchstart", handleTouchStart, {
            passive: false,
        });
        container.addEventListener("touchmove", handleTouchMove, {
            passive: false,
        });
        container.addEventListener("touchend", handleTouchEnd, {
            passive: false,
        });
    }

    // Prevent iOS Safari zoom
    document.addEventListener(
        "gesturestart",
        (e) => {
            e.preventDefault();
        },
        { passive: false },
    );

    loadPDF();
});

onUnmounted(() => {
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("selectionchange", handleSelectionChange);

    const preventZoom = (e: WheelEvent | TouchEvent) => {
        if (e instanceof WheelEvent && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
        }
        if (e instanceof TouchEvent && e.touches.length > 1) {
            e.preventDefault();
        }
    };

    document.removeEventListener("wheel", preventZoom);
    document.removeEventListener("touchmove", preventZoom);
    document.removeEventListener("gesturestart", (e) => {
        e.preventDefault();
    });

    const container = containerRef.value;
    if (container) {
        container.removeEventListener("touchstart", handleTouchStart);
        container.removeEventListener("touchmove", handleTouchMove);
        container.removeEventListener("touchend", handleTouchEnd);
    }

    if (renderTask) {
        renderTask.cancel();
    }
    clearTimeout(resizeTimeout);
    clearTimeout(zoomRenderTimeout);
});

watch(
    () => props.filePath,
    () => {
        currentPage.value = 1;
        loadPDF();
    },
);

watch(selectedText, (newVal) => {
    if (newVal) {
        isToolbarVisible.value = true;
    }
});
</script>

<template>
    <div
        class="relative flex flex-col h-screen w-screen bg-gray-100 overflow-hidden"
    >
        <div
            ref="containerRef"
            class="flex-1 overflow-auto bg-white flex items-center justify-center"
        >
            <div
                v-if="isLoading"
                class="absolute inset-0 flex flex-col items-center justify-center text-gray-600 bg-white z-10"
            >
                <div
                    class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
                ></div>
                <p class="mt-4">Loading PDF...</p>
            </div>
            <div
                ref="pageWrapperRef"
                class="touch-none fixed w-full h-screen bg-white"
                :style="{
                    width: pageWidth ? `${pageWidth}px` : '100%',
                    height: pageHeight ? `${pageHeight}px` : 'auto',
                    visibility: isLoading ? 'hidden' : 'visible',
                }"
                @click="handlePageClick"
            >
                <!-- Front Buffer -->
                <canvas
                    ref="frontCanvasRef"
                    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    :style="{
                        width: pageWidth ? `${pageWidth}px` : '100%',
                        height: pageHeight ? `${pageHeight}px` : 'auto',
                        visibility:
                            activeCanvasName === 'front' ? 'visible' : 'hidden',
                        zIndex: frontZIndex,
                        transform:
                            activeCanvasName === 'front'
                                ? `scale(${liveCssScale})`
                                : 'none',
                        transformOrigin: 'center center',
                    }"
                ></canvas>
                <div
                    ref="frontTextLayerRef"
                    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 textLayer"
                    :style="{
                        width: pageWidth ? `${pageWidth}px` : '100%',
                        height: pageHeight ? `${pageHeight}px` : 'auto',
                        visibility:
                            activeCanvasName === 'front' ? 'visible' : 'hidden',
                        zIndex: frontZIndex,
                        transform:
                            activeCanvasName === 'front'
                                ? `scale(${liveCssScale})`
                                : 'none',
                        transformOrigin: 'center center',
                    }"
                ></div>

                <!-- Back Buffer -->
                <canvas
                    ref="backCanvasRef"
                    class="absolute top-0 left-0"
                    :style="{
                        width: pageWidth ? `${pageWidth}px` : '100%',
                        height: pageHeight ? `${pageHeight}px` : 'auto',
                        visibility:
                            activeCanvasName === 'back' ? 'visible' : 'hidden',
                        zIndex: backZIndex,
                        transform:
                            activeCanvasName === 'back'
                                ? `scale(${liveCssScale})`
                                : 'none',
                        transformOrigin: 'center center',
                    }"
                ></canvas>
                <div
                    ref="backTextLayerRef"
                    class="absolute top-0 left-0 textLayer"
                    :style="{
                        width: pageWidth ? `${pageWidth}px` : '100%',
                        height: pageHeight ? `${pageHeight}px` : 'auto',
                        visibility:
                            activeCanvasName === 'back' ? 'visible' : 'hidden',
                        zIndex: backZIndex,
                        transform:
                            activeCanvasName === 'back'
                                ? `scale(${liveCssScale})`
                                : 'none',
                        transformOrigin: 'center center',
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
            :scale="liveCssScale"
            class="transition-transform duration-300 ease-in-out"
            :class="{
                'translate-y-full landscape:translate-y-[calc(100%+1rem)]':
                    !isToolbarVisible,
            }"
            @back="handleBack"
            @next-page="handleNextPage"
            @prev-page="handlePrevPage"
            @shrink-selection="handleShrinkSelection"
            @expand-selection="handleExpandSelection"
            @lookup-selection="handleLookupSelection"
            @zoom-in="handleZoomIn"
            @zoom-out="handleZoomOut"
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
    letter-spacing: normal !important;
}

.textLayer span::selection {
    background: rgba(0, 123, 255, 0.3);
    color: transparent;
}

.textLayer span::-moz-selection {
    background: rgba(0, 123, 255, 0.3);
    color: transparent;
}

/* Override pdf_viewer.css letter-spacing */
:deep(.textLayer span) {
    letter-spacing: normal !important;
}
</style>
