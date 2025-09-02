<template>
  <div class="vmix-mini">
    <div class="top">
      <span class="label" :title="desc || label">{{ label }}</span>

      <v-select
        v-model="overlayLocal"
        :items="overlayItems"
        density="compact"
        hide-details
        class="overlay-select"
        style="max-width: 90px"
      />
    </div>

    <div class="val-row" v-if="editable">
      <v-text-field
        v-model="internalValue"
        density="compact"
        hide-details
        :label="field || 'Valor'"
      />
    </div>
    <div class="val-row" v-else>
      <div class="readonly">{{ displayValue }}</div>
    </div>

    <div class="btns">
      <v-btn size="small" @click="doPreview" title="Preview" color="primary">
        Preview
      </v-btn>

      <v-btn
        size="small"
        :color="isLive ? 'red' : 'green'"
        variant="flat"
        @click="doLive"
        :title="isLive ? 'Quitar del Overlay' : 'Poner en Overlay'"
      >
        Live
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import axios from 'axios'
import { usevMixStore } from '@/stores/vMix' // <-- tu store existente

const props = defineProps({
  label:   { type: String, default: 'Control' },
  desc:    { type: String, default: '' },
  input:   { type: [String, Number], required: true }, // nombre o número del título/input en vMix
  field:   { type: String, default: 'Text' },          // nombre de la capa/campo (sin .Text)
  value:   { type: [String, Number], default: '' },
  overlay: { type: Number, default: 1 },               // 1..4
  editable:{ type: Boolean, default: false },
})

const emit = defineEmits(['previewed', 'live-toggled'])

const vmix = usevMixStore()

const overlayLocal = ref(props.overlay)
const internalValue = ref(String(props.value ?? ''))

watch(() => props.value, v => {
  if (!props.editable) internalValue.value = String(v ?? '')
}, { immediate: true })

const overlayItems = [1,2,3,4].map(n => ({ title: `Overlay ${n}`, value: n }))

const displayValue = computed(() => String(props.value ?? internalValue.value ?? ''))

// Estado local de si este input está live en el overlay seleccionado
const isLive = ref(false)

async function doPreview() {
  // SetText
  await vmix.liveUpdate(props.input, props.field, displayValue.value)
  // Preview
  await vmix.PVWVmix(props.input)
  emit('previewed')
}

// Toggle overlay on/off, sin tocar tu store (construimos la URL con su base)
async function doLive() {
  // siempre actualizamos texto antes de lanzar
  await vmix.liveUpdate(props.input, props.field, displayValue.value)

  const base = vmix.url.endsWith('/') ? vmix.url : (vmix.url + '/')
  const overlayNum = Number(overlayLocal.value) || 1

  // Si ya está live => OFF; si no => ON
  const func = isLive.value ? `OverlayInput${overlayNum}Off`
                            : `OverlayInput${overlayNum}`

  const dir = `${base}API/?Function=${encodeURIComponent(func)}&Input=${encodeURIComponent(props.input)}`
  try {
    await axios.post(dir)
    isLive.value = !isLive.value
    emit('live-toggled', { overlay: overlayNum, input: props.input, active: isLive.value })
  } catch (err) {
    console.error('vMix Overlay error:', err?.message || err)
  }
}
</script>

<style scoped>
.vmix-mini {
  width: 240px;
  padding: 10px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,.1);
  display: grid;
  grid-template-rows: auto auto auto;
  row-gap: 8px;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.label {
  font-weight: 600;
  font-size: 14px;
}
.overlay-select {
  min-width: 80px;
}
.val-row {
  min-height: 36px;
}
.readonly {
  border: 1px solid rgba(0,0,0,.14);
  border-radius: 6px;
  padding: 6px 10px;
  font-variant-numeric: tabular-nums;
  color: rgba(0,0,0,.8);
}
.btns {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}
</style>
