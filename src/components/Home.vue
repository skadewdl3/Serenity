<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Book, File } from "lucide-vue-next";
import FileDetailsDrawer from "./FileDetailsDrawer.vue";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const quotes = [
    "I'm not addicted to reading. I can quit as soon as I finish one more chapter.",
    "So many books, so little time.",
    "Sleep is just a time machine to breakfast. Reading is a time machine to anywhere.",
    "My workout is reading in bed until my arms fall asleep.",
    "I like to party, and by party I mean read books.",
    "Never judge a book by its movie.",
    "A book a day keeps reality away.",
];

const quote = ref("");

interface FileInfo {
    path: string;
    uri: string;
    file_type: string;
    name: string;
    lastOpened?: number;
}

const recentFiles = ref<FileInfo[]>([]);
const totalRecentFiles = ref(0);
const selectedFile = ref<FileInfo | null>(null);
const isDrawerOpen = ref(false);

const emit = defineEmits<{
    (e: "open-file", file: FileInfo): void;
    (e: "see-more"): void;
}>();

async function loadRecentFiles() {
    try {
        const filesRaw = localStorage.getItem("recentFiles");
        const files = filesRaw ? JSON.parse(filesRaw) : [];
        totalRecentFiles.value = files.length;
        if (files) {
            recentFiles.value = files.slice(0, 5);
        }
    } catch (e) {
        console.error(
            "Failed to load or parse recent files from localStorage",
            e,
        );
        recentFiles.value = [];
        totalRecentFiles.value = 0;
    }
}

function openFile(file: FileInfo) {
    emit("open-file", file);
    isDrawerOpen.value = false;
}

function removeRecentFile(path: string) {
    const filesRaw = localStorage.getItem("recentFiles") || "[]";
    const files = JSON.parse(filesRaw) as FileInfo[];
    const newFiles = files.filter((file) => file.path !== path);
    localStorage.setItem("recentFiles", JSON.stringify(newFiles));
    totalRecentFiles.value = newFiles.length;
    recentFiles.value = newFiles.slice(0, 5);
    isDrawerOpen.value = false;
    selectedFile.value = null;
}

function handleFileClick(file: FileInfo) {
    selectedFile.value = file;
    isDrawerOpen.value = true;
}

onMounted(() => {
    loadRecentFiles();
    quote.value = quotes[Math.floor(Math.random() * quotes.length)];
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
    <div class="w-full max-w-4xl mx-auto p-8 h-full">
        <!-- Centered layout when no recents -->
        <div
            v-if="recentFiles.length === 0"
            class="flex flex-col items-center justify-center text-center h-full"
        >
            <h1 class="text-6xl font-bold">Serenity</h1>
            <p class="text-lg text-gray-500 mt-4 italic">"{{ quote }}"</p>
        </div>

        <!-- Top-aligned layout when recents are present -->
        <div v-else class="pt-16">
            <div class="text-center mb-8">
                <h1 class="text-6xl font-bold">Serenity</h1>
                <p class="text-md text-gray-500 mt-2 italic">"{{ quote }}"</p>
            </div>

            <hr class="mb-8 border-t border-gray-200 dark:border-gray-800" />

            <h2 class="text-2xl text-center font-bold mb-4">Recents</h2>
            <div class="flex flex-col">
                <template v-for="(file, index) in recentFiles" :key="file.path">
                    <div
                        class="py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-4"
                        @click="() => handleFileClick(file)"
                    >
                        <component
                            :is="fileTypeToIcon(file.file_type)"
                            class="w-10 h-10 text-gray-500 shrink-0"
                        />
                        <div class="grow truncate">
                            <p class="text-sm font-medium truncate">
                                {{ file.name }}
                            </p>
                            <p class="text-xs text-gray-500">
                                {{ formatTimeAgo(file.lastOpened) }}
                            </p>
                        </div>
                    </div>
                    <div
                        v-if="index < recentFiles.length - 1"
                        class="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent"
                    ></div>
                </template>
                <div v-if="totalRecentFiles > 5" class="py-4 text-center">
                    <a
                        @click="$emit('see-more')"
                        class="text-blue-500 underline cursor-pointer"
                    >
                        See more
                    </a>
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
