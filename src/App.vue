<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import ToastContainer from './components/ToastContainer.vue'
import SessionExpiredModal from './components/SessionExpiredModal.vue'
import DialogModal from './components/DialogModal.vue'
import UpdateBanner from './components/UpdateBanner.vue'

const route = useRoute()
</script>

<template>
  <div class="app-shell">
    <AppSidebar v-if="route.name !== 'login' && route.name !== 'kitchen-display' && !route.meta.standalone" />
    <div class="content-area" :class="{ 'full-width': route.name === 'login' || route.name === 'kitchen-display' || route.meta.standalone }">
      <RouterView />
    </div>
    <ToastContainer />
    <DialogModal />
    <SessionExpiredModal />
    <UpdateBanner />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background-color: var(--color-background);
}

.content-area {
  flex: 1;
  min-width: 0;
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  overflow-x: hidden;
}

.content-area.full-width {
  width: 100%;
}

@media (max-width: 1023px) {
  .content-area:not(.full-width) {
    padding-top: 52px;
  }
}
</style>
