<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { FilePlus, Settings } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import { useRouter } from 'vue-router';
import { invoke } from '@tauri-apps/api/core';
import { type RecentFile } from '@/lib/events';

const store = useAppStore();
const router = useRouter();

async function handleOpenFile() {
    try {
        const fileInfo = await invoke<RecentFile>("pick_file_with_metdata");
        if (fileInfo) {
            await store.addFileToStore(fileInfo);
            store.setSelectedFile(fileInfo.path);
            store.pushRoute('Viewer');
            router.push({ name: 'Viewer' });
        }
    } catch (error) {
        console.error("Failed to pick file with metadata:", error);
    }
}

function goToSettings() {
    store.pushRoute('Settings');
    router.push({ name: 'Settings' });
}
</script>

<template>
    <div 
        v-if="store.floatingToolbars"
        class="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
    >
        <div class="flex items-center gap-1 p-1.5 rounded-lg bg-background/80 backdrop-blur-md border shadow-lg">
            <Button
                @click="handleOpenFile"
                variant="ghost"
                class="h-10 px-4 rounded-md hover:bg-muted font-medium whitespace-nowrap"
                title="Open File"
            >
                <FilePlus class="h-5 w-5 mr-2" />
                Open File
            </Button>
            
            <div class="w-px h-4 bg-border mx-1"></div>

            <Button
                @click="goToSettings"
                variant="ghost"
                size="icon"
                class="h-10 w-10 rounded-md hover:bg-muted"
                title="Settings"
            >
                <Settings class="h-5 w-5" />
            </Button>
        </div>
    </div>
</template>
