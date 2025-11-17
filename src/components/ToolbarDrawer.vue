<script setup lang="ts">
import { computed } from "vue";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-vue-next";
import { useScreenOrientation } from "@vueuse/core";
import emitter from "@/lib/events";

const isOpen = defineModel<boolean>("open");

const props = defineProps<{
    scale: number;
    minScale: number;
    maxScale: number;
}>();

const { orientation } = useScreenOrientation();
const isVertical = computed(
    () =>
        orientation.value == "portrait-primary" ||
        orientation.value == "portrait-secondary",
);
</script>

<template>
    <Drawer v-model:open="isOpen">
        <DrawerContent>
            <div class="mx-auto w-full max-w-2xl">
                <DrawerHeader>
                    <DrawerTitle>Options</DrawerTitle>
                    <DrawerDescription>
                        Adjust the view settings.
                    </DrawerDescription>
                </DrawerHeader>
                <div class="p-4 space-y-4">
                    <div class="flex items-center gap-2">
                        <Button
                            @click="emitter.emit('zoomOut')"
                            :disabled="scale <= minScale"
                            size="icon"
                            variant="outline"
                        >
                            <ZoomOut class="h-4 w-4" />
                        </Button>
                        <Slider
                            :model-value="[props.scale]"
                            :min="minScale"
                            :max="maxScale"
                            :step="0.1"
                        />
                        <Button
                            @click="emitter.emit('zoomIn')"
                            :disabled="scale >= maxScale"
                            size="icon"
                            variant="outline"
                        >
                            <ZoomIn class="h-4 w-4" />
                        </Button>
                    </div>
                    <Button
                        @click="emitter.emit('resetZoom')"
                        variant="outline"
                        class="w-full"
                    >
                        <RotateCcw class="h-4 w-4 mr-2" />
                        Reset Zoom
                    </Button>
                </div>
            </div>
        </DrawerContent>
    </Drawer>
</template>
