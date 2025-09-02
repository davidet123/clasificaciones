<template>
  <v-dialog v-model="openLocal" max-width="480">
    <v-card>
      <v-card-title class="text-h6">
        {{ isEdit ? 'Editar punto intermedio' : 'Nuevo punto intermedio' }}
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="nameLocal"
          label="Nombre"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
        <div class="flex gap-2 mt-2">
          <v-text-field
            v-model="kmLocal"
            label="Km"
            density="comfortable"
            variant="outlined"
            type="number"
            step="0.01"
            hide-details="auto"
            style="max-width: 160px"
          />
          <v-text-field
            v-model="latLocal"
            label="Lat"
            density="comfortable"
            variant="outlined"
            type="number"
            hide-details="auto"
          />
          <v-text-field
            v-model="lonLocal"
            label="Lon"
            density="comfortable"
            variant="outlined"
            type="number"
            hide-details="auto"
          />
        </div>
        <div class="text-caption mt-1">
          La posición se recalculará al guardar si cambias el km.
        </div>
      </v-card-text>
      <v-card-actions class="justify-between">
        <v-btn v-if="isEdit" color="error" variant="tonal" @click="$emit('remove', model.id)">Eliminar</v-btn>
        <div class="flex gap-2">
          <v-btn variant="text" @click="$emit('close')">Cancelar</v-btn>
          <v-btn color="primary" @click="save">Guardar</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  model: {
    type: Object,
    default: () => ({ id: null, name: '', km: 0, lat: null, lon: null })
  }
})
const emit = defineEmits(['update:modelValue', 'save', 'remove', 'close'])

const openLocal = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const isEdit = computed(() => !!props.model?.id)
const nameLocal = ref('')
const kmLocal = ref(0)
const latLocal = ref(null)
const lonLocal = ref(null)

watch(() => props.model, (m) => {
  nameLocal.value = m?.name ?? ''
  kmLocal.value = Number(m?.km ?? 0).toFixed(2)
  latLocal.value = m?.lat ?? null
  lonLocal.value = m?.lon ?? null
}, { immediate: true, deep: true })

function save() {
  const payload = {
    id: props.model?.id || null,
    name: String(nameLocal.value || '').trim(),
    km: Number(kmLocal.value) || 0,
    lat: Number(latLocal.value) || null,
    lon: Number(lonLocal.value) || null,
  }
  emit('save', payload)
}
</script>

<style scoped>
.flex { display: flex; align-items: center; }
.gap-2 { gap: 8px; }
.mt-2 { margin-top: 8px; }
.mt-1 { margin-top: 4px; }
</style>
