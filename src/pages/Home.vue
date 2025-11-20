<script setup lang="ts">
import { ref, onMounted, onActivated } from "vue";
import { Book, File } from "lucide-vue-next";
import FileDetailsDrawer from "@/components/FileDetailsDrawer.vue";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";

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

const router = useRouter();
const store = useAppStore();

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
    store.openFile(file);
    store.pushRoute('Viewer');
    router.push({ name: 'Viewer' });
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

function handleSeeMore() {
    store.pushRoute('Recents');
    router.push({ name: 'Recents' });
}

onMounted(() => {
    loadRecentFiles();
    quote.value = quotes[Math.floor(Math.random() * quotes.length)];
});

onActivated(() => {
    loadRecentFiles();
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
        class="w-full max-w-4xl mx-auto p-8 h-screen bg-background text-foreground relative"
    >
        <!-- Centered layout when no recents -->
        <div
            v-if="recentFiles.length === 0"
            class="flex flex-col items-center justify-center text-center h-full pb-20"
        >
            <h1 class="text-6xl font-bold font-serif">Serenity</h1>
            <p class="text-lg text-muted-foreground mt-4 italic">
                "{{ quote }}"
            </p>
        </div>

        <!-- Top-aligned layout when recents are present -->
        <div v-else class="pt-16 pb-32">
            <div class="text-center mb-12">
                <h1 class="text-6xl font-bold font-serif">Serenity</h1>
                <p class="text-md text-muted-foreground mt-2 italic">
                    "{{ quote }}"
                </p>
            </div>

            <div class="flex flex-col gap-6">
                <template v-for="(file, index) in recentFiles" :key="file.path">
                    <div
                        class="flex cursor-pointer items-center gap-6 py-2 hover:bg-accent/50 rounded-lg px-4 transition-colors"
                        @click="() => handleFileClick(file)"
                    >
                        <component
                            :is="fileTypeToIcon(file.file_type)"
                            class="h-10 w-10 shrink-0 text-primary"
                        />
                        <div class="grow truncate">
                            <p
                                class="truncate text-base font-medium text-foreground"
                            >
                                {{ file.name }}
                            </p>
                            <p class="text-sm text-muted-foreground">
                                {{ formatTimeAgo(file.lastOpened) }}
                            </p>
                        </div>
                    </div>
                    <div
                        v-if="index < recentFiles.length - 1"
                        class="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4"
                    ></div>
                </template>
                <div v-if="totalRecentFiles > 5" class="py-6 text-center">
                    <a
                        class="cursor-pointer text-primary font-medium hover:text-primary/80 transition-colors"
                        @click="handleSeeMore"
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
