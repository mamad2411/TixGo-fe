<template>
  <div class="evs a-sk" aria-hidden="true" data-state="loading">
    <div class="evs__art" />
    <span class="evs__date" />
    <div class="evs__body">
      <span class="a-sk-bar" style="width: 32%" />
      <span class="a-sk-bar a-sk-bar--title" style="width: 86%" />
      <span class="a-sk-bar" style="width: 54%" />
      <span class="a-sk-bar a-sk-bar--sm" style="width: 66%" />
    </div>
  </div>
</template>

<style scoped>
.evs {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  aspect-ratio: 4 / 5;
  border: 1px solid var(--a-line);
  border-radius: 20px;
}
.evs__art {
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg, var(--a-bg3) 0%, var(--a-bg2) 70%);
}
/* Tiruan chip tanggal di kartu asli supaya posisi elemen tidak melompat saat data tiba. */
.evs__date {
  position: absolute;
  left: 14px;
  top: 14px;
  width: 52px;
  height: 62px;
  border-radius: 12px;
  background: var(--a-bg3);
}
.evs__body {
  position: absolute;
  inset: auto 0 0 0;
  display: grid;
  gap: 9px;
  padding: 0 18px 20px;
}
</style>
