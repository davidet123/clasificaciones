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

    // Último replay seleccionado (mínimo {date, raceId})
    selected: null,
    
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
     * NUEVO: selección desde ReplaySelector
     * ============================ */
    // Dentro de actions{} de replayStore
    async setReplay(manifest) {
      // manifest esperado: { date, raceId, t0, tEnd, devices: [uniqueId,...] }
      try {
        // Limpieza y parada por si había algo en marcha
        this.stop();
        this.buffers = {};
        this.idxById = {};
        this.t0 = null;
        this.tEnd = null;
        this.tPlay = null;
        this.playing = false;
        this.paused = false;
        this.speed = 1;
        this.loop = false;
        this.selected = manifest || null;

        if (!manifest || !manifest.date || !manifest.raceId || !Array.isArray(manifest.devices) || !manifest.devices.length) {
          console.warn('[replay] Manifest incompleto', manifest);
          return;
        }

        // Tiempos absolutos del replay (ms epoch)
        this.t0 = Number(manifest.t0) || null;
        this.tEnd = Number(manifest.tEnd) || null;
        if (!(Number.isFinite(this.t0) && Number.isFinite(this.tEnd) && this.tEnd > this.t0)) {
          console.warn('[replay] t0/tEnd inválidos en manifest; abortando carga');
          return;
        }

        // De momento reproducimos el primer device de la lista
        const deviceId = String(manifest.devices[0]);

        // Construye URL NDJSON con el rango exacto del manifest
        const fromIso = new Date(this.t0).toISOString();
        const toIso   = new Date(this.tEnd).toISOString();
        const qs = new URLSearchParams({
          date: manifest.date,
          raceId: manifest.raceId,
          device: deviceId,
          from: fromIso,
          to: toIso,
        });
        const url = `/replay/ndjson?${qs.toString()}`;

        // Carga NDJSON -> rellena this.buffers, idxById, t0, tEnd, tPlay...
        await this.loadNdjsonFromUrl(url, { label: `${manifest.date}/${manifest.raceId}/${deviceId}` });

        // Fija reloj de reproducción al inicio del rango
        this.tPlay = this.t0;

        // OJO: aquí NO arrancamos nada. El scheduler va con play() -> _tick()
        // Si quieres auto-play tras seleccionar, hazlo en la UI: replay.play();

        console.log('[replay] Manifest cargado y NDJSON listo:', deviceId, new Date(this.t0), new Date(this.tEnd));
      } catch (e) {
        console.error('[replay] setReplay error', e);
      }
    },


    async loadFromManifest(date, raceId) {
      this.resetAll();
      const absManUrl = `http://localhost:3000/replays/${encodeURIComponent(date)}/${encodeURIComponent(raceId)}/manifest.json`;
      try {
        // 1) Intento con manifest.json
        const manRes = await fetch(absManUrl);
        if (!manRes.ok) throw new Error(`Manifest HTTP ${manRes.status}`);
        const manifest = await manRes.json();

        const t0ms = Number(manifest.t0);
        const tEndms = Number(manifest.tEnd);
        if (!Number.isFinite(t0ms) || !Number.isFinite(tEndms) || tEndms <= t0ms) {
          throw new Error('Manifest sin rango temporal válido');
        }

        // devices del manifest o fallback a /replay/devices
        let devices = Array.isArray(manifest.devices) ? manifest.devices : [];
        if (!devices.length) {
          const devQs = new URLSearchParams({ date, raceId });
          const devRes = await fetch(`http://localhost:3000/replay/devices?${devQs.toString()}`);
          if (!devRes.ok) throw new Error(`Devices HTTP ${devRes.status}`);
          devices = await devRes.json();
        }
        if (!Array.isArray(devices) || !devices.length) throw new Error('No hay dispositivos en el replay');

        const device = String(devices[0]);
        const fromIso = new Date(t0ms).toISOString();
        const toIso = new Date(tEndms).toISOString();

        const qs = new URLSearchParams({ date, raceId, device, from: fromIso, to: toIso });
        const ndjsonUrl = `/replay/ndjson?${qs.toString()}`;
        await this.loadNdjsonFromUrl(ndjsonUrl, { label: `${date}/${raceId}/${device}` });
        this.meta = { date, raceId, device, manifestUrl: absManUrl };
      } catch (e) {
        console.warn('[replay] manifest no disponible, usando fallback total:', e?.message || e);

        // 2) Fallback sin manifest: obtener devices y pedir TODO el ndjson
        try {
          const devQs = new URLSearchParams({ date, raceId });
          const devRes = await fetch(`http://localhost:3000/replay/devices?${devQs.toString()}`);
          if (!devRes.ok) throw new Error(`Devices HTTP ${devRes.status}`);
          const devices = await devRes.json();
          if (!Array.isArray(devices) || !devices.length) throw new Error('No hay dispositivos en el replay');

          const device = String(devices[0]);
          // rango amplio para recuperar todo; el parser calcula t0/tEnd
          const qs = new URLSearchParams({
            date, raceId, device,
            from: '1970-01-01T00:00:00.000Z',
            to:   '2100-01-01T00:00:00.000Z'
          });
          const ndjsonUrl = `/replay/ndjson?${qs.toString()}`;
          await this.loadNdjsonFromUrl(ndjsonUrl, { label: `${date}/${raceId}/${device}` });
          this.meta = { date, raceId, device, manifestUrl: null };
        } catch (e2) {
          console.error('[replay] fallback total también falló:', e2);
          this.resetAll();
          throw e2;
        }
      }
    },

    /* ============================
     * CARGA DE NDJSON (bridge)
     * ============================ */
    async loadNdjsonFromUrl(url, { label = null } = {}) {
      this.stop(); // por si estaba reproduciendo
      this.buffers = {};
      this.idxById = {};
      this.t0 = this.tEnd = this.tPlay = null;
      this.source = null;
      this.meta = null;

      // Carga completa en memoria (simple y robusto)
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
      for (const id of Object.keys(this.buffers)) {
        const arr = this.buffers[id];
        let idx = this.idxById[id] ?? 0;
        while (idx < arr.length && arr[idx].ts <= this.tPlay) {
          this._emitPoint(arr[idx]);
          idx++;
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
        if (typeof this._tracking.ingestReplayPoint === 'function') {
          this._tracking.ingestReplayPoint(p.id, {
            lat: p.lat, lon: p.lon,
            velocidad: Number.isFinite(p.speedKmh) ? p.speedKmh : 0,
            altitud: Number.isFinite(p.alt) ? p.alt : 0,
            direccion: Number.isFinite(p.course) ? p.course : 0,
            ts: p.ts
          });
        } else if (typeof this._tracking._applyIncoming === 'function') {
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
