<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import { useRouter } from 'vue-router';

const store = useAppStore();
const router = useRouter();

function goBack() {
    store.popRoute();
    router.back();
}
</script>

<template>
    <div 
        v-if="store.floatingToolbars"
        class="fixed bottom-8 left-8 z-50"
    >
        <div class="flex items-center gap-1 p-1.5 rounded-lg bg-background/80 backdrop-blur-md border shadow-lg">
            <Button
                @click="goBack"
                variant="ghost"
                size="icon"
                class="h-10 w-10 rounded-md hover:bg-muted"
                title="Back"
            >
                <ArrowLeft class="h-5 w-5" />
            </Button>
        </div>
    </div>
</template>
