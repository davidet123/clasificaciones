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
            field="Velocidad"
            :value="restanteStr"
            :overlay="2"
          />
          <VmixControlMini
            label="Velocidad media"
            :input="'Velocidad_media'"
            field="Velocidad"
            :value="velMediaStr"
            :overlay="2"
          />
          <VmixControlMini
            label="Ritmo"
            :input="'RITMO'"
            field="Velocidad"
            :value="ritmoStr"
            :overlay="4"
          />
          <VmixControlMini
            label="Pendiente"
            :input="'Pendiente'"
            field="Velocidad"
            :value="pendienteStr"
            :overlay="5"
          />
          <VmixControlMini
            label="ETA total"
            :input="'ETA'"
            field="Velocidad"
            :value="etaStr"
            :overlay="6"
          />
        </div>
      </div>

      <div class="block">
        <div class="block-title">Corredores (DSK)</div>

        <div class="row">
          <v-text-field
            v-model="dorsalQuery"
            label="Dorsal"
            density="comfortable"
            type="number"
            hide-details
            style="max-width: 180px"
            @keyup.enter="searchRunner"
          />
          <v-btn class="ml-2" size="small" variant="tonal" @click="searchRunner">Buscar</v-btn>
        </div>

        <!-- Mensajes / tarjeta -->
        <div class="mt-3" v-if="runnerSel">
          <RunnerVmixCard :runner="runnerSel" @went-live="onRunnerWentLive" />
        </div>
        <div class="mt-2 text-medium-emphasis" v-else-if="!dorsalQuery">
          Introduce un dorsal existente para mostrar el corredor.
        </div>
        <div class="mt-2 text-error" v-else>
          DORSAL NO ENCONTRADO
        </div>

        <!-- Histórico vertical (solo lectura, items de una línea) -->
        <div class="history mt-3" v-if="runnerHistory.length">
          <div class="history-title">Histórico (últimos 10)</div>
          <RunnerHistoryItem
            v-for="h in runnerHistory"
            :key="h.dorsal"
            :runner="h"
            @became-off-air="onHistoryItemOffAir(h)"
          />
        </div>
      </div>


     <!-- Crono (vMix) -->
      <div class="block">
        <div class="block-title">Crono (vMix)</div>
        <div class="row">
          <v-btn size="small" @click="vmix.iniciarCrono()">Start</v-btn>
          <v-btn size="small" @click="vmix.pausarCrono()">Pause</v-btn>
          <v-btn size="small" @click="vmix.pararCrono()">Stop</v-btn>

          <v-spacer />

          <v-btn
            size="small"
            @click="doPreviewCrono"
            title="Preview"
            color="primary"
          >
            Preview
          </v-btn>

          <!-- Live: cambia solo estado local -->
          <v-btn
            size="small"
            @click="toggleCronoLive"
            :color="cronoOnAir ? 'red' : 'green'"
            variant="flat"
            :title="cronoOnAir ? 'En programa (Overlay 4)' : 'Live (Overlay 4)'"
          >
            {{ cronoOnAir ? 'On Air' : 'Live' }}
          </v-btn>
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
import { useRunnersStore } from '@/stores/runnersStore'
import VmixControlMini from '@/components/VmixControlMini.vue'
import RunnerVmixCard from '@/components/RunnerVmixCard.vue'
import RunnerHistoryItem from '@/components/RunnerHistoryItem.vue'
import { formatPace } from '@/utils/geo'

const tracking = useTrackingStore()
const gpx = useGpxStore()
const vmix = usevMixStore()
const waypoints = useWaypointsStore()
waypoints.load()

// Runners

const runners = useRunnersStore()

const dorsalQuery = ref('')
const runnerSel = computed(() => {
  const d = parseInt(dorsalQuery.value, 10)
  if (!Number.isFinite(d)) return null
  return runners.list.find(r => Number(r.dorsal) === d) || null
})
function searchRunner(){ /* trigger computeds; no hacemos nada más */ }

// Histórico: últimos 10 que salieron a LIVE
const runnerHistory = ref([]) // [{ id, nombre, dorsal, pais? }]

function onRunnerWentLive(evt) {
  const r = evt?.runner
  if (!r || !r.dorsal) return
  // dedup por dorsal
  const idx = runnerHistory.value.findIndex(x => Number(x.dorsal) === Number(r.dorsal))
  if (idx >= 0) runnerHistory.value.splice(idx, 1)
  runnerHistory.value.unshift({ id: r.id, nombre: r.nombre, dorsal: r.dorsal, pais: r.pais })
  if (runnerHistory.value.length > 10) runnerHistory.value.length = 10
}

function onHistoryItemOffAir(h) {
  // al volver de live, este elemento pasa al primer sitio
  const idx = runnerHistory.value.findIndex(x => Number(x.dorsal) === Number(h.dorsal))
  if (idx > 0) {
    const [item] = runnerHistory.value.splice(idx, 1)
    runnerHistory.value.unshift(item)
  }
}

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

  // Crono vMix
  const cronoOnAir = ref(false)

  async function doPreviewCrono() {
    try { await vmix.PVWVmix('CRONO') } catch (e) { console.error('Preview CRONO', e) }
  }

  async function toggleCronoLive() {
    try {
      await vmix.liveVmixCrono('CRONO')
      if (!cronoOnAir.value) {
        // Solo cuando pasamos a ON AIR disparamos vMix Overlay 4
        cronoOnAir.value = true
      } else {
        // Volvemos a estado verde sin tocar vMix (no hay “Off” a propósito)
        cronoOnAir.value = false
      }
    } catch (e) {
      console.error('Live CRONO', e)
    }
  }

  const dorsalInput = ref('')
  const corredorOnAir = ref(false)

  const runner = computed(() => {
    const num = Number(dorsalInput.value)
    if (!num) return null
    return runners.list.find(r => r.dorsal === num) || null
  })

  async function doPreviewCorredor() {
    try {
      await vmix.PVWVmix('DSK_CORREDOR')
    } catch (e) {
      console.error('Preview corredor', e)
    }
  }

  async function toggleCorredorLive() {
    try {
      await vmix.liveVmix('DSK_CORREDOR')
      corredorOnAir.value = !corredorOnAir.value
    } catch (e) {
      console.error('Live corredor', e)
    }
  }

// Título de métricas
const metroInput = 'Metro'

// Autoenvío a vMix (mantenemos lo existente)
function pushAllToVmix() {
  if (!dev.value) return
  vmix.setTextCached('Velocidad', 'Velocidad', velInstStr.value)
  vmix.setTextCached('Velocidad_media', 'Velocidad', velMediaStr.value)
  vmix.setTextCached(metroInput, 'Velocidad', kmStr.value)
  vmix.setTextCached(metroInput, 'Velocidad', restanteStr.value)
  vmix.setTextCached(metroInput, 'Velocidad', ritmoStr.value)
  vmix.setTextCached('Pendiente', 'Velocidad', pendienteStr.value)
  vmix.setTextCached('Eta', 'Velocidad', etaStr.value)
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
    selectedWpId.value
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
.mt-1 { margin-top: 4px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.text-medium-emphasis { opacity: .7; }
</style>
