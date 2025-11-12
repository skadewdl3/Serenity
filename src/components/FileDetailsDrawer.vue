<script setup lang="ts">
import {
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { BookOpen, Trash2 } from "lucide-vue-next";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface FileInfo {
    path: string;
    uri: string;
    file_type: string;
    name: string;
    lastOpened?: number;
}

const props = defineProps<{
    file: FileInfo | null;
}>();

const open = defineModel<boolean>("open");

const emit = defineEmits<{
    (e: "open-file", file: FileInfo): void;
    (e: "remove-file", path: string): void;
}>();

function handleOpenFile() {
    if (props.file) {
        emit("open-file", props.file);
    }
}

function handleRemoveFile() {
    if (props.file) {
        emit("remove-file", props.file.path);
    }
}

function fileTypeToType(fileType: string): string {
    if (fileType.startsWith("application/pdf")) {
        return "PDF";
    }
    if (fileType.startsWith("image/jpeg")) {
        return "JPEG";
    }
    if (fileType.startsWith("image/png")) {
        return "PNG";
    }
    return "Unknown";
}

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
    <Drawer v-model:open="open">
        <DrawerContent v-if="file">
            <DrawerHeader>
                <DrawerTitle class="truncate text-xl">{{
                    file.name
                }}</DrawerTitle>
            </DrawerHeader>

            <div class="px-4 space-y-2">
                <div class="text-sm text-gray-500 flex flex-col gap-2">
                    <p>
                        <strong class="font-medium text-gray-700">Type:</strong>
                        {{ fileTypeToType(file.file_type) }}
                    </p>
                    <p>
                        <strong class="font-medium text-gray-700"
                            >Last Opened:</strong
                        >
                        {{ formatTimeAgo(file.lastOpened) }}
                    </p>
                    <p>
                        <strong class="font-medium text-gray-700">Path:</strong>
                        <span class="break-all">{{ file.path }}</span>
                    </p>
                </div>
            </div>

            <DrawerFooter
                class="flex flex-row mt-4 justify-end gap-2 items-center"
            >
                <Button variant="destructive" @click="handleRemoveFile">
                    <Trash2 class="w-4 h-4" />
                </Button>

                <Button @click="handleOpenFile">
                    Open
                    <BookOpen class="w-4 h-4 mr-2" />
                </Button>
            </DrawerFooter>
        </DrawerContent>
    </Drawer>
</template>
