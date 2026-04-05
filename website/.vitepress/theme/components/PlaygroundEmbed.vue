<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const container = ref<HTMLElement | null>(null);
let destroyFn: (() => void) | null = null;

onMounted(async () => {
  if (!container.value) return;

  const { mount, destroy } = await import('../../../../playground/src/lib');
  mount(container.value);
  destroyFn = destroy;
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
