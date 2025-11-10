<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Button } from "@/components/ui/button";
import { open } from "@tauri-apps/plugin-dialog";
import PdfViewer from "@/components/PdfViewer.vue";

const selectedFilePath = ref<string | null>(null);
const showPdfViewer = ref(false);

async function selectFile() {
    const selected = await open({
        multiple: false,
        filters: [
            {
                name: "PDF",
                extensions: ["pdf"],
            },
        ],
    });
    if (typeof selected === "string") {
        selectedFilePath.value = selected;
        showPdfViewer.value = true;
    }
}

function goBack() {
    showPdfViewer.value = false;
    selectedFilePath.value = null;
}

onMounted(() => {
    console.log("hi mom");
});
</script>

<template>
    <div
        :class="[
            'w-full h-screen',
            showPdfViewer ? '' : 'grid place-items-center',
        ]"
    >
        <transition name="fade" mode="out-in">
            <div v-if="!showPdfViewer" class="text-center">
                <Button @click="selectFile">Select PDF</Button>
            </div>
            <div v-else-if="selectedFilePath" class="w-full h-full">
                <PdfViewer :file-path="selectedFilePath" @back="goBack" />
            </div>
        </transition>
    </div>
</template>

<style>
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
