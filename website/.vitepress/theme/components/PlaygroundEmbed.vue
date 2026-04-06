<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const container = ref<HTMLElement | null>(null);
let destroyFn: (() => void) | null = null;

onMounted(async () => {
  if (!container.value) return;

  try {
    const { mount, destroy } = await import('../../../../playground/src/lib');
    if (!container.value?.isConnected) return;
    mount(container.value);
    destroyFn = destroy;
  } catch (err) {
    console.error('Failed to load playground:', err);
  }
});

onUnmounted(() => {
  if (destroyFn) {
    destroyFn();
    destroyFn = null;
  }
});
</script>

<template>
  <div ref="container" class="playground-wrapper" />
</template>
