<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Book, File, ArrowLeft } from "lucide-vue-next";
import FileDetailsDrawer from "@/components/FileDetailsDrawer.vue";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Button } from "@/components/ui/button";
import emitter, { type RecentFile as FileInfo } from "@/lib/events";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";

dayjs.extend(relativeTime);

const recentFiles = ref<FileInfo[]>([]);
const selectedFile = ref<FileInfo | null>(null);
const isDrawerOpen = ref(false);

const router = useRouter();
const store = useAppStore();

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
    store.openFile(file);
    store.pushRoute('Viewer');
    router.push({ name: 'Viewer' });
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



onMounted(() => {
    loadRecentFiles();
    emitter.on('refreshRecents', loadRecentFiles);
});

onUnmounted(() => {
    emitter.off('refreshRecents', loadRecentFiles);
});

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
        class="w-full max-w-4xl mx-auto h-screen flex flex-col bg-background text-foreground"
    >
        <div
            class="shrink-0 px-2 py-4 mt-8 bg-background/90 backdrop-blur-sm border-b border-border z-10"
        >
            <div class="flex items-center">
                <Button
                    variant="ghost"
                    size="icon"
                    class="mr-2 hover:bg-accent"
                    @click="emitter.emit('goBack')"
                >
                    <ArrowLeft class="h-6 w-6 text-foreground" />
                </Button>
                <h1 class="text-2xl font-bold text-foreground">Recents</h1>
            </div>
        </div>

        <div class="overflow-y-auto px-6">
            <div
                v-if="recentFiles.length === 0"
                class="py-10 text-center text-muted-foreground"
            >
                No recent documents.
            </div>
            <div v-else class="flex flex-col divide-y divide-border">
                <div
                    v-for="file in recentFiles"
                    :key="file.path"
                    class="flex cursor-pointer items-center gap-4 py-4 hover:bg-accent"
                    @click="() => handleFileClick(file)"
                >
                    <component
                        :is="fileTypeToIcon(file.file_type)"
                        class="h-10 w-10 flex-shrink-0 text-muted-foreground"
                    />
                    <div class="flex-grow truncate">
                        <p class="truncate text-sm font-medium text-foreground">
                            {{ file.name }}
                        </p>
                        <p class="text-xs text-muted-foreground">
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
