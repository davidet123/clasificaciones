<template>
  <div class="mapa-carrera">
    <div id="map" class="map"></div>

    <!-- Selector de waypoint (botones) -->
    <div class="wp-selector">
      <v-btn
        size="small"
        :color="selectedWpId === 'global' ? 'primary' : undefined"
        variant="tonal"
        @click="selectedWpId = 'global'"
        class="mr-1"
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

    <!-- Botón para ir al perfil -->
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

    <!-- Modal crear/editar waypoint -->
    <WaypointEditor
      v-model="editorOpen"
      :model="editorModel"
      @save="onSaveWaypoint"
      @remove="onRemoveWaypoint"
      @close="editorOpen = false"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount, computed } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGpxStore } from '@/stores/gpxStore';
import { useTrackingStore } from '@/stores/trackingStore';
import { formatPace, formatHMSfromMs } from '@/utils/geo';
import SidebarAjustes from '@/components/SidebarAjustes.vue';
import { useRaceConfigStore } from '@/stores/raceConfigStore';
import { useWaypointsStore } from '@/stores/waypointsStore';
import WaypointEditor from '@/components/WaypointEditor.vue';

const race = useRaceConfigStore();
const displayName = (id) => (race.devicesConfig?.[id]?.name?.trim() || id);

const props = defineProps({
  gpxPath: { type: String, default: '/assets/ruta_casa_2.gpx' },
  cpStepMeters: { type: Number, default: undefined }
});

const sidebar = ref(false);
const gpx = useGpxStore();
const tracking = useTrackingStore();
const waypoints = useWaypointsStore();

let map;
let trackOriginalLayer;
let waypointsLayer;
const deviceLayers = new Map();
const waypointMarkers = new Map();
const animState = new Map();
let rafId = null;
let intervalId = null;

const totalKm = computed(() => Number(gpx.totalKm || 0).toFixed(2));

// Selector waypoint
const selectedWpId = ref('global')

// Modal editor
const editorOpen = ref(false)
const editorModel = ref({ id: null, name: '', km: 0, lat: null, lon: null })

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
  if (trackOriginalLayer) { map.removeLayer(trackOriginalLayer); trackOriginalLayer = null; }
}

function drawTrack() {
  if (!gpx.loaded || !gpx.points?.length) return;
  const latlngs = gpx.points.map(p => [p.lat, p.lon]);
  if (!trackOriginalLayer) {
    trackOriginalLayer = L.polyline(latlngs, { color: '#0066cc', weight: 5, opacity: 0.9 }).addTo(map);
    // Click en el track para crear waypoint
    trackOriginalLayer.on('click', onTrackClick);
  } else {
    trackOriginalLayer.setLatLngs(latlngs);
  }
  try { map.fitBounds(trackOriginalLayer.getBounds(), { padding: [30, 30] }); } catch {}
}

function buildPopupContent(d) {
  const container = document.createElement('div');

  const b = document.createElement('b');
  b.textContent = displayName(d.id);
  container.appendChild(b);
  container.appendChild(document.createElement('br'));

  const vel = document.createElement('div');
  vel.textContent = `Vel: ${(d.last?.velKmh ?? 0).toFixed(1)} km/h`;
  container.appendChild(vel);

  const pace = document.createElement('div');
  pace.textContent = `Ritmo: ${formatPace(d.paceAvgMinPerKm)}`;
  container.appendChild(pace);

  const km = document.createElement('div');
  km.textContent = `Km: ${(d.kmRecorridos ?? 0).toFixed(2)} / ${totalKm.value}`;
  container.appendChild(km);

  const eta = document.createElement('div');
  const etaMs = Number.isFinite(d.etaMs) ? d.etaMs : null;
  eta.textContent = `ETA total: ${etaMs != null ? formatHMSfromMs(etaMs) : '—'}`;
  container.appendChild(eta);

  const pendiente = document.createElement('div');
  pendiente.textContent = `Pendiente: ${d.slopePct != null ? (d.slopePct >= 0 ? '+' : '') + d.slopePct.toFixed(1) + '%' : '—'}`;
  container.appendChild(pendiente);

  // Extra: distancia y marca al waypoint seleccionado
  const wpInfo = document.createElement('div');
  wpInfo.style.marginTop = '6px';
  const wp = selectedWpId.value !== 'global' ? waypoints.byId?.[selectedWpId.value] : null;
  if (wp && Number.isFinite(wp.km)) {
    const deltaKm = Math.max(0, wp.km - (d.kmRecorridos || 0));
    const vStable = stableSpeedKmh(d);
    let mark = '—';
    if (tracking.startTime && vStable > 0.5 && deltaKm > 0) {
      const now = Date.now();
      const elapsed = now - tracking.startTime;
      const tMs = Math.round((deltaKm / vStable) * 3600 * 1000);
      mark = formatHMSfromMs(elapsed + tMs);
    }
    wpInfo.textContent = `Hasta «${wp.name}»: ${deltaKm.toFixed(2)} km | Marca prevista: ${mark}`;
  } else {
    wpInfo.textContent = `Waypoint: Global`;
  }
  container.appendChild(wpInfo);

  return container;
}

function stableSpeedKmh(d) {
  const ema = Number(d.emaSpeed || 0)
  const avg = Number(d.avgSpeedKmh || 0)
  if (ema > 0 && avg > 0) return 0.5 * ema + 0.5 * avg
  if (avg > 0) return avg
  return Math.max(0, ema)
}

function refreshDevicesOnMap() {
  for (const d of tracking.list) {
    let entry = deviceLayers.get(d.id);
    if (!entry) {
      const marker = L.circleMarker([0,0], { radius: 7, weight: 2, color: d.color ?? '#e53935', fillOpacity: 1 }).addTo(map);
      const tail = L.polyline([], { color: d.color ?? '#e53935', opacity: 0.6, weight: 3, interactive: false }).addTo(map);
      const halo = L.circleMarker([0,0], { radius: 14, weight: 3, color: '#FFD700', opacity: 0.9, fillOpacity: 0, interactive: false }).addTo(map);
      halo.setStyle({ opacity: 0 });
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
      entry.marker.on('mouseover', () => entry.marker.openPopup());
      entry.marker.on('mouseout', () => entry.marker.closePopup());
    }
  }
}

/* ===== Waypoints en el mapa ===== */

function ensureWaypointsLayer() {
  if (!waypointsLayer) {
    waypointsLayer = L.layerGroup().addTo(map)
  }
}

function renderWaypoints() {
  ensureWaypointsLayer()
  // Elimina marcadores que ya no existan
  for (const [id, m] of waypointMarkers.entries()) {
    if (!waypoints.byId?.[id]) {
      m.remove()
      waypointMarkers.delete(id)
    }
  }
  // Crea/actualiza
  for (const wp of waypoints.sorted) {
    const pos = latLonAtKm(wp.km)
    const lat = pos?.lat ?? wp.lat
    const lon = pos?.lon ?? wp.lon
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    let marker = waypointMarkers.get(wp.id)
    if (!marker) {
      marker = L.circleMarker([lat, lon], { radius: 6, weight: 2, color: '#222', fillColor: '#fff', fillOpacity: 1 })
        .addTo(waypointsLayer)
        .bindTooltip(`${wp.name} (${wp.km.toFixed(2)} km)`, { permanent: false, direction: 'top', offset: [0, -6] })
      marker.on('click', () => openEditor(wp))
      waypointMarkers.set(wp.id, marker)
    } else {
      marker.setLatLng([lat, lon])
      marker.setTooltipContent(`${wp.name} (${wp.km.toFixed(2)} km)`)
    }
  }
}

function onTrackClick(e) {
  const snap = snapToGpx(e.latlng.lat, e.latlng.lng)
  if (!snap) return
  openEditor({ id: null, name: '', km: snap.km, lat: snap.lat, lon: snap.lon })
}

function openEditor(model) {
  editorModel.value = { id: model.id || null, name: model.name || '', km: Number(model.km || 0), lat: model.lat ?? null, lon: model.lon ?? null }
  editorOpen.value = true
}

function onSaveWaypoint(payload) {
  // Recalcular posición por km (evita desajustes)
  const pos = latLonAtKm(payload.km)
  const lat = pos?.lat ?? payload.lat
  const lon = pos?.lon ?? payload.lon
  waypoints.addOrUpdate({ ...payload, lat, lon })
  editorOpen.value = false
  renderWaypoints()
}
function onRemoveWaypoint(id) {
  waypoints.remove(id)
  editorOpen.value = false
  renderWaypoints()
}

/* ===== Utilidades GPX: proyección por píxeles y km->latlon ===== */

function snapToGpx(lat, lon) {
  const cps = gpx.cps
  if (!Array.isArray(cps) || cps.length < 2) return null
  const P = map.latLngToLayerPoint([lat, lon])
  let best = { i: 0, t: 0, d2: Infinity }
  for (let i = 0; i < cps.length - 1; i++) {
    const A = map.latLngToLayerPoint([cps[i].lat, cps[i].lon])
    const B = map.latLngToLayerPoint([cps[i+1].lat, cps[i+1].lon])
    const v = { x: B.x - A.x, y: B.y - A.y }
    const w = { x: P.x - A.x, y: P.y - A.y }
    const c1 = v.x * w.x + v.y * w.y
    const c2 = v.x * v.x + v.y * v.y
    let t = c2 > 0 ? c1 / c2 : 0
    t = Math.max(0, Math.min(1, t))
    const proj = { x: A.x + t * v.x, y: A.y + t * v.y }
    const dx = P.x - proj.x, dy = P.y - proj.y
    const d2 = dx*dx + dy*dy
    if (d2 < best.d2) best = { i, t, d2 }
  }
  const i = best.i
  const t = best.t
  const km = cps[i].kmAcc + t * (cps[i+1].kmAcc - cps[i].kmAcc)
  const lat2 = cps[i].lat + t * (cps[i+1].lat - cps[i].lat)
  const lon2 = cps[i].lon + t * (cps[i+1].lon - cps[i].lon)
  return { km, lat: lat2, lon: lon2, index: i, t }
}

function latLonAtKm(km) {
  const cps = gpx.cps
  const total = Number(gpx.totalKm || 0)
  if (!Array.isArray(cps) || cps.length < 2 || total <= 0) return null
  const k = Math.max(0, Math.min(total, Number(km) || 0))
  // búsqueda binaria por kmAcc
  let lo = 0, hi = cps.length - 2
  if (k <= cps[0].kmAcc) return { lat: cps[0].lat, lon: cps[0].lon }
  if (k >= cps[cps.length - 1].kmAcc) {
    const last = cps[cps.length - 1]
    return { lat: last.lat, lon: last.lon }
  }
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (cps[mid].kmAcc <= k && k <= cps[mid + 1].kmAcc) {
      const a = cps[mid], b = cps[mid+1]
      const span = b.kmAcc - a.kmAcc || 1e-6
      const t = Math.max(0, Math.min(1, (k - a.kmAcc) / span))
      return { lat: a.lat + t*(b.lat - a.lat), lon: a.lon + t*(b.lon - a.lon) }
    }
    if (k > cps[mid + 1].kmAcc) lo = mid + 1
    else hi = mid - 1
  }
  const last = cps[cps.length - 1]
  return { lat: last.lat, lon: last.lon }
}

onMounted(async () => {
  waypoints.load()
  map = L.map('map', { preferCanvas: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  await gpx.loadFromPublic(props.gpxPath, props.cpStepMeters);
  drawTrack();

  ensureWaypointsLayer()
  renderWaypoints()

  tracking.connectWS?.('ws://localhost:3000');

  intervalId = setInterval(() => {
    refreshDevicesOnMap()
    // actualizar tooltips de waypoints por si cambió el km o nombre
    renderWaypoints()
  }, 500);
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

/* Selector de waypoint */
.wp-selector {
  position: absolute;
  left: 16px; top: 16px;
  z-index: 410;
  display: flex; flex-wrap: wrap; gap: 4px;
  background: rgba(255,255,255,.9);
  padding: 6px 8px; border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,.12);
}

/* Botones existentes */
.sidebar-toggle { position: absolute; right: 16px; top: 16px; z-index: 400; }
.profile-toggle { position: absolute; right: 72px; top: 16px; z-index: 400; }
.mr-1 { margin-right: 4px; }
</style>
