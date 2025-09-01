// src/stores/replayStore.js
import { defineStore } from 'pinia';
import { parseKmlTracks } from '@/utils/kmlParser';

// Pequeña utilidad
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) - Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export const useReplayStore = defineStore('replay', {
  state: () => ({
    // Referencia al trackingStore para inyectar puntos
    _tracking: null,

    // Buffer de replays: id -> array de { ts, id, lat, lon, alt, speedKmh, course }
    buffers: {},

    // Índices de reproducción por id
    idxById: {},

    // Límites de tiempo globales del conjunto
    t0: null,
    tEnd: null,

    // Reloj de reproducción
    playing: false,
    paused: false,
    speed: 1,          // 1x, 2x, 4x, 8x, 16x
    tPlay: null,       // ms epoch actual de reproducción
    _timer: null,
    _lastTick: null,

    // Opciones
    loop: false,

    // Info de fuente (para UI)
    source: null,      // 'ndjson' | 'kml'
    meta: null,        // datos auxiliares (date, raceId, device, fileName, etc.)
  }),

  getters: {
    hasData: (s) => Object.values(s.buffers).some(arr => Array.isArray(arr) && arr.length > 0),
    deviceIds: (s) => Object.keys(s.buffers),
    durationMs: (s) => (s.t0 != null && s.tEnd != null) ? (s.tEnd - s.t0) : 0,
    progressPct: (s) => {
      if (!s.t0 || !s.tEnd || !s.tPlay) return 0;
      const pct = ((s.tPlay - s.t0) / (s.tEnd - s.t0)) * 100;
      return Math.max(0, Math.min(100, pct));
    },
  },

  actions: {
    attachTracking(trackingStore) {
      this._tracking = trackingStore || null;
    },

    resetAll() {
      this.stop();
      this.buffers = {};
      this.idxById = {};
      this.t0 = this.tEnd = this.tPlay = null;
      this.source = null;
      this.meta = null;
      this.loop = false;
      this.speed = 1;
    },

    /* ============================
     * CARGA DE NDJSON (bridge)
     * ============================ */
    async loadNdjsonFromUrl(url, { label = null } = {}) {
      this.resetAll();

      // Carga completa en memoria (simple y robusto). Si el fichero es gigantesco, ya optimizamos.
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`NDJSON HTTP ${resp.status}`);
      const text = await resp.text();

      // Parse NDJSON
      const buffers = {};
      let minTs = Infinity, maxTs = -Infinity;

      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        let obj;
        try { obj = JSON.parse(line); } catch { continue; }
        const id = String(obj.id || obj.identificador || obj.device || 'device');
        const ts = Number(obj.ts);
        const lat = Number(obj.lat);
        const lon = Number(obj.lon);
        const alt = Number.isFinite(obj.alt) ? obj.alt : (Number.isFinite(obj.altitude) ? obj.altitude : null);
        let speedKmh = Number(obj.speedKmh);
        let course = Number(obj.course);

        if (!Number.isFinite(ts) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        if (!buffers[id]) buffers[id] = [];
        buffers[id].push({ ts, id, lat, lon, alt, speedKmh: Number.isFinite(speedKmh) ? speedKmh : null, course: Number.isFinite(course) ? course : null });

        if (ts < minTs) minTs = ts;
        if (ts > maxTs) maxTs = ts;
      }

      // Ordenar y completar velocidad/rumbo faltantes
      for (const id of Object.keys(buffers)) {
        const arr = buffers[id].sort((a, b) => a.ts - b.ts);
        for (let i = 1; i < arr.length; i++) {
          const a = arr[i - 1], b = arr[i];
          if (!Number.isFinite(b.speedKmh) || !Number.isFinite(b.course)) {
            const dt = Math.max(0.001, (b.ts - a.ts) / 1000);
            const dKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
            const v = dKm / (dt / 3600);
            if (!Number.isFinite(b.speedKmh)) b.speedKmh = v;
            if (!Number.isFinite(b.course)) b.course = bearingDeg(a.lat, a.lon, b.lat, b.lon);
          }
        }
        // copia al primero si quedó indefinido
        if (arr[0] && (!Number.isFinite(arr[0].speedKmh) || !Number.isFinite(arr[0].course)) && arr[1]) {
          if (!Number.isFinite(arr[0].speedKmh)) arr[0].speedKmh = arr[1].speedKmh;
          if (!Number.isFinite(arr[0].course)) arr[0].course = arr[1].course;
        }
      }

      this.buffers = buffers;
      this.idxById = Object.fromEntries(Object.keys(buffers).map(id => [id, 0]));
      this.t0 = isFinite(minTs) ? minTs : null;
      this.tEnd = isFinite(maxTs) ? maxTs : null;
      this.tPlay = this.t0;
      this.source = 'ndjson';
      this.meta = label ? { label, url } : { url };

      // No arrancamos aún; que la UI pulse Play
    },

    /* ============================
     * CARGA DE KML (archivo local)
     * ============================ */
    async loadKmlFile(file, { overrideId = null } = {}) {
      this.resetAll();
      const text = await file.text();
      const { tracksById, t0, tEnd } = parseKmlTracks(text);

      // Si el KML trae varios tracks, podemos quedarnos con todos (o con overrideId si se pasó).
      let buffers = {};
      if (overrideId && tracksById[overrideId]) {
        buffers[overrideId] = tracksById[overrideId];
      } else if (overrideId && !tracksById[overrideId]) {
        // renombrar el primero al overrideId
        const firstId = Object.keys(tracksById)[0];
        buffers[overrideId] = tracksById[firstId] || [];
      } else {
        buffers = tracksById;
      }

      // Asegura velocidad/rumbo
      for (const id of Object.keys(buffers)) {
        const arr = buffers[id].sort((a, b) => a.ts - b.ts);
        for (let i = 1; i < arr.length; i++) {
          const A = arr[i - 1], B = arr[i];
          const dt = Math.max(0.001, (B.ts - A.ts) / 1000);
          const dKm = haversineKm(A.lat, A.lon, B.lat, B.lon);
          if (!Number.isFinite(B.speedKmh)) B.speedKmh = dKm / (dt / 3600);
          if (!Number.isFinite(B.course)) B.course = bearingDeg(A.lat, A.lon, B.lat, B.lon);
        }
        if (arr[0] && arr[1]) {
          if (!Number.isFinite(arr[0].speedKmh)) arr[0].speedKmh = arr[1].speedKmh;
          if (!Number.isFinite(arr[0].course)) arr[0].course = arr[1].course;
        }
      }

      this.buffers = buffers;
      this.idxById = Object.fromEntries(Object.keys(buffers).map(id => [id, 0]));
      this.t0 = t0 || null;
      this.tEnd = tEnd || null;
      this.tPlay = this.t0;
      this.source = 'kml';
      this.meta = { fileName: file.name };
    },

    /* ============================
     * CONTROL DE REPRODUCCIÓN
     * ============================ */
    play() {
      if (!this.hasData) return;
      if (this.playing && !this.paused) return;
      this.playing = true;
      this.paused = false;
      this._lastTick = performance.now();

      // Si el tracking tiene timeSource, apúntalo al tPlay
      try { this._tracking?.setTimeSource?.(() => this.tPlay); } catch {}

      this._tick();
    },

    pause() {
      if (!this.playing) return;
      this.paused = true;
      if (this._timer) { cancelAnimationFrame(this._timer); this._timer = null; }
    },

    stop() {
      if (this._timer) { cancelAnimationFrame(this._timer); this._timer = null; }
      this.playing = false;
      this.paused = false;
      // reinicia índices y tiempo
      this.idxById = Object.fromEntries(Object.keys(this.buffers).map(id => [id, 0]));
      this.tPlay = this.t0;
      // Restablece el timeSource del tracking si existía
      try { this._tracking?.setTimeSource?.(null); } catch {}
    },

    setSpeed(mult) {
      if (!Number.isFinite(mult) || mult <= 0) return;
      this.speed = mult;
    },

    seekPct(pct) {
      if (!this.hasData || !this.t0 || !this.tEnd) return;
      const clamped = Math.max(0, Math.min(100, pct));
      this.tPlay = this.t0 + ((this.tEnd - this.t0) * (clamped / 100));
      // Reposicionar índices al punto más cercano <= tPlay
      for (const id of Object.keys(this.buffers)) {
        const arr = this.buffers[id];
        let lo = 0, hi = arr.length - 1, idx = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (arr[mid].ts <= this.tPlay) { idx = mid; lo = mid + 1; } else { hi = mid - 1; }
        }
        this.idxById[id] = idx;
        // Inyecta ese punto inmediatamente
        const p = arr[idx];
        this._emitPoint(p);
      }
    },

    /* ============================
     * LOOP PRINCIPAL
     * ============================ */
    _tick() {
      if (!this.playing || this.paused) return;
      const now = performance.now();
      const dtMs = (now - (this._lastTick || now)) * this.speed;
      this._lastTick = now;
      if (this.tPlay == null) this.tPlay = this.t0;
      else this.tPlay = Math.min(this.tEnd ?? this.tPlay, this.tPlay + dtMs);

      // Emitir todos los puntos con ts <= tPlay
      let anyPending = false;
      for (const id of Object.keys(this.buffers)) {
        const arr = this.buffers[id];
        let idx = this.idxById[id] ?? 0;
        while (idx < arr.length && arr[idx].ts <= this.tPlay) {
          this._emitPoint(arr[idx]);
          idx++;
          anyPending = true;
        }
        this.idxById[id] = idx;
      }

      // Fin de reproducción
      const endedForAll = Object.keys(this.buffers).every(id => (this.idxById[id] ?? 0) >= this.buffers[id].length);
      if (endedForAll) {
        if (this.loop) {
          // reinicia
          this.idxById = Object.fromEntries(Object.keys(this.buffers).map(id => [id, 0]));
          this.tPlay = this.t0;
        } else {
          // stop
          this.stop();
          return;
        }
      }

      this._timer = requestAnimationFrame(() => this._tick());
    },

    _emitPoint(p) {
      if (!this._tracking) return;
      // Inyecta en tracking como si fuera live
      try {
        // Si tu trackingStore expone ingestReplayPoint(id, datos), úsalo:
        if (typeof this._tracking.ingestReplayPoint === 'function') {
          this._tracking.ingestReplayPoint(p.id, {
            lat: p.lat, lon: p.lon,
            velocidad: Number.isFinite(p.speedKmh) ? p.speedKmh : 0,
            altitud: Number.isFinite(p.alt) ? p.alt : 0,
            direccion: Number.isFinite(p.course) ? p.course : 0,
            // opcional: si tu tracking lee ts de aquí, lo mandamos
            ts: p.ts
          });
        } else if (typeof this._tracking._applyIncoming === 'function') {
          // Ruta “cruda” si hiciera falta
          this._tracking._applyIncoming({
            identificador: p.id,
            datos: {
              lat: p.lat, lon: p.lon,
              velocidad: Number.isFinite(p.speedKmh) ? p.speedKmh : 0,
              altitud: Number.isFinite(p.alt) ? p.alt : 0,
              direccion: Number.isFinite(p.course) ? p.course : 0
            },
            ts: p.ts
          });
        }
      } catch (e) {
        console.error('[replay] fallo al inyectar en tracking', e);
      }
    },
  }
});
