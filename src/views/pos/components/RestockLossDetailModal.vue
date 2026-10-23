<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { DetailedLoss, LossCategory } from '@/services/pos-restock.service';

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  productName: { type: String, required: true },
  initialLosses: { type: Array as () => DetailedLoss[], default: () => [] },
  stockObjectiveToday: { type: Number, required: true },
  excedente: { type: Number, required: true }
});

const emit = defineEmits(['close', 'save']);

const losses = ref<DetailedLoss[]>([]);

const categories: { value: LossCategory; label: string; icon: string }[] = [
  { value: 'Transport', label: 'Transporte', icon: 'fa-truck-fast' },
  { value: 'Storage', label: 'Almacenamiento', icon: 'fa-warehouse' },
  { value: 'Production', label: 'Producción', icon: 'fa-industry' },
  { value: 'Other', label: 'Otro', icon: 'fa-circle-question' }
];

// Calculation of limits
const maxAllowedLosses = computed(() => {
  return Math.max(0, props.stockObjectiveToday - props.excedente);
});

const totalReportedLosses = computed(() => {
  return losses.value.reduce((sum, loss) => sum + (Number(loss.quantity) || 0), 0);
});

const isOverLimit = computed(() => {
  return totalReportedLosses.value > maxAllowedLosses.value;
});

const remainingAllowed = computed(() => {
  return Math.max(0, maxAllowedLosses.value - totalReportedLosses.value);
});

onMounted(() => {
  if (props.initialLosses.length > 0) {
    losses.value = JSON.parse(JSON.stringify(props.initialLosses));
  } else {
    addLoss();
  }
});

const addLoss = () => {
  losses.value.push({
    quantity: 0,
    reason: '',
    category: 'Other'
  });
};

const removeLoss = (index: number) => {
  losses.value.splice(index, 1);
  if (losses.value.length === 0) addLoss();
};

const handleSave = () => {
  if (isOverLimit.value) return;

  // Filter out empty rows
  const validLosses = losses.value.filter(l => l.quantity > 0 && l.reason.trim() !== '');
  emit('save', validLosses);
};

const handleClose = () => {
  emit('close');
};
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="loss-modal-backdrop" @click.self="handleClose">
      <div class="loss-modal-card" :class="{ 'error-state': isOverLimit }">
        <header class="modal-header">
          <div class="header-content">
            <i class="fa-solid fa-triangle-exclamation warning-icon"></i>
            <div class="title-group">
              <h3>Reportar Bajas Detalladas</h3>
              <p>{{ productName }}</p>
            </div>
          </div>
          <button class="close-btn" @click="handleClose">&times;</button>
        </header>

        <div class="modal-body">
          <!-- Limit Summary Banner -->
          <div class="limit-summary" :class="{ 'at-limit': remainingAllowed === 0 && !isOverLimit, 'over-limit': isOverLimit }">
            <div class="limit-info">
              <span class="label">Máximo permitido hoy:</span>
              <strong class="value">{{ maxAllowedLosses }}</strong>
            </div>
            <div class="limit-divider"></div>
            <div class="limit-info">
              <span class="label">Total reportado:</span>
              <strong class="value">{{ totalReportedLosses }}</strong>
            </div>
          </div>

          <!-- Over Limit Block Alert -->
          <div v-if="isOverLimit" class="block-alert pulse">
            <i class="fa-solid fa-hand"></i>
            <div class="alert-content">
              <strong>Límite de bajas excedido</strong>
              <p>No puedes reportar más de {{ maxAllowedLosses }} unidades (Objetivo {{ stockObjectiveToday }} - Stock {{ excedente }}).</p>
              <router-link :to="{ name: 'pos-restock-management' }" class="redirect-link">
                Ir a Configurar Objetivos de Stock <i class="fa-solid fa-arrow-right"></i>
              </router-link>
            </div>
          </div>

          <p class="instruction">Indica las cantidades y los motivos específicos de las bajas detectadas:</p>

          <div class="losses-list">
            <div v-for="(loss, index) in losses" :key="index" class="loss-row">
              <div class="row-main">
                <div class="field quantity">
                  <label>Cant.</label>
                  <input type="number" v-model.number="loss.quantity" min="1" placeholder="0">
                </div>
                <div class="field reason">
                  <label>Motivo / Explicación</label>
                  <input type="text" v-model="loss.reason" placeholder="Ej: Apagón en congelador...">
                </div>
              </div>
              
              <div class="row-footer">
                <div class="category-selector">
                  <span class="label">Categoría:</span>
                  <div class="chips">
                    <button 
                      v-for="cat in categories" 
                      :key="cat.value"
                      type="button"
                      class="chip"
                      :class="{ active: loss.category === cat.value }"
                      @click="loss.category = cat.value"
                    >
                      <i class="fa-solid" :class="cat.icon"></i>
                      {{ cat.label }}
                    </button>
                  </div>
                </div>
                <button class="btn-remove" @click="removeLoss(index)" title="Eliminar este registro">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          </div>

          <button class="btn-add-row" @click="addLoss" :disabled="isOverLimit">
            <i class="fa-solid fa-plus"></i> Añadir otro motivo
          </button>
        </div>

        <footer class="modal-footer">
          <button class="btn-cancel" @click="handleClose">Cancelar</button>
          <button 
            class="btn-save" 
            :class="{ disabled: isOverLimit }" 
            :disabled="isOverLimit"
            @click="handleSave"
          >
            {{ isOverLimit ? 'Corregir Cantidades' : 'Confirmar Bajas' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.loss-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20000;
  padding: 1rem;
}

.loss-modal-card {
  background: white;
  width: 100%;
  max-width: 600px;
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalPop {
  from {
    transform: scale(0.9);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

.modal-header {
  padding: 1.5rem;
  background: #fef2f2;
  border-bottom: 1px solid #fee2e2;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  .header-content {
    display: flex;
    gap: 1rem;
    align-items: center;

    .warning-icon {
      font-size: 2rem;
      color: #ef4444;
    }

    .title-group {
      h3 {
        margin: 0;
        font-size: 1.25rem;
        color: #991b1b;
        font-weight: 800;
      }

      p {
        margin: 2px 0 0 0;
        color: #b91c1c;
        font-weight: 600;
        font-size: 0.9rem;
      }
    }
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: #991b1b;
    cursor: pointer;
    line-height: 1;
    opacity: 0.5;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  max-height: 60vh;

  .instruction {
    margin: 0 0 1.5rem 0;
    color: #4b5563;
    font-size: 0.95rem;
  }
}

.limit-summary {
  display: flex;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  overflow: hidden;

  .limit-info {
    flex: 1;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;

    .label {
      font-size: 0.7rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #6b7280;
    }

    .value {
      font-size: 1.1rem;
      color: #111827;
    }
  }

  .limit-divider {
    width: 1px;
    background: #e5e7eb;
  }

  &.at-limit {
    border-color: #f59e0b;

    .value {
      color: #d97706;
      font-weight: 800;
    }
  }

  &.over-limit {
    border-color: #ef4444;
    background: #fef2f2;

    .value {
      color: #b91c1c;
      font-weight: 800;
    }
  }
}

.block-alert {
  background: #fef2f2;
  border: 1px solid #fee2e2;
  border-left: 4px solid #ef4444;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  align-items: flex-start;

  i {
    font-size: 1.25rem;
    color: #ef4444;
    margin-top: 2px;
  }

  .alert-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    strong {
      color: #991b1b;
      font-size: 0.95rem;
    }

    p {
      margin: 0;
      font-size: 0.85rem;
      color: #b91c1c;
    }

    .redirect-link {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: #ef4444;
      font-weight: 700;
      text-decoration: underline;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;

      &:hover {
        color: #dc2626;
      }
    }
  }
}

.pulse {
  animation: pulse-red 2s infinite;
}

@keyframes pulse-red {
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.2);
  }

  70% {
    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.losses-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loss-row {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .row-main {
    display: flex;
    gap: 1rem;

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;

      label {
        font-size: 0.75rem;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
      }

      input {
        padding: 0.6rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 0.95rem;
        outline: none;

        &:focus {
          border-color: #ef4444;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
        }
      }

      &.quantity {
        width: 80px;

        input {
          text-align: center;
        }
      }

      &.reason {
        flex: 1;
      }
    }
  }

  .row-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px dashed #d1d5db;
    padding-top: 0.75rem;

    .category-selector {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .label {
        font-size: 0.75rem;
        font-weight: 700;
        color: #6b7280;
      }

      .chips {
        display: flex;
        gap: 0.4rem;

        .chip {
          background: white;
          border: 1px solid #d1d5db;
          padding: 0.35rem 0.6rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #4b5563;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          transition: all 0.2s;

          i {
            font-size: 0.8rem;
          }

          &:hover {
            background: #f3f4f6;
            border-color: #9ca3af;
          }

          &.active {
            background: #ef4444;
            color: white;
            border-color: #ef4444;
            box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
          }
        }
      }
    }

    .btn-remove {
      background: #fee2e2;
      border: none;
      color: #ef4444;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #fecaca;
        transform: scale(1.1);
      }
    }
  }
}

.btn-add-row {
  width: 100%;
  margin-top: 1rem;
  background: white;
  border: 2px dashed #d1d5db;
  padding: 0.75rem;
  border-radius: 12px;
  color: #6b7280;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    color: #374151;
  }
}

.modal-footer {
  padding: 1.5rem;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;

  button {
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: transparent;
    border: none;
    color: #6b7280;

    &:hover {
      background: #e5e7eb;
      color: #1f2937;
    }
  }

  .btn-save {
    background: #ef4444;
    border: none;
    color: white;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);

    &:hover {
      background: #dc2626;
      transform: translateY(-2px);
      box-shadow: 0 6px 15px rgba(239, 68, 68, 0.4);
    }

    &:active {
      transform: translateY(0);
    }
  }
}
</style>
