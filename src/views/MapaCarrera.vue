<template>
  <div class="mapa-carrera">
    <div id="map" class="map"></div>

    <SidebarAjustes v-model="sidebar" />

    <v-btn
      icon="mdi-tune"
      color="primary"
      class="sidebar-toggle"
      @click="sidebar = !sidebar"
      :title="'Ajustes'"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGpxStore } from '@/stores/gpxStore';
import { useTrackingStore } from '@/stores/trackingStore';
import SidebarAjustes from '@/components/SidebarAjustes.vue';

const props = defineProps({
  gpxPath: { type: String, default: '/assets/ruta_apunt_1.gpx' },
  cpStepMeters: { type: Number, default: undefined }
});

const sidebar = ref(false);
const gpx = useGpxStore();
const tracking = useTrackingStore();

let map;
let trackOriginalLayer;
const deviceLayers = new Map();
const animState = new Map();
let rafId = null;
let intervalId = null;

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

function refreshDevicesOnMap() {
  for (const d of tracking.list) {
    let entry = deviceLayers.get(d.id);
    if (!entry) {
      const marker = L.circleMarker([0,0], { radius: 7, weight: 2, color: d.color ?? '#e53935', fillOpacity: 1 }).addTo(map);
      const tail = L.polyline([], { color: d.color ?? '#e53935', opacity: 0.6, weight: 3 }).addTo(map);
      // Halo dorado para "onTarget" (por debajo de su PB proyectado)
      const halo = L.circleMarker([0,0], { radius: 14, weight: 3, color: '#FFD700', opacity: 0.9, fillOpacity: 0 }).addTo(map);
      halo.setStyle({ opacity: 0 }); // oculto por defecto

      deviceLayers.set(d.id, { marker, tail, halo });
      entry = deviceLayers.get(d.id);
    }

    // DIBUJO: GPS crudo
    const lat = d.last?.lat;
    const lon = d.last?.lon;

    if (lat != null && lon != null) {
      animateMarker(d.id, lat, lon);
    }

    if (Array.isArray(d.history) && d.history.length) {
      entry.tail.setLatLngs(d.history.map(p => [p.lat, p.lon]));
    }

    // Halo si va por debajo de su PB
    if (d.target?.onTarget) {
      entry.halo.setStyle({ opacity: 0.9 });
    } else {
      entry.halo.setStyle({ opacity: 0 });
    }

    entry.marker.setStyle({
      color: d.color ?? '#e53935',
      weight: d.target?.onTarget ? 3 : 2,
      radius: d.target?.onTarget ? 8 : 7
    });

    entry.marker.bindPopup(`
      <b>${d.id}</b><br>
      Vel: ${(d.last?.velKmh ?? 0).toFixed(1)} km/h<br>
      Ritmo: ${formatPaceStr(d.paceAvgMinPerKm)}<br>
      Km: ${d.kmRecorridos?.toFixed(2) ?? '0.00'} / ${gpx.totalKm.toFixed(2)}<br>
      ETA: ${d.etaArmed && d.etaMs ? hms(d.etaMs) : '—'}<br>
      ${d.target?.deltaToPBms != null ? `Δ objetivo: ${signDelta(d.target.deltaToPBms)}` : ''}
    `);
  }
}

function formatPaceStr(pmin){
  if (!pmin || !isFinite(pmin)) return '—';
  const totalSec = Math.round(pmin*60);
  const mm = String(Math.floor(totalSec/60)).padStart(2,'0');
  const ss = String(totalSec%60).padStart(2,'0');
  return `${mm}:${ss}/km`;
}
function hmsFromMs(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const hh = String(Math.floor(s/3600)).padStart(2,'0');
  const mm = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}
function hms(ms){ return hmsFromMs(ms); }
function signDelta(ms){
  const sign = ms <= 0 ? '' : '+';
  return `${sign}${hmsFromMs(Math.abs(ms))}`;
}

async function loadRoute(path, stepMeters) {
  clearTrackLayer();
  await gpx.loadFromPublic(path, stepMeters);
  drawTrack();
}

onMounted(async () => {
  map = L.map('map', { preferCanvas: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  await loadRoute(props.gpxPath, props.cpStepMeters);

  tracking.connectWS('ws://localhost:3000');

  intervalId = setInterval(refreshDevicesOnMap, 500);
  rafId = requestAnimationFrame(tickAnim);
});

onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId);
  if (rafId) cancelAnimationFrame(rafId);
  if (map) map.remove();
});

</script>

<style scoped>
.mapa-carrera { position: relative; width: 100%; height: 100vh; }
.map { position: absolute; inset: 0; }
.sidebar-toggle { position: absolute; right: 16px; top: 16px; z-index: 400; }
</style>
