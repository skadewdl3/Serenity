<script setup lang="ts">
import { ref, onMounted } from "vue";
import { FileText, Book, File, ArrowLeft } from "lucide-vue-next";
import FileDetailsDrawer from "./FileDetailsDrawer.vue";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Button } from "@/components/ui/button";
import emitter, { type RecentFile as FileInfo } from "@/lib/events";

dayjs.extend(relativeTime);

const recentFiles = ref<FileInfo[]>([]);
const selectedFile = ref<FileInfo | null>(null);
const isDrawerOpen = ref(false);

const emit = defineEmits<{
    (e: "open-file", file: FileInfo): void;
    (e: "back"): void;
}>();

async function loadRecentFiles() {
    try {
        const filesRaw = localStorage.getItem("recentFiles");
        const files = filesRaw ? JSON.parse(filesRaw) : [];
        if (files) {
            recentFiles.value = files;
        }
    } catch (e) {
        console.error(
            "Failed to load or parse recent files from localStorage",
            e,
        );
        recentFiles.value = []; // Reset to empty array on error
    }
}

function openFile(file: FileInfo) {
    emit("open-file", file);
    isDrawerOpen.value = false;
}

function removeRecentFile(path: string) {
    emitter.emit("deleteRecentsEntry", path);
    loadRecentFiles();
    isDrawerOpen.value = false;
    selectedFile.value = null;
}

function handleFileClick(file: FileInfo) {
    selectedFile.value = file;
    isDrawerOpen.value = true;
}

onMounted(loadRecentFiles);

const fileTypeToIcon = (fileType: string) => {
    if (fileType.startsWith("application/pdf")) {
        return Book;
    }
    return File;
};

function formatTimeAgo(timestamp?: number): string {
    if (!timestamp) return "Never";
    const date = dayjs(timestamp);
    const now = dayjs();
    if (now.diff(date, "day") > 7) {
        return date.format("YYYY-MM-DD");
    }
    return date.fromNow();
}
</script>

<template>
    <div
        class="w-full max-w-4xl mx-auto h-screen flex flex-col bg-white dark:bg-black"
    >
        <div
            class="flex-shrink-0 px-2 py-4 mt-8 bg-white/90 dark:bg-black/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 z-10"
        >
            <div class="flex items-center">
                <Button
                    @click="$emit('back')"
                    variant="ghost"
                    size="icon"
                    class="mr-2"
                >
                    <ArrowLeft class="h-6 w-6" />
                </Button>
                <h1 class="text-2xl font-bold">Recents</h1>
            </div>
        </div>

        <div class="overflow-y-auto px-6">
            <div
                v-if="recentFiles.length === 0"
                class="text-gray-500 text-center py-10"
            >
                No recent documents.
            </div>
            <div
                v-else
                class="flex flex-col divide-y divide-gray-200 dark:divide-gray-800"
            >
                <div
                    v-for="file in [
                        ...recentFiles,
                        ...recentFiles,
                        ...recentFiles,
                    ]"
                    :key="file.path"
                    class="py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-4"
                    @click="() => handleFileClick(file)"
                >
                    <component
                        :is="fileTypeToIcon(file.file_type)"
                        class="w-10 h-10 text-gray-500 flex-shrink-0"
                    />
                    <div class="flex-grow truncate">
                        <p class="text-sm font-medium truncate">
                            {{ file.name }}
                        </p>
                        <p class="text-xs text-gray-500">
                            {{ formatTimeAgo(file.lastOpened) }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <FileDetailsDrawer
            v-model:open="isDrawerOpen"
            :file="selectedFile"
            @open-file="openFile"
            @remove-file="removeRecentFile"
        />
    </div>
</template>
