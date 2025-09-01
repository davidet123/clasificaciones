<template>
  <div class="mapa-carrera">
    <div id="map" class="map"></div>

    <!-- Botón para ir al perfil (página nueva) -->
    <v-btn
      icon="mdi-chart-areaspline"
      color="primary"
      class="profile-toggle"
      @click="$router.push({ name: 'Perfil' })"
      title="Ver perfil altimétrico"
    />

    <!-- Ajustes existentes -->
    <SidebarAjustes v-model="sidebar" />
    <v-btn
      icon="mdi-tune"
      color="primary"
      class="sidebar-toggle"
      @click="sidebar = !sidebar"
      title="Ajustes"
    />

    <!-- Controles de Replay -->
    <div class="replay-controls">
      <v-select
        v-model="source"
        :items="[
          { title: 'NDJSON (bridge)', value: 'ndjson' },
          { title: 'KML (archivo local)', value: 'kml' }
        ]"
        density="comfortable"
        hide-details
        style="max-width: 200px"
      />

      <!-- NDJSON -->
      <template v-if="source==='ndjson'">
        <v-text-field v-model="ndDate" label="date" density="comfortable" hide-details style="max-width: 140px" />
        <v-text-field v-model="ndRaceId" label="raceId" density="comfortable" hide-details style="max-width: 140px" />
        <v-text-field v-model="ndDevice" label="device" density="comfortable" hide-details style="max-width: 160px" />
        <v-text-field v-model="ndFrom" label="from ISO" density="comfortable" hide-details style="max-width: 200px" />
        <v-text-field v-model="ndTo" label="to ISO" density="comfortable" hide-details style="max-width: 200px" />
        <v-btn size="small" :loading="loading" @click="loadNdjson">Cargar NDJSON</v-btn>
      </template>

      <!-- KML local -->
      <template v-else>
        <v-btn size="small" :loading="loading" @click="pickFile">Cargar KML (archivo)</v-btn>
        <input ref="fileEl" type="file" class="hidden" accept=".kml" @change="onFileChange" />
        <v-text-field v-model="kmlOverrideId" label="ID opcional" density="comfortable" hide-details style="max-width: 160px" />
      </template>

      <v-divider vertical class="mx-2" />

      <v-btn icon :disabled="!canPlay" @click="replayPlay"><v-icon>mdi-play</v-icon></v-btn>
      <v-btn icon :disabled="!isPlaying" @click="replayPause"><v-icon>mdi-pause</v-icon></v-btn>
      <v-btn icon :disabled="!hasData" @click="replayStop"><v-icon>mdi-stop</v-icon></v-btn>

      <v-divider vertical class="mx-2" />

      <v-btn :variant="speed===1?'tonal':'text'" size="small" @click="replaySpeed(1)">1x</v-btn>
      <v-btn :variant="speed===2?'tonal':'text'" size="small" @click="replaySpeed(2)">2x</v-btn>
      <v-btn :variant="speed===4?'tonal':'text'" size="small" @click="replaySpeed(4)">4x</v-btn>
      <v-btn :variant="speed===8?'tonal':'text'" size="small" @click="replaySpeed(8)">8x</v-btn>
      <v-btn :variant="speed===16?'tonal':'text'" size="small" @click="replaySpeed(16)">16x</v-btn>

      <v-btn size="small" variant="text" @click="replayToggleLoop">{{ replay.loop ? 'Loop ON' : 'Loop OFF' }}</v-btn>

      <v-divider vertical class="mx-2" />

      <div class="timebox">{{ replayTimeLabel }}</div>

      <div class="sliderbox" v-if="hasData">
        <v-slider
          :model-value="progressPct"
          @update:model-value="onSeekPct"
          step="0.1"
          min="0"
          max="100"
          density="compact"
          hide-details
          class="w-200"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount, computed } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGpxStore } from '@/stores/gpxStore';
import { useTrackingStore } from '@/stores/trackingStore';
import { useReplayStore } from '@/stores/replayStore';
import { formatPace } from '@/utils/geo';
import SidebarAjustes from '@/components/SidebarAjustes.vue';
import { useRaceConfigStore } from '@/stores/raceConfigStore';

const race = useRaceConfigStore();
const displayName = (id) => (race.devicesConfig?.[id]?.name?.trim() || id);

const props = defineProps({
  gpxPath: { type: String, default: '/assets/ruta_apunt_1.gpx' },
  cpStepMeters: { type: Number, default: undefined }
});

const sidebar = ref(false);
const gpx = useGpxStore();
const tracking = useTrackingStore();
const replay = useReplayStore();
replay.attachTracking(tracking);

let map;
let trackOriginalLayer;
const deviceLayers = new Map();
const animState = new Map();
let rafId = null;
let intervalId = null;

const totalKm = computed(() => Number(gpx.totalKm || 0).toFixed(2));

function animateMarker(id, targetLat, targetLon) {
  const st = animState.get(id) ?? { lat: targetLat, lon: targetLon, targetLat, targetLon };
  st.targetLat = targetLat; st.targetLon = targetLon;
  animState.set(id, st);
}
function tickAnim() {
  for (const [id, st] of animState.entries()) {
    const marker = deviceLayers.get(id)?.marker;
    if (!marker) continue;
    const alpha = 0.15;
    st.lat = st.lat + (st.targetLat - st.lat) * alpha;
    st.lon = st.lon + (st.targetLon - st.lon) * alpha;
    marker.setLatLng([st.lat, st.lon]);
    const halo = deviceLayers.get(id)?.halo;
    if (halo) halo.setLatLng([st.lat, st.lon]);
  }
  rafId = requestAnimationFrame(tickAnim);
}

function clearTrackLayer() {
  if (trackOriginalLayer) {
    map.removeLayer(trackOriginalLayer);
    trackOriginalLayer = null;
  }
}

function drawTrack() {
  if (!gpx.loaded || !gpx.points?.length) return;
  const latlngs = gpx.points.map(p => [p.lat, p.lon]);
  if (!trackOriginalLayer) {
    trackOriginalLayer = L.polyline(latlngs, { color: '#0066cc', weight: 5, opacity: 0.9 }).addTo(map);
  } else {
    trackOriginalLayer.setLatLngs(latlngs);
  }
  try { map.fitBounds(trackOriginalLayer.getBounds(), { padding: [30, 30] }); } catch {}
}

function buildPopupContent(d) {
  const container = document.createElement('div');

  const b = document.createElement('b');
  b.textContent = displayName(d.id); // ⬅️ cambio: nombre visible
  container.appendChild(b);
  container.appendChild(document.createElement('br'));

  const vel = document.createElement('div');
  vel.textContent = `Vel: ${(d.last?.velKmh ?? 0).toFixed(1)} km/h`;
  container.appendChild(vel);

  const pace = document.createElement('div');
  pace.textContent = `Ritmo: ${formatPace(d.paceAvgMinPerKm)}`;
  container.appendChild(pace);

  const km = document.createElement('div');
  km.textContent = `Km: ${d.progress?.km?.toFixed(2) ?? '0.00'} / ${totalKm.value}`;
  container.appendChild(km);

  const eta = document.createElement('div');
  eta.textContent = `ETA: ${d.eta?.toLocaleTimeString?.() || '-'}`;
  container.appendChild(eta);

  const delta = document.createElement('div');
  delta.textContent = `Δ objetivo: ${d.deltaObjective ?? '-'}`;
  container.appendChild(delta);

  const chip = document.createElement('span');
  chip.textContent = '[REPLAY]';
  chip.style.fontWeight = '600';
  chip.style.color = '#E65100';
  container.appendChild(chip);

  return container;
}

function refreshDevicesOnMap() {
  for (const d of tracking.list) {
    let entry = deviceLayers.get(d.id);
    if (!entry) {
      const marker = L.circleMarker([0,0], { radius: 7, weight: 2, color: d.color ?? '#e53935', fillOpacity: 1 }).addTo(map);
      const tail = L.polyline([], { color: d.color ?? '#e53935', opacity: 0.6, weight: 3 }).addTo(map);
      const halo = L.circleMarker([0,0], { radius: 14, weight: 3, color: '#FFD700', opacity: 0.9, fillOpacity: 0 }).addTo(map);
      halo.setStyle({ opacity: 0 }); // oculto por defecto
      deviceLayers.set(d.id, { marker, tail, halo });
      entry = deviceLayers.get(d.id);
    }

    const lat = d.last?.lat;
    const lon = d.last?.lon;

    if (lat != null && lon != null) {
      animateMarker(d.id, lat, lon);
    }

    if (Array.isArray(d.history) && d.history.length) {
      entry.tail.setLatLngs(d.history.map(p => [p.lat, p.lon]));
    }

    if (d.target?.onTarget) entry.halo.setStyle({ opacity: 0.9 });
    else entry.halo.setStyle({ opacity: 0 });

    entry.marker.setStyle({
      color: d.color ?? '#e53935',
      weight: d.target?.onTarget ? 3 : 2,
      radius: d.target?.onTarget ? 8 : 7
    });

    if (entry.marker.getPopup()) {
      entry.marker.setPopupContent(buildPopupContent(d));
    } else {
      entry.marker.bindPopup(buildPopupContent(d));
    }
  }
}

/* =======================
 * Replay controls
 * =======================*/
const source = ref('ndjson'); // 'ndjson' | 'kml'
const loading = ref(false);

// NDJSON params
const ndDate = ref('');
const ndRaceId = ref('');
const ndDevice = ref('');
const ndFrom = ref('');
const ndTo = ref('');

// KML local
const fileEl = ref(null);
const kmlOverrideId = ref('');

function pickFile() { fileEl.value?.click(); }
async function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  loading.value = true;
  try {
    await replay.loadKmlFile(file, { overrideId: kmlOverrideId.value || null });
    centerToFirst();
  } catch (e) {
    console.error(e);
    alert('No se pudo cargar el KML.');
  } finally {
    loading.value = false;
  }
}

async function loadNdjson() {
  if (!ndDate.value || !ndRaceId.value || !ndDevice.value || !ndFrom.value || !ndTo.value) {
    alert('Rellena date, raceId, device, from y to.');
    return;
  }
  loading.value = true;
  try {
    const qs = new URLSearchParams({
      date: ndDate.value,
      raceId: ndRaceId.value,
      device: ndDevice.value,
      from: ndFrom.value,
      to: ndTo.value
    });
    const url = `/replay/ndjson?${qs.toString()}`;
    await replay.loadNdjsonFromUrl(url, { label: `${ndDate.value}/${ndRaceId.value}/${ndDevice.value}` });
    centerToFirst();
  } catch (e) {
    console.error(e);
    alert('No se pudo cargar el NDJSON.');
  } finally {
    loading.value = false;
  }
}

function centerToFirst() {
  const ids = replay.deviceIds;
  if (ids.length) {
    const first = tracking.devices?.[ids[0]]?.last;
    if (first) { map.setView([first.lat, first.lon], 15); }
  }
}

const canPlay = computed(() => replay.hasData && !replay.playing);
const isPlaying = computed(() => replay.playing && !replay.paused);
const hasData = computed(() => replay.hasData);
const speed = computed(() => replay.speed);

function replayPlay(){ replay.play(); }
function replayPause(){ replay.pause(); }
function replayStop(){ replay.stop(); }
function replaySpeed(mult){ replay.setSpeed(mult); }
function replayToggleLoop(){ replay.loop = !replay.loop; }

const progressPct = computed(() => replay.progressPct);
function onSeekPct(pct){ replay.seekPct(pct); }

function hms(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const hh = String(Math.floor(s/3600)).padStart(2,'0');
  const mm = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}
const replayTimeLabel = computed(() => {
  if (!replay.t0 || !replay.tEnd) return '00:00:00 / 00:00:00';
  return `${hms((replay.tPlay ?? replay.t0) - replay.t0)} / ${hms(replay.tEnd - replay.t0)}`;
});

/* =======================
 * Lifecycle
 * =======================*/
onMounted(async () => {
  // Modo replay exclusivo: corta WS en live si estaba
  try { tracking.disconnectWS?.(); } catch {}

  map = L.map('map', { preferCanvas: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  await gpx.loadFromPublic(props.gpxPath, props.cpStepMeters);
  drawTrack();

  intervalId = setInterval(refreshDevicesOnMap, 500);
  rafId = requestAnimationFrame(tickAnim);
});

onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId);
  if (rafId) cancelAnimationFrame(rafId);
  if (map) map.remove();
  // devolver timeSource si lo usas en tracking
  try { tracking.setTimeSource?.(null); } catch {}
});
</script>

<style scoped>
.mapa-carrera { position: relative; width: 100%; height: 100vh; }
.map { position: absolute; inset: 0; }

/* Botones */
.sidebar-toggle { position: absolute; right: 16px; top: 16px; z-index: 400; }
.profile-toggle { position: absolute; right: 72px; top: 16px; z-index: 400; }

.replay-controls {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 450;
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  background: rgba(255,255,255,.9);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
}

.hidden { display: none; }

.timebox {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  min-width: 150px;
  text-align: center;
}

.sliderbox { width: 220px; }
.w-200 { width: 200px; }
</style>
