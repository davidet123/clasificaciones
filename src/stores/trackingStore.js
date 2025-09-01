// src/stores/trackingStore.js
import { defineStore } from 'pinia';
import { useGpxStore } from '@/stores/gpxStore';
import {
  progressBetweenCps,
  haversineKm,
  kmhToPaceMinPerKm,
} from '@/utils/geo';

// Paleta por si quieres colores por id simples
const COLORS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1'];

export const useTrackingStore = defineStore('tracking', {
  state: () => ({
    // Dispositivos
    byId: {},      // id -> device object
    list: [],      // array ordenada para UI

    // Crono global (ms desde "fuente de tiempo")
    startTime: null,

    // Fuente de tiempo (para replay se inyecta tPlay)
    _timeSource: null,

    // WS
    _ws: null,
    _wsUrl: null,
    _wsConnected: false,

    // Parámetros de cálculo
    etaStartPercent: 0.08,       // no armar ETA hasta 8% del GPX
    offRouteMaxMeters: 40,       // tolerancia de desvío al track
    historyMaxSec: 240,          // mantener ~4 min de histórico por dispositivo
    emaAlphaSpeed: 0.25,         // suavizado de velocidad instantánea

    // Opcional: para numerar colores
    _colorIdx: 0,
  }),

  getters: {
    etaStartPercentLabel: (s) => Math.round(s.etaStartPercent * 100),
    isCronoRunning: (s) => !!s.startTime,
  },

  actions: {
    /* ===========================
     *  Gestión de tiempo / Crono global
     * =========================== */

    setTimeSource(fnOrNull) {
      // fnOrNull: () => number (ms). Si null, usa Date.now()
      this._timeSource = typeof fnOrNull === 'function' ? fnOrNull : null;
    },
    _nowMs() {
      try {
        const v = this._timeSource ? this._timeSource() : Date.now();
        return Number.isFinite(v) ? v : Date.now();
      } catch {
        return Date.now();
      }
    },

    // Arranque manual del crono global (sin mirar CPs)
    startCronoGlobal() {
      if (!this.startTime) this.startTime = this._nowMs();
    },

    // Compat: algunos componentes antiguos llaman a esto
    startCronoAtFirstCP() { this.startCronoGlobal(); },
    // Compat: botón viejo "forceStartAtFirstCP"
    forceStartAtFirstCP() { this.startCronoGlobal(); },

    stopCrono() {
      this.startTime = null;
    },
    resetCrono() {
      this.startTime = null;
    },
    // Usado por la UI (tenías un resetAll en el panel)
    resetAll() {
      this.stopCrono();
      // Limpia métricas por dispositivo pero conserva ids/colores
      for (const d of this.list) {
        d.last = null;
        d.history = [];
        d.historyProj = [];
        d.kmRecorridos = 0;
        d.kmRestantes = useGpxStore().totalKm || 0;
        d.cpIdx = 0;
        d.progressPct = 0;
        d.paceAvgMinPerKm = null;
        d.emaSpeed = null;
        d.etaArmed = false;
        d.etaMs = null;
        d.target = { deltaToPBms: null, onTarget: false };
        d.consistency = null;
        d.status = { offRoute: false, outlierJump: false, frozenEta: false, gapSec: 0 };
      }
    },

    // Si el dispositivo ya está más allá de CP1 y el crono aún no está, arráncalo
    ensureCronoStartedIfBeyondCp1(deviceId) {
      const d = this.byId?.[deviceId] || this.list.find(x => x.id === deviceId);
      if (!d) return;
      const cp = Number(d.cpIdx ?? 0);
      if (!this.startTime && cp >= 1) {
        this.startTime = this._nowMs();
      }
    },

    /* ===========================
     *  Entrada de puntos para REPLAY (inyecta como si fuera WS)
     * =========================== */

    ingestReplayPoint(id, datos) {
      const info = {
        identificador: String(id),
        datos: {
          lat: Number(datos.lat),
          lon: Number(datos.lon),
          velocidad: Number(datos.velocidad) || 0, // km/h
          altitud: Number(datos.altitud) || 0,
          direccion: Number(datos.direccion) || 0,
        }
      };
      if (!this.byId[id]) {
        console.debug('[tracking] first point for', id, info.datos);
      }
      this._applyIncoming(info);
    },

    /* ===========================
     *  WebSocket LIVE
     * =========================== */

    connectWS(url) {
      try {
        if (this._ws) {
          try { this._ws.close(); } catch {}
          this._ws = null;
        }
        this._wsUrl = url;
        const ws = new WebSocket(url);
        this._ws = ws;

        ws.onopen = () => { this._wsConnected = true; };
        ws.onclose = () => { this._wsConnected = false; if (this._ws === ws) this._ws = null; };
        ws.onerror = () => { /* silenciar */ };
        ws.onmessage = (evt) => {
          try {
            this.onMessage(evt);
          } catch (e) {
            console.error('trackingStore.onMessage error', e);
          }
        };
      } catch (e) {
        console.error('connectWS failed', e);
      }
    },

    disconnectWS() {
      if (this._ws) {
        try { this._ws.close(); } catch {}
        this._ws = null;
      }
      this._wsConnected = false;
    },

    onMessage(evt) {
      // Espera objetos sueltos o arrays desde tu proxy
      // Contrato: { identificador, datos: { lat, lon, velocidad(km/h), altitud, direccion } }
      let payload;
      try {
        payload = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
      } catch {
        return;
      }
      if (!payload) return;

      // puede venir array
      const items = Array.isArray(payload) ? payload : [payload];

      for (const it of items) {
        if (!it || !it.identificador || !it.datos) continue;
        this._applyIncoming(it);
      }
    },

    /* ===========================
     *  Núcleo de actualización
     * =========================== */

    _applyIncoming(info) {
      const gpx = useGpxStore();
      if (!gpx.loaded || !gpx.cps?.length) {
        // sin GPX cargado aún, ignora
        return;
      }

      const ts = this._nowMs();

      // Datos normalizados
      const id = String(info.identificador);
      const lat = Number(info.datos.lat);
      const lon = Number(info.datos.lon);
      const velKmhRaw = Number(info.datos.velocidad) || 0;
      const alt = Number(info.datos.altitud) || 0;
      const dir = Number(info.datos.direccion) || 0;

      // Crea dispositivo si no existe
      let d = this.byId[id];
      if (!d) {
        d = this.byId[id] = {
          id,
          color: COLORS[this._colorIdx++ % COLORS.length],
          last: null,
          history: [],         // [{ts, lat, lon, velKmh}]
          historyProj: [],     // [{ts, km}]
          kmRecorridos: 0,
          kmRestantes: gpx.totalKm,
          cpIdx: 0,
          progressPct: 0,
          paceAvgMinPerKm: null,
          emaSpeed: null,
          etaArmed: false,
          etaMs: null,         // ms restantes estimados (contdown)
          target: { deltaToPBms: null, onTarget: false },
          personalBest: { pbTimeMs: null, pbDistanceKm: null, targetPaceMinPerKm: null },
          consistency: null,
          status: { offRoute: false, outlierJump: false, frozenEta: false, gapSec: 0 },
        };
        this.list.push(d);
      }

      // Gap de recepción
      if (d.last?.ts) {
        d.status.gapSec = (ts - d.last.ts) / 1000;
      } else {
        d.status.gapSec = 0;
      }

      // Filtro de salto grosero (protege de dientes de sierra)
      let outlierJump = false;
      if (d.last?.lat != null && d.last?.lon != null && d.last?.ts) {
        const dt = Math.max(0.001, (ts - d.last.ts) / 1000);
        const dKm = haversineKm(d.last.lat, d.last.lon, lat, lon);
        const vKmhGeom = (dKm / (dt / 3600));
        if (vKmhGeom > 60) outlierJump = true; // a pie, 60 km/h es un salto
      }
      d.status.outlierJump = outlierJump;

      // Histórico crudo (limitado por tiempo)
      d.history.push({ ts, lat, lon, velKmh: velKmhRaw, alt, dir });
      const cutoff = ts - this.historyMaxSec * 1000;
      while (d.history.length && d.history[0].ts < cutoff) d.history.shift();

      // Proyección sobre GPX con ventana alrededor del último cpIdx
      const proj = progressBetweenCps(lat, lon, gpx.cps, gpx.totalKm, Math.max(0, d.cpIdx - 3));
      d.kmRecorridos = proj.kmRecorridos;
      d.kmRestantes = proj.kmRestantes;

      // Off-route aproximado por distancia lateral a segmento
      d.status.offRoute = proj && typeof proj.distDesdeCPm === 'number'
        ? (proj.distDesdeCPm < -this.offRouteMaxMeters || proj.distHastaCPm < -this.offRouteMaxMeters)
        : false;

      // cpIdx por km acumulado (búsqueda binaria)
      d.cpIdx = findCpIdxByKm(gpx.cps, d.kmRecorridos);
      d.progressPct = gpx.totalKm > 0 ? (d.kmRecorridos / gpx.totalKm) * 100 : 0;

      // Histórico proyectado
      d.historyProj.push({ ts, km: d.kmRecorridos });
      while (d.historyProj.length && d.historyProj[0].ts < cutoff) d.historyProj.shift();

      // Velocidad suavizada (EMA)
      if (d.emaSpeed == null) d.emaSpeed = velKmhRaw;
      d.emaSpeed = this.emaAlphaSpeed * velKmhRaw + (1 - this.emaAlphaSpeed) * d.emaSpeed;

      // Ritmo rolling (min/km)
      d.paceAvgMinPerKm = kmhToPaceMinPerKm(d.emaSpeed);

      // ===== Crono global: auto-start al cruzar CP1, y stop en meta =====
      if (!this.startTime) {
        if (d.cpIdx >= 1) {
          this.startTime = this._nowMs();
        }
      } else {
        if (d.kmRecorridos >= gpx.totalKm - 1e-6) {
          this.stopCrono(); // meta alcanzada
        }
      }

      // ===== ETA (se arma tras % mínimo) =====
      const armed = (d.kmRecorridos / gpx.totalKm) >= this.etaStartPercent;
      d.etaArmed = armed;
      if (armed) {
        const remKm = Math.max(0, d.kmRestantes);
        const vAvg = this._avgSpeedKmhByDistance(d.historyProj, 0.35); // media en ~35% del camino reciente
        const vStable = robustSpeedKmh(d.emaSpeed, vAvg);
        if (vStable > 0.1 && remKm > 0) {
          const hoursLeft = remKm / vStable;
          d.etaMs = Math.round(hoursLeft * 3600 * 1000); // ms restantes
          d.status.frozenEta = false;
        } else {
          d.status.frozenEta = true;
        }
      } else {
        d.etaMs = null;
        d.status.frozenEta = false;
      }

      // ===== PB / Objetivo =====
      updatePersonalBestTarget(d, gpx.totalKm);
      if (d.personalBest?.pbTimeMs && d.etaArmed && Number.isFinite(d.etaMs)) {
        const pbAdjMs = d.personalBest.pbTimeMs * (gpx.totalKm / (d.personalBest.pbDistanceKm || gpx.totalKm));
        const delta = d.etaMs - pbAdjMs;
        d.target.deltaToPBms = delta;
        d.target.onTarget = delta <= 0;
      } else {
        d.target.deltaToPBms = null;
        d.target.onTarget = false;
      }

      // ===== Consistencia (buckets ~200 m + MAD-lite) =====
      d.consistency = computeConsistency(d.historyProj);

      // Último
      d.last = { ts, lat, lon, velKmh: velKmhRaw, alt, dir };
    },

    /* ===========================
     *  PB helpers / API pública
     * =========================== */

    setPersonalBest(id, pbTimeMs, pbDistKm) {
      const d = this.byId?.[id];
      if (!d) return;
      if (!d.personalBest) d.personalBest = {};
      d.personalBest.pbTimeMs = Number(pbTimeMs);
      if (Number.isFinite(pbDistKm) && pbDistKm > 0) {
        d.personalBest.pbDistanceKm = Number(pbDistKm);
      }
      // ritmo objetivo para info
      updatePersonalBestTarget(d, useGpxStore().totalKm);
    },

    /* ===========================
     *  Utilidades internas
     * =========================== */

    // Velocidad media por distancia: tramo reciente, recorta outliers, media simple
    _avgSpeedKmhByDistance(historyProj, fraction = 0.3) {
      if (!Array.isArray(historyProj) || historyProj.length < 2) return 0;
      const totalDt = historyProj[historyProj.length - 1].ts - historyProj[0].ts;
      if (totalDt <= 0) return 0;

      const totalKmSpan = historyProj[historyProj.length - 1].km - historyProj[0].km;
      if (totalKmSpan <= 0) return 0;

      // ventana por distancia: último (fraction * totalKmSpan), acotado 0.15..1.2 km
      const spanKm = clamp(totalKmSpan * fraction, 0.15, 1.2);
      const endKm = historyProj[historyProj.length - 1].km;
      const startKm = Math.max(historyProj[0].km, endKm - spanKm);

      // Integración por pares dentro de la ventana
      let distKm = 0;
      let timeMs = 0;
      for (let i = historyProj.length - 1; i > 0; i--) {
        const a = historyProj[i - 1], b = historyProj[i];
        if (b.km <= startKm) break;
        const kmA = Math.max(startKm, a.km);
        const kmB = b.km;
        if (kmB <= kmA) continue;
        const tA = a.ts, tB = b.ts;
        const segKm = kmB - kmA;
        const segMs = Math.max(0, tB - tA);
        // descartar segmentos raros (fuera de 3:00/km..15:00/km)
        const vKmh = segMs > 0 ? (segKm / (segMs / 3600000)) : 0;
        if (vKmh > 20 || vKmh < 4) continue; // a pie
        distKm += segKm;
        timeMs += segMs;
      }
      if (timeMs <= 0 || distKm <= 0) return 0;
      const v = distKm / (timeMs / 3600000);
      return v;
    },
  }
});

/* ===========================
 *  Helpers fuera del store
 * =========================== */

// Encuentra cpIdx tal que cps[i].kmAcc <= km < cps[i+1].kmAcc
function findCpIdxByKm(cps, km) {
  let lo = 0, hi = cps.length - 2;
  if (km <= cps[0].kmAcc) return 0;
  if (km >= cps[cps.length - 1].kmAcc) return cps.length - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cps[mid].kmAcc <= km && km < cps[mid + 1].kmAcc) return mid;
    if (km >= cps[mid + 1].kmAcc) lo = mid + 1; else hi = mid - 1;
  }
  return Math.max(0, Math.min(cps.length - 2, lo));
}

// Suavizado robusto de velocidad: combina EMA e integración reciente si existe
function robustSpeedKmh(ema, avgRecent) {
  if (avgRecent > 0 && ema > 0) return 0.5 * ema + 0.5 * avgRecent;
  if (avgRecent > 0) return avgRecent;
  return Math.max(0, ema || 0);
}

// Consistencia de ritmo con buckets por distancia (~200 m) y MAD lite
function computeConsistency(historyProj) {
  if (!Array.isArray(historyProj) || historyProj.length < 3) return null;

  // Crear buckets de ~0.2 km
  const targetKm = 0.2;
  const buckets = [];
  let accStart = historyProj[0].km;
  let tStart = historyProj[0].ts;

  for (let i = 1; i < historyProj.length; i++) {
    const a = historyProj[i - 1], b = historyProj[i];
    const dk = b.km - a.km;
    const dt = b.ts - a.ts;
    if (dt <= 0 || dk <= 0) continue;

    if ((b.km - accStart) >= targetKm) {
      const segKm = b.km - accStart;
      const segMs = b.ts - tStart;
      const vKmh = segMs > 0 ? (segKm / (segMs / 3600000)) : 0;
      const paceMin = kmhToPaceMinPerKm(vKmh);
      if (paceMin && paceMin > 0) buckets.push(paceMin * 60); // s/km
      accStart = b.km;
      tStart = b.ts;
    }
  }
  if (buckets.length < 4) return null;

  // Trim outliers y MAD
  buckets.sort((a, b) => a - b);
  const qLo = buckets[Math.floor(buckets.length * 0.1)];
  const qHi = buckets[Math.floor(buckets.length * 0.9)];
  const trimmed = buckets.filter(x => x >= qLo && x <= qHi);
  if (trimmed.length < 3) return null;

  const median = trimmed[Math.floor(trimmed.length / 2)];
  const deviations = trimmed.map(x => Math.abs(x - median)).sort((a, b) => a - b);
  const mad = deviations[Math.floor(deviations.length / 2)];
  const stdEq = 1.4826 * mad; // aproximación std

  const label =
    stdEq <= 6 ? 'muy constante' :
    stdEq <= 10 ? 'constante' :
    stdEq <= 18 ? 'variable' : 'muy variable';

  return { paceStdSec: stdEq, paceVarLabel: label };
}

// PB helper
function updatePersonalBestTarget(d, gpxTotalKm) {
  const pbMs = d.personalBest?.pbTimeMs;
  const pbKm = d.personalBest?.pbDistanceKm || gpxTotalKm || 0;
  if (!pbMs || !pbKm) {
    d.personalBest = d.personalBest || {};
    d.personalBest.targetPaceMinPerKm = null;
    return;
  }
  const paceMinPerKm = (pbMs / 60000) / pbKm;
  d.personalBest.targetPaceMinPerKm = paceMinPerKm;
}

/* ===========================
 *  Export utilidades usadas fuera
 * =========================== */

export function msToHMS(ms) {
  const v = Number(ms);
  if (!isFinite(v) || v < 0) return '00:00:00';
  const s = Math.floor(v / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function parseHMSToMs(str) {
  if (!str || typeof str !== 'string') return 0;
  const parts = str.trim().split(':').map(Number);
  if (parts.some(p => !Number.isFinite(p))) return 0;
  let hh = 0, mm = 0, ss = 0;
  if (parts.length === 3) [hh, mm, ss] = parts;
  else if (parts.length === 2) [mm, ss] = parts;
  else if (parts.length === 1) ss = parts[0];
  return ((hh * 3600) + (mm * 60) + ss) * 1000;
}

// Pequeñas utilidades locales
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
