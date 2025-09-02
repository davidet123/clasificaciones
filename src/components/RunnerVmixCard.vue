<template>
  <v-card v-if="runner" variant="outlined" class="runner-card">
    <v-card-title class="py-2">
      <div class="title-wrap">
        <div class="flag" v-if="flagEmoji">{{ flagEmoji }}</div>
        <div>
          <div class="name">{{ runner.nombre }}</div>
          <div class="sub">Dorsal: {{ runner.dorsal }} • {{ runner.pais || '—' }}</div>
        </div>
      </div>
    </v-card-title>

    <v-card-text class="py-3">
      <div class="fields">
        <div><b>Input vMix:</b> <code>DSK_CORREDOR</code></div>
        <div><b>NOMBRE.Text:</b> {{ runner.nombre }}</div>
        <div><b>DORSAL.Text:</b> {{ String(runner.dorsal ?? '') }}</div>
      </div>
    </v-card-text>

    <v-card-actions class="px-4 pb-3 pt-0">
      <v-btn size="small" variant="flat" color="primary" @click="doPreview">PVW</v-btn>
      <v-spacer />
      <v-btn
        size="small"
        :color="onAir ? 'red' : 'green'"
        variant="flat"
        @click="doLiveToggle"
      >
        {{ onAir ? 'On Air' : 'Live' }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { usevMixStore } from '@/stores/vMix'

const props = defineProps({
  runner: { type: Object, default: null },
})
// Emitimos solo cuando ENTRA en Live (para el histórico)
const emit = defineEmits(['went-live'])

const vmix = usevMixStore()
const onAir = ref(false)

const flagEmoji = computed(() => {
  const code = (props.runner?.bandera || props.runner?.pais || '').toString().toUpperCase().trim()
  if (!/^[A-Z]{2}$/.test(code)) return ''
  const base = 127397
  return String.fromCodePoint(...[...code].map(c => c.charCodeAt(0) + base))
})

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
    await vmix.liveVmix(INPUT) // OverlayInput2 según tu store

    if (!onAir.value) {
      onAir.value = true
      // Solo ahora notificamos al padre para añadir al histórico
      emit('went-live', { runner: props.runner })
    } else {
      // No enviamos "Off" a vMix; solo devolvemos el estado visual
      onAir.value = false
    }
  } catch (e) {
    console.error('Live corredor', e)
  }
}
</script>

<style scoped>
.runner-card { border-radius: 12px; }
.title-wrap { display: flex; align-items: center; gap: 10px; }
.flag { font-size: 20px; line-height: 1; }
.name { font-weight: 700; font-size: 16px; }
.sub { font-size: 12px; opacity: .8; }
.fields { display: grid; gap: 4px; font-size: 14px; }
</style>
