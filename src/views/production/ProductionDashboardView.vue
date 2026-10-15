<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ProductionService, { type ProductionTask } from '@/services/production.service'
import Draggable from 'vuedraggable'
import ProductionDetailModal from './components/ProductionDetailModal.vue'
import { useDialog } from '@/composables/useDialog'

const dialog = useDialog()
const tasks = ref<ProductionTask[]>([])
const isLoading = ref(true)
const error = ref('')
const selectedTask = ref<ProductionTask | null>(null)
const isModalOpen = ref(false)

// Separate arrays for drag and drop
const pendingTasks = computed({
  get: () => tasks.value.filter(t => t.productionStage === 'PENDING'),
  set: (val) => updateTasksOrder(val, 'PENDING')
})

const inProcessTasks = computed({
  get: () => tasks.value.filter(t => t.productionStage === 'IN_PROCESS'),
  set: (val) => updateTasksOrder(val, 'IN_PROCESS')
})

const finishedTasks = computed({
  get: () => tasks.value.filter(t => t.productionStage === 'FINISHED'),
  set: (val) => updateTasksOrder(val, 'FINISHED')
})

const updateTasksOrder = (newTasks: ProductionTask[], stage: string) => {
  // Logic required by draggable to update v-model
  // We handle the actual logic in @change event
}

const onChange = async (evt: any, newStage: 'PENDING' | 'IN_PROCESS' | 'FINISHED') => {
  if (evt.added) {
    const task = evt.added.element as ProductionTask
    if (task.productionStage !== newStage) {
      await updateStage(task, newStage)
    }
  }
}

const openModal = (task: ProductionTask) => {
  selectedTask.value = task
  isModalOpen.value = true
}

const handleTaskUpdate = (updatedTask: ProductionTask) => {
  const index = tasks.value.findIndex(t => t._id === updatedTask._id)
  if (index !== -1) {
    tasks.value[index] = updatedTask
  }
}

onMounted(async () => {
  await fetchTasks()
})

const fetchTasks = async () => {
  try {
    isLoading.value = true
    tasks.value = await ProductionService.getTasks()
  } catch (err) {
    console.error(err)
    error.value = 'No se pudieron cargar las órdenes de producción.'
  } finally {
    isLoading.value = false
  }
}

const updateStage = async (task: ProductionTask, newStage: 'PENDING' | 'IN_PROCESS' | 'FINISHED') => {
  const originalStage = task.productionStage

  // Optimistic update in main list
  const taskIndex = tasks.value.findIndex(t => t._id === task._id)

  // Ensure the task exists before trying to modify it
  if (taskIndex !== -1 && tasks.value[taskIndex]) {
    tasks.value[taskIndex].productionStage = newStage
  }

  try {
    await ProductionService.updateTask(task._id, { stage: newStage })
  } catch (err) {
    // Revert on error
    if (taskIndex !== -1 && tasks.value[taskIndex]) {
      tasks.value[taskIndex].productionStage = originalStage
    }
    await dialog.alert('Error al actualizar el estado.', { variant: 'error', title: 'Error' })
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'Por definir'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const isUrgent = (dateString: string) => {
  if (!dateString) return false
  const delivery = new Date(dateString)
  const now = new Date()
  const diffHours = (delivery.getTime() - now.getTime()) / (1000 * 60 * 60)
  return diffHours < 24 && diffHours > 0
}
</script>

<template>
  <div class="production-dashboard">
    <div v-if="isLoading" class="loading-state">
      <span class="loader"></span>
      <p>Cargando órdenes...</p>
    </div>

    <div v-else-if="error" class="error-state">
      {{ error }}
      <button @click="fetchTasks">Reintentar</button>
    </div>

    <div v-else class="board">
      
      <!-- PENDING COLUMN -->
      <div class="column">
        <h2 class="column-header pending">
          Pendiente <span class="count">{{ pendingTasks.length }}</span>
        </h2>
        <Draggable 
          class="task-list"
          :list="pendingTasks"
          group="tasks"
          item-key="_id"
          @change="(e: any) => onChange(e, 'PENDING')"
        >
          <template #item="{ element }">
             <div 
              class="task-card"
              :class="{ 'urgent': isUrgent(element.deliveryDate) }"
              @click="openModal(element)"
            >
              <div class="task-header">
                <span class="delivery-time">
                  Entrega: {{ formatDate(element.deliveryDate) }}
                </span>
                <span class="order-id">#{{ element._id.slice(-4) }}</span>
              </div>
              <div class="customer-info">
                <strong>{{ element.customerName }}</strong>
              </div>
              <ul class="product-list">
                <li v-for="(prod, idx) in element.products" :key="idx">
                  {{ prod.quantity }}x {{ prod.name }}
                </li>
              </ul>
              <div v-if="element.comments" class="comments">
                Note: {{ element.comments }}
              </div>
               <div v-if="element.productionNotes" class="production-notes-preview">
                <small>📝 Nota Prod.</small>
              </div>
            </div>
          </template>
        </Draggable>
      </div>

      <!-- IN PROCESS COLUMN -->
      <div class="column">
        <h2 class="column-header in_process">
          En Proceso <span class="count">{{ inProcessTasks.length }}</span>
        </h2>
        <Draggable 
          class="task-list"
          :list="inProcessTasks"
          group="tasks"
          item-key="_id"
          @change="(e: any) => onChange(e, 'IN_PROCESS')"
        >
          <template #item="{ element }">
             <div 
              class="task-card"
              :class="{ 'urgent': isUrgent(element.deliveryDate) }"
              @click="openModal(element)"
            >
              <div class="task-header">
                <span class="delivery-time">
                  Entrega: {{ formatDate(element.deliveryDate) }}
                </span>
                <span class="order-id">#{{ element._id.slice(-4) }}</span>
              </div>
              <div class="customer-info">
                <strong>{{ element.customerName }}</strong>
              </div>
              <ul class="product-list">
                <li v-for="(prod, idx) in element.products" :key="idx">
                  {{ prod.quantity }}x {{ prod.name }}
                </li>
              </ul>
              <div v-if="element.comments" class="comments">
                Note: {{ element.comments }}
              </div>
              <div v-if="element.productionNotes" class="production-notes-preview">
                <small>📝 Nota Prod.</small>
              </div>
            </div>
          </template>
        </Draggable>
      </div>

       <!-- FINISHED COLUMN -->
      <div class="column">
        <h2 class="column-header finished">
          Terminado <span class="count">{{ finishedTasks.length }}</span>
        </h2>
        <Draggable 
          class="task-list"
          :list="finishedTasks"
          group="tasks"
          item-key="_id"
          @change="(e: any) => onChange(e, 'FINISHED')"
        >
          <template #item="{ element }">
            <div 
              class="task-card"
              :class="{ 'urgent': isUrgent(element.deliveryDate) }"
              @click="openModal(element)"
            >
              <div class="task-header">
                <span class="delivery-time">
                  Entrega: {{ formatDate(element.deliveryDate) }}
                </span>
                <span class="order-id">#{{ element._id.slice(-4) }}</span>
              </div>
              <div class="customer-info">
                <strong>{{ element.customerName }}</strong>
              </div>
              <ul class="product-list">
                <li v-for="(prod, idx) in element.products" :key="idx">
                  {{ prod.quantity }}x {{ prod.name }}
                </li>
              </ul>
              <div v-if="element.comments" class="comments">
                Note: {{ element.comments }}
              </div>
              <div v-if="element.productionNotes" class="production-notes-preview">
                <small>📝 Nota Prod.</small>
              </div>
            </div>
          </template>
        </Draggable>
      </div>

    </div>
    
    <ProductionDetailModal 
      :is-open="isModalOpen"
      :task="selectedTask"
      @close="isModalOpen = false"
      @update="handleTaskUpdate"
    />
  </div>
</template>

<style lang="scss" scoped>
.production-dashboard {
  min-height: 100vh;
  background-color: $gray-50;
  display: flex;
  flex-direction: column;
}

.board {
  flex: 1;
  display: flex;
  padding: 2rem;
  gap: 2rem;
  overflow-x: auto;
  align-items: flex-start;
}

.column {
  flex: 1;
  min-width: 300px;
  max-width: 400px;
  background: $gray-100;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.column-header {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-family: $font-secondary;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid transparent;

  &.pending {
    border-color: $gray-400;
    color: $gray-700;
  }

  &.in_process {
    border-color: $warning;
    color: $warning;
  }

  &.finished {
    border-color: $success;
    color: $success;
  }

  .count {
    background: rgba(0, 0, 0, 0.05);
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.85rem;
  }
}

.task-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-right: 0.5rem;
  min-height: 100px;
  /* Ensure drop area exists even if empty */

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: $gray-300;
    border-radius: 3px;
  }
}

.task-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 4px solid transparent;
  cursor: pointer;
  /* Changed to pointer to indicate clickable */
  margin-bottom: 1rem;
  /* Space between cards */

  &:active {
    cursor: grabbing;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &.urgent {
    border-left-color: $error;
    background: #fff5f5;
  }
}

.task-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
  color: $text-light;

  .delivery-time {
    font-weight: 600;
    color: $text-dark;
  }
}

.customer-info {
  margin-bottom: 0.75rem;
  font-family: $font-secondary;
  color: $NICOLE-PURPLE;
}

.product-list {
  list-style: disc;
  padding-left: 1.25rem;
  margin: 0.5rem 0;
  font-size: 0.9rem;
  color: $text-dark;

  li {
    margin-bottom: 0.25rem;
  }
}

.comments {
  margin-top: 0.75rem;
  padding: 0.5rem;
  background: $gray-50;
  border-radius: 4px;
  font-size: 0.85rem;
  font-style: italic;
  color: $text-light;
}

.loading-state,
.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: $text-light;
  gap: 1rem;
}

.loader {
  width: 48px;
  height: 48px;
  border: 5px solid $gray-200;
  border-bottom-color: $NICOLE-PURPLE;
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;
}

.production-notes-preview {
  margin-top: 0.5rem;
  color: $NICOLE-PURPLE;
  font-weight: 600;
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .board {
    flex-direction: column;
    overflow-x: hidden;
  }

  .column {
    max-width: 100%;
    height: auto;
    max-height: 500px;
  }
}
</style>
