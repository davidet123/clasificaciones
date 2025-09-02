<template>
  <div class="history-item">
    <div class="text">
      <span class="bib">{{ runner.dorsal }}</span>
      <span class="name">{{ runner.nombre }}</span>
      <span class="sep">·</span>
    </div>
    <div class="actions">
      <v-btn size="x-small" color="primary" @click="doPreview">PVW</v-btn>
      <v-btn
        size="x-small"
        :color="onAir ? 'red' : 'green'"
        variant="flat"
        @click="doLiveToggle"
      >
        {{ onAir ? 'On Air' : 'Live' }}
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usevMixStore } from '@/stores/vMix'

const props = defineProps({
  runner: { type: Object, required: true },
})
const vmix = usevMixStore()
const onAir = ref(false)

const INPUT = 'DSK_CORREDOR'
const FIELD_NAME = 'NOMBRE'
const FIELD_DORSAL = 'DORSAL'

async function pushFields() {
  await vmix.liveUpdate(INPUT, FIELD_NAME, String(props.runner?.nombre ?? ''))
  await vmix.liveUpdate(INPUT, FIELD_DORSAL, String(props.runner?.dorsal ?? ''))
}

async function doPreview() {
  try {
    await pushFields()
    await vmix.PVWVmix(INPUT)
  } catch (e) {
    console.error('Preview corredor', e)
  }
}

async function doLiveToggle() {
  try {
    await pushFields()
    await vmix.liveVmix(INPUT)
    onAir.value = !onAir.value
  } catch (e) {
    console.error('Live corredor', e)
  }
}
</script>

<style scoped>
.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  font-size: 13px;
  background-color: #f7f7f7; /* Fondo suave */
  border: 1px solid #ddd;    /* Borde gris claro */
  border-radius: 6px;        /* Bordes redondeados */
  margin-bottom: 6px;        /* Separación entre items */
}

.text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.bib {
  font-weight: 700;
  color: #222;
  background: #e0e0e0;
  border-radius: 4px;
  padding: 2px 6px;
}

.name {
  font-weight: 500;
}

.sep {
  opacity: 0.5;
}
</style>
