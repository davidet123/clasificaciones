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
  </div>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount, computed } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGpxStore } from '@/stores/gpxStore';
import { useTrackingStore } from '@/stores/trackingStore';
import { formatPace } from '@/utils/geo';
import SidebarAjustes from '@/components/SidebarAjustes.vue';

const props = defineProps({
  gpxPath: { type: String, default: '/assets/ruta_casa_1.gpx' },
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
  b.textContent = d.id;
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

  return container;
}

function refreshDevicesOnMap() {
  // tracking.list debe ser tu lista normalizada de dispositivos
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

onMounted(async () => {
  map = L.map('map', { preferCanvas: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  await gpx.loadFromPublic(props.gpxPath, props.cpStepMeters);
  drawTrack();

  tracking.connectWS?.('ws://localhost:3000');

  intervalId = setInterval(refreshDevicesOnMap, 500);
  rafId = requestAnimationFrame(tickAnim);
});

onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId);
  if (rafId) cancelAnimationFrame(rafId);
  if (map) map.remove();
  try { tracking.disconnectWS?.(); } catch {}
});
</script>

<style scoped>
.mapa-carrera { position: relative; width: 100%; height: 100vh; }
.map { position: absolute; inset: 0; }

/* Botones */
.sidebar-toggle { position: absolute; right: 16px; top: 16px; z-index: 400; }
.profile-toggle { position: absolute; right: 72px; top: 16px; z-index: 400; }
</style>
