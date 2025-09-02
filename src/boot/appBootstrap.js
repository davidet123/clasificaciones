// src/boot/appBootstrap.js
import { useGpxStore } from '@/stores/gpxStore';
import { useTrackingStore } from '@/stores/trackingStore';
import { useRaceConfigStore } from '@/stores/raceConfigStore';

let started = false;
let reconnectTimer = null;

export function startAppBootstrap() {
  if (started) return;
  started = true;

  const gpx = useGpxStore();
  const tracking = useTrackingStore();
  const race = useRaceConfigStore();

  // 0) Cargar configuración (para leer gpxPath)
  try { race.init(); } catch {}

  // 1) Cargar GPX por defecto o el configurado
  try {
    const chosen = race.gpxPath && race.gpxPath.trim();
    if (!gpx.loaded && !gpx.loading) {
      if (chosen) gpx.loadFromPublic(chosen).catch(() => {});
      else gpx.loadFromPublic().catch(() => {});
    }
  } catch {/* silencioso */}

  // 2) Conectar WS si no hay uno activo
  const WS_URL = import.meta.env?.VITE_LIVE_WS_URL || 'ws://localhost:3000';
  try { tracking.connectWS?.(WS_URL); } catch {}

  // 3) Reintento suave si se cae el WS
  const loop = () => {
    try {
      const hasWs = Boolean(tracking._ws);
      if (!hasWs) tracking.connectWS?.(WS_URL);
    } catch {/* noop */}
    reconnectTimer = setTimeout(loop, 5000);
  };
  reconnectTimer = setTimeout(loop, 5000);
}

export function stopAppBootstrap() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}
