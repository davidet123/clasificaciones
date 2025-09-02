<template>
  <v-container fluid class="control-page pa-3">
    <div class="header">
      <div class="title">
        <v-icon icon="mdi-video-wireless" size="20" class="mr-2" />
        Control vMix — Carrera
      </div>
      <div class="right">
        <v-text-field
          v-model="vmix.url"
          label="vMix API URL"
          density="compact"
          hide-details
          style="max-width: 320px"
        />
        <v-btn class="ml-2" size="small" variant="tonal" @click="ping">Ping</v-btn>
      </div>
    </div>

    <!-- Selector de waypoint (botones) -->
    <div class="wp-selector">
      <v-btn
        size="small"
        :color="selectedWpId === 'global' ? 'primary' : undefined"
        variant="tonal"
        class="mr-1"
        @click="selectedWpId = 'global'"
      >Global</v-btn>
      <v-btn
        v-for="wp in waypoints.sorted"
        :key="wp.id"
        size="small"
        :color="selectedWpId === wp.id ? 'primary' : undefined"
        variant="tonal"
        class="mr-1"
        @click="selectedWpId = wp.id"
      >{{ wp.name }}</v-btn>
    </div>

    <div class="panel">

      <!-- Selección de dispositivo -->
      <div class="block">
        <div class="block-title">Dispositivo</div>
        <v-select
          v-model="selectedId"
          :items="deviceItems"
          item-title="title"
          item-value="value"
          density="comfortable"
          hide-details
          style="max-width: 320px"
        />
        <div v-if="dev" class="stats mt-2">
          <div><b>Vel inst:</b> {{ velInstStr }}</div>
          <div><b>Vel media:</b> {{ velMediaStr }}</div>
          <div><b>Km:</b> {{ kmStr }}</div>
          <div><b>Restante:</b> {{ restanteStr }}</div>
          <div><b>Ritmo:</b> {{ ritmoStr }}</div>
          <div><b>Pendiente:</b> {{ pendienteStr }}</div>
          <div><b>ETA total:</b> {{ etaStr }}</div>

          <!-- Datos al waypoint seleccionado -->
          <template v-if="selectedWp">
            <div class="mt-1"><b>Hasta {{ selectedWp.name }}:</b> {{ distToWpStr }}</div>
            <div><b>Marca prevista:</b> {{ markAtWpStr }}</div>
          </template>
        </div>
      </div>

      <!-- Mini-controles vMix (Metro / métricas) -->
      <div class="block">
        <div class="block-title">Metro / Métricas</div>
        <div class="grid">
          <VmixControlMini
            label="Velocidad"
            :input="metroInput"
            field="Velocidad"
            :value="velInstStr"
            :overlay="1"
          />
          <VmixControlMini
            label="Dist. Restante"
            :input="metroInput"
            field="DistRest"
            :value="restanteStr"
            :overlay="2"
          />
          <VmixControlMini
            label="Velocidad media"
            :input="metroInput"
            field="VelMedia"
            :value="velMediaStr"
            :overlay="3"
          />
          <VmixControlMini
            label="Ritmo"
            :input="metroInput"
            field="Ritmo"
            :value="ritmoStr"
            :overlay="4"
          />
          <VmixControlMini
            label="Pendiente"
            :input="metroInput"
            field="Pendiente"
            :value="pendienteStr"
            :overlay="5"
          />
          <VmixControlMini
            label="ETA total"
            :input="metroInput"
            field="ETA"
            :value="etaStr"
            :overlay="6"
          />
        </div>
      </div>

      <!-- Crono simple -->
      <div class="block">
        <div class="block-title">Crono (vMix)</div>
        <div class="row">
          <v-btn size="small" @click="vmix.iniciarCrono()">Start</v-btn>
          <v-btn size="small" @click="vmix.pausarCrono()">Pause</v-btn>
          <v-btn size="small" @click="vmix.pararCrono()">Stop</v-btn>
        </div>
      </div>

    </div>
  </v-container>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useTrackingStore } from '@/stores/trackingStore'
import { useGpxStore } from '@/stores/gpxStore'
import { usevMixStore } from '@/stores/vMix'
import { useWaypointsStore } from '@/stores/waypointsStore'
import VmixControlMini from '@/components/VmixControlMini.vue'
import { formatPace } from '@/utils/geo'

const tracking = useTrackingStore()
const gpx = useGpxStore()
const vmix = usevMixStore()
const waypoints = useWaypointsStore()
waypoints.load()

// Dispositivos
const deviceItems = computed(() => tracking.list.map(d => ({ title: d.id, value: d.id })))
const selectedId = ref(tracking.list[0]?.id ?? null)
const dev = computed(() =>
  tracking.byId?.[selectedId.value] || tracking.list.find(d => d.id === selectedId.value) || null
)
watch(() => tracking.list.length, (n) => {
  if (n && !selectedId.value) selectedId.value = tracking.list[0]?.id ?? null
})

// Selector waypoint
const selectedWpId = ref('global')
const selectedWp = computed(() => selectedWpId.value !== 'global'
  ? waypoints.sorted.find(w => w.id === selectedWpId.value) || null
  : null
)

// Métricas derivadas y formateadas
const totalKmNum = computed(() => Number(gpx.totalKm || 0))
const totalKmStr = computed(() => totalKmNum.value.toFixed(2))

const velInstStr = computed(() => `${(dev.value?.last?.velKmh ?? 0).toFixed(1)} km/h`)

const avgKmh = computed(() => {
  const d = dev.value
  if (!d || !tracking.startTime) return 0
  const tNow = tracking._nowMs?.() ?? Date.now()
  const elapsedH = Math.max(1e-6, (tNow - tracking.startTime) / 3600000)
  return Math.max(0, (d.kmRecorridos || 0) / elapsedH)
})
const velMediaStr = computed(() => `${avgKmh.value.toFixed(2)} km/h`)

const kmStr = computed(() => {
  const done = Number(dev.value?.kmRecorridos || 0).toFixed(2)
  return `${done} / ${totalKmStr.value}`
})

const restanteStr = computed(() => `${Number(dev.value?.kmRestantes || 0).toFixed(2)} km`)
const ritmoStr = computed(() => formatPace(dev.value?.paceAvgMinPerKm))
const pendienteStr = computed(() => {
  const s = dev.value?.slopePct
  return Number.isFinite(s) ? `${s.toFixed(1)} %` : '—'
})
const etaStr = computed(() => {
  const ms = dev.value?.etaMs
  if (!Number.isFinite(ms)) return '—'
  const sec = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(sec/3600)).padStart(2,'0')
  const m = String(Math.floor((sec%3600)/60)).padStart(2,'0')
  const s2 = String(sec%60).padStart(2,'0')
  return `${h}:${m}:${s2}`
})

// Distancia al waypoint y marca prevista
function stableSpeedKmh(d) {
  const ema = Number(d?.emaSpeed || 0)
  const avg = Number(d?.avgSpeedKmh || 0)
  if (ema > 0 && avg > 0) return 0.5 * ema + 0.5 * avg
  if (avg > 0) return avg
  return Math.max(0, ema)
}
const distToWpKm = computed(() => {
  const d = dev.value
  const wp = selectedWp.value
  if (!d || !wp) return 0
  return Math.max(0, Number(wp.km || 0) - Number(d.kmRecorridos || 0))
})
const distToWpStr = computed(() => `${distToWpKm.value.toFixed(2)} km`)
const markAtWpStr = computed(() => {
  const d = dev.value
  const wp = selectedWp.value
  if (!d || !wp || !tracking.startTime) return '—'
  const v = stableSpeedKmh(d)
  if (v <= 0.5) return '—'
  const tMs = Math.round((distToWpKm.value / v) * 3600 * 1000)
  const elapsed = (tracking._nowMs?.() ?? Date.now()) - tracking.startTime
  const mark = elapsed + tMs
  const sec = Math.max(0, Math.floor(mark / 1000))
  const h = String(Math.floor(sec/3600)).padStart(2,'0')
  const m = String(Math.floor((sec%3600)/60)).padStart(2,'0')
  const s2 = String(sec%60).padStart(2,'0')
  return `${h}:${m}:${s2}`
})

// Título de métricas
const metroInput = 'Metro'

// Autoenvío a vMix (mantenemos lo existente)
function pushAllToVmix() {
  if (!dev.value) return
  vmix.setTextCached(metroInput, 'Velocidad', velInstStr.value)
  vmix.setTextCached(metroInput, 'VelMedia', velMediaStr.value)
  vmix.setTextCached(metroInput, 'Km', kmStr.value)
  vmix.setTextCached(metroInput, 'DistRest', restanteStr.value)
  vmix.setTextCached(metroInput, 'Ritmo', ritmoStr.value)
  vmix.setTextCached(metroInput, 'Pendiente', pendienteStr.value)
  vmix.setTextCached(metroInput, 'ETA', etaStr.value)
}

let rafToken = null
function schedulePush() {
  if (rafToken) return
  rafToken = requestAnimationFrame(() => {
    rafToken = null
    pushAllToVmix()
  })
}

watch(
  () => [
    dev.value?.last?.velKmh,
    dev.value?.kmRecorridos,
    dev.value?.kmRestantes,
    dev.value?.paceAvgMinPerKm,
    dev.value?.slopePct,
    dev.value?.etaMs,
    tracking.startTime,
    gpx.totalKm,
    selectedWpId.value // no enviamos estos al vMix, pero recalculamos UI
  ],
  schedulePush,
  { immediate: true }
)

async function ping() {
  try { await vmix.pingVmix() } catch (e) { console.error(e) }
}
</script>

<style scoped>
.control-page { background: #fafafa; min-height: 100vh; display: flex; flex-direction: column; }
.header { display: flex; align-items: center; justify-content: space-between; padding: 8px 6px 12px 6px; }
.title { font-weight: 700; display: flex; align-items: center; }
.panel { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; padding: 8px 6px 18px; }
.block { background: #fff; border: 1px solid rgba(0,0,0,.06); border-radius: 10px; padding: 10px; }
.block-title { font-weight: 700; margin-bottom: 8px; }
.stats { display: grid; gap: 4px; font-size: 14px; color: rgba(0,0,0,.8); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
.row { display: flex; gap: 8px; align-items: center; }
.right { display: flex; align-items: center; }
.wp-selector { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 0 10px; }
.mr-1 { margin-right: 4px; }
</style>
