import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import emitter, { type RecentFile } from '@/lib/events';

export const useAppStore = defineStore('app', () => {
    const selectedFilePath = ref<string | null>(null);
    const navigationStack = ref<string[]>(['Home']); // Stack of route names
    const transitionDirection = ref<'push' | 'pop'>('push');
    const defaultZoom = useLocalStorage('settings-default-zoom', 0.9);
    const invertPdfInDarkMode = useLocalStorage('settings-invert-pdf-dark-mode', true);
    const floatingToolbars = useLocalStorage('settings-floating-toolbars', true);
    const hideToolbar = ref(false);

    function pushRoute(routeName: string) {
        console.log('[Store] pushRoute called:', routeName);
        console.log('[Store] Stack before push:', [...navigationStack.value]);

        // Only push if it's not already at the top of the stack
        const currentTop = navigationStack.value[navigationStack.value.length - 1];
        if (currentTop !== routeName) {
            navigationStack.value.push(routeName);
            transitionDirection.value = 'push';
            console.log('[Store] Stack after push:', [...navigationStack.value]);
            console.log('[Store] Transition direction set to:', transitionDirection.value);
        } else {
            console.log('[Store] Route already at top of stack, not pushing');
        }
    }

    function popRoute() {
        console.log('[Store] popRoute called');
        console.log('[Store] Stack before pop:', [...navigationStack.value]);
        if (navigationStack.value.length > 1) {
            navigationStack.value.pop();
            transitionDirection.value = 'pop';
            console.log('[Store] Stack after pop:', [...navigationStack.value]);
            console.log('[Store] Transition direction set to:', transitionDirection.value);
        }
    }

    function handleBackButton(): string | null {
        console.log('[Store] handleBackButton called');
        console.log('[Store] Stack before handleBackButton:', [...navigationStack.value]);
        if (navigationStack.value.length > 1) {
            navigationStack.value.pop();
            transitionDirection.value = 'pop';
            const targetRoute = navigationStack.value[navigationStack.value.length - 1];
            console.log('[Store] Stack after pop:', [...navigationStack.value]);
            console.log('[Store] Transition direction set to:', transitionDirection.value);
            console.log('[Store] Target route:', targetRoute);
            return targetRoute;
        }
        console.log('[Store] Stack has only one item, returning null');
        return null;
    }

    function setSelectedFile(path: string | null) {
        selectedFilePath.value = path;
    }

    async function addFileToStore(fileInfo: RecentFile) {
        emitter.emit("createRecentsEntry", {
            ...fileInfo,
            lastOpened: Date.now(),
        });
    }

    async function openFile(fileInfo: RecentFile) {
        await addFileToStore(fileInfo);
        selectedFilePath.value = fileInfo.path;
    }

    function clearHistory() {
        localStorage.removeItem('recentFiles');
        // We might need to emit an event to update the UI if Recents.vue is listening
        emitter.emit('refreshRecents');
    }

    async function pickAndOpenFile(): Promise<boolean> {
        try {
            // Dynamically import invoke to avoid issues if it's not available in all contexts (though it should be)
            const { invoke } = await import("@tauri-apps/api/core");
            const fileInfo = await invoke<RecentFile>("pick_file_with_metdata");
            if (fileInfo) {
                await addFileToStore(fileInfo);
                setSelectedFile(fileInfo.path);
                pushRoute('Viewer');
                return true;
            }
        } catch (error) {
            console.error("Failed to pick file with metadata:", error);
        }
        return false;
    }

    // Reader state for Toolbar
    const readerState = ref({
        currentPage: 1,
        totalPages: 0,
        isLoading: false,
        isRendering: false,
        selectedText: null as string | null,
        scale: 1.0,
        toolbarVisible: true,
    });

    const updateReaderState = (updates: Partial<typeof readerState.value>) => {
        readerState.value = { ...readerState.value, ...updates };
    };

    return {
        selectedFilePath,
        navigationStack,
        transitionDirection,
        defaultZoom,
        invertPdfInDarkMode,
        floatingToolbars,
        hideToolbar,
        readerState,
        pushRoute,
        popRoute,
        handleBackButton,
        setSelectedFile,
        openFile,
        addFileToStore,
        clearHistory,
        pickAndOpenFile,
        updateReaderState,
    };
});
