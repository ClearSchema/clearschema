---
layout: page
title: Playground
---

<script setup>
import { defineClientComponent } from 'vitepress';

const PlaygroundEmbed = defineClientComponent(() =>
  import('./.vitepress/theme/components/PlaygroundEmbed.vue')
);
</script>

<PlaygroundEmbed />
