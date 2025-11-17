<script lang="ts" setup>
import { ref, watch } from "vue"

const props = defineProps<{
  modelValue: boolean
}>()
const emits = defineEmits<{
  (e: "update:modelValue", value: boolean): void
}>()

const isOpen = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  isOpen.value = val
})

function close() {
  emits("update:modelValue", false)
}

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) close()
}
</script>

<template>
  <div v-if="isOpen" class="custom-drawer-overlay" @click="onOverlayClick">
    <div class="custom-drawer-panel">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.custom-drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}
.custom-drawer-panel {
  background: var(--drawer-bg, #fff);
  width: 320px;
  max-width: 100vw;
  height: 100vh;
  box-shadow: -2px 0 8px rgba(0,0,0,0.1);
  transform: translateX(100%);
  animation: slideInRight 0.3s forwards;
  /* mimic Drawer.vue look as much as possible */
  border-radius: 0;
  display: flex;
  flex-direction: column;
}
@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
</style>
