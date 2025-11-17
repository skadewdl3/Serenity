<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Button } from "@/components/ui/button";
import PdfViewerWrapper from "@/components/PdfViewerWrapper.vue";
import Home from "@/components/Home.vue";
import Recents from "@/components/Recents.vue";
import { invoke } from "@tauri-apps/api/core";
import { FilePlus } from "lucide-vue-next";
import emitter, { type RecentFile } from "@/lib/events";

const transitionName = ref("fade");

const selectedFilePath = ref<string | null>(null);
const showPdfViewer = ref(false);
const showRecents = ref(false);

async function selectFile() {
    transitionName.value = "slide-left";
    try {
        const fileInfo = await invoke<RecentFile>("pick_file_with_metdata");
        if (fileInfo) {
            await addFileToStore(fileInfo);
            selectedFilePath.value = fileInfo.path;
            showPdfViewer.value = true;
        }
    } catch (error) {
        console.error("Failed to pick file with metadata:", error);
    }
}

async function openFile(fileInfo: RecentFile) {
    transitionName.value = "slide-left";
    await addFileToStore(fileInfo);
    selectedFilePath.value = fileInfo.path;
    showPdfViewer.value = true;
}

async function addFileToStore(fileInfo: RecentFile) {
    emitter.emit("createRecentsEntry", {
        ...fileInfo,
        lastOpened: Date.now(),
    });
}

function goBack() {
    transitionName.value = "slide-right";
    showPdfViewer.value = false;
    selectedFilePath.value = null;
}

function handleSeeMore() {
    transitionName.value = "slide-left";
    showRecents.value = true;
}

function handleRecentsBack() {
    transitionName.value = "slide-right";
    showRecents.value = false;
}

onMounted(() => {
    console.log("hi mom");
});
</script>

<template>
    <div :class="['w-full h-screen', 'overflow-hidden']">
        <transition :name="transitionName" mode="out-in">
            <div
                v-if="!showPdfViewer"
                class="h-full relative flex justify-center"
            >
                <Home
                    v-if="!showRecents"
                    @open-file="openFile"
                    @see-more="handleSeeMore"
                />
                <Recents
                    v-else
                    @open-file="openFile"
                    @back="handleRecentsBack"
                />
                <Button
                    @click="selectFile"
                    class="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-lg"
                >
                    <FilePlus class="h-8 w-8" />
                </Button>
            </div>
            <div v-else-if="selectedFilePath" class="w-full h-full">
                <PdfViewerWrapper
                    :file-path="selectedFilePath"
                    @back="goBack"
                />
            </div>
        </transition>
    </div>
</template>

<style>
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
    transition: all 0.3s ease-out;
    position: absolute;
    width: 100%;
}

.slide-left-enter-from {
    transform: translateX(100%);
    opacity: 0;
}
.slide-left-leave-to {
    transform: translateX(-100%);
    opacity: 0;
}

.slide-right-enter-from {
    transform: translateX(-100%);
    opacity: 0;
}
.slide-right-leave-to {
    transform: translateX(100%);
    opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
    transition:
        opacity 0.3s,
        transform 0.3s;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: translateX(20px);
}
.fade-leave-from,
.fade-enter-to {
    opacity: 1;
    transform: translateX(0);
}
</style>
