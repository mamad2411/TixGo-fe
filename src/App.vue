<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <!-- Satu tempat untuk transisi antar-layout (landing <-> aplikasi <-> auth).
       Perpindahan halaman di dalam layout ditangani layout itu sendiri, jadi animasinya tidak dobel. -->
  <RouterView v-slot="{ Component }">
    <Transition name="route">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>
