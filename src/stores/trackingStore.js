// src/stores/trackingStore.js
import { defineStore } from 'pinia';
import { useGpxStore } from '@/stores/gpxStore';
import {
  progressBetweenCps,
  haversineKm,
  kmhToPaceMinPerKm,
  altAtKm,
} from '@/utils/geo';

const COLORS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1'];

export const useTrackingStore = defineStore('tracking', {
  state: () => ({
    byId: {},
    list: [],

    startTime: null,
    _timeSource: null,

    _ws: null,
    _wsUrl: null,
    _wsConnected: false,

    etaStartPercent: 0.08,
    offRouteMaxMeters: 40,
    historyMaxSec: 240,
    emaAlphaSpeed: 0.25,

    minValidGpsSpeedKmh: 2,
    fallbackWindowSec: 12,
    fallbackMaxWindowSec: 20,
    fallbackMaxJumpKmh: 40,
    minTrackDeltaMeters: 28,
    hysteresisKmh: 0.7,

    slopeMinMeters: 15,
    slopeMaxMeters: 20,
    slopeMaxSeconds: 15,
    slopeClampPct: 40,

    graceMinMeters: 60,
    graceMinSeconds: 15,

    _colorIdx: 0,

    _dvrActive: false,
    _dvrRaceId: null,
    _dvrNotes: null,
    _bridgeHttpBase: 'http://localhost:3000',
  }),

  getters: {
    etaStartPercentLabel: (s) => Math.round(s.etaStartPercent * 100),
    isCronoRunning: (s) => !!s.startTime,
  },

  actions: {
    setTimeSource(fnOrNull) {
      this._timeSource = typeof fnOrNull === 'function' ? fnOrNull : null;
    },
    _nowMs() {
      try {
        const v = this._timeSource ? this._timeSource() : Date.now();
        return Number.isFinite(v) ? v : Date.now();
      } catch { return Date.now(); }
    },

    async startCronoGlobal() {
      if (!this.startTime) {
        this.startTime = this._nowMs();
        // inicializa kmStartAtCrono en el primer tick de cada device (ver _applyIncoming)
        await this._ensureDvrStarted();
      }
    },
    startCronoAtFirstCP() { return this.startCronoGlobal(); },
    forceStartAtFirstCP() { return this.startCronoGlobal(); },

    async stopCrono() {
      await this._ensureDvrStopped();
      this.startTime = null;
    },
    resetCrono() { this.startTime = null; },

    resetAll() {
      this.stopCrono();
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
        d.status = {
          offRoute: false, outlierJump: false, frozenEta: false, gapSec: 0,
          speedFromTrack: false, stationary: false, speedClass: 'auto'
        };
        d.avgSpeedKmh = null;
        d.slopePct = null;
        d._vEffHist = [];
        // forward / media simple
        d.kmStartAtCrono = null;
        d.kmMaxForward = 0;
        d._lastProjIdx = 0;
        d._offRouteStrikes = 0;
      }
    },

    ensureCronoStartedIfBeyondCp1(deviceId) {
      const d = this.byId?.[deviceId] || this.list.find(x => x.id === deviceId);
      if (!d) return;
      const cp = Number(d.cpIdx ?? 0);
      if (!this.startTime && cp >= 1) {
        this.startTime = this._nowMs();
        this._ensureDvrStarted();
      }
    },

    ingestReplayPoint(id, datos) {
      const info = {
        identificador: String(id),
        datos: {
          lat: Number(datos.lat),
          lon: Number(datos.lon),
          velocidad: Number(datos.velocidad) || 0,
          altitud: Number(datos.altitud) || 0,
          direccion: Number(datos.direccion) || 0,
        }
      };
      if (!this.byId[id]) console.debug('[tracking] first point for', id, info.datos);
      this._applyIncoming(info);
    },

    connectWS(url) {
      try {
        if (this._ws) { try { this._ws.close(); } catch {} this._ws = null; }
        this._wsUrl = url;
        const ws = new WebSocket(url);
        this._ws = ws;
        ws.onopen = () => { this._wsConnected = true; };
        ws.onclose = () => { this._wsConnected = false; if (this._ws === ws) this._ws = null; };
        ws.onerror = () => {};
        ws.onmessage = (evt) => { try { this.onMessage(evt); } catch (e) { console.error('trackingStore.onMessage error', e); } };
      } catch (e) { console.error('connectWS failed', e); }
    },
    disconnectWS() {
      if (this._ws) { try { this._ws.close(); } catch {} this._ws = null; }
      this._wsConnected = false;
    },
    onMessage(evt) {
      let payload;
      try { payload = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data; } catch { return; }
      if (!payload) return;
      const items = Array.isArray(payload) ? payload : [payload];
      for (const it of items) {
        if (!it || !it.identificador || !it.datos) continue;
        this._applyIncoming(it);
      }
    },

    _applyIncoming(info) {
      const gpx = useGpxStore();
      if (!gpx.loaded || !gpx.cps?.length) return;

      const ts = this._nowMs();

      const id = String(info.identificador);
      const lat = Number(info.datos.lat);
      const lon = Number(info.datos.lon);
      const velKmhRaw = Number(info.datos.velocidad) || 0;
      const alt = Number(info.datos.altitud) || 0;
      const dir = Number(info.datos.direccion) || 0;

      let d = this.byId[id];
      if (!d) {
        d = this.byId[id] = {
          id,
          color: COLORS[this._colorIdx++ % COLORS.length],
          last: null,
          history: [],
          historyProj: [],
          kmRecorridos: 0,
          kmRestantes: gpx.totalKm,
          cpIdx: 0,
          progressPct: 0,
          paceAvgMinPerKm: null,
          emaSpeed: null,
          etaArmed: false,
          etaMs: null,
          target: { deltaToPBms: null, onTarget: false },
          personalBest: { pbTimeMs: null, pbDistanceKm: null, targetPaceMinPerKm: null },
          consistency: null,
          status: {
            offRoute: false, outlierJump: false, frozenEta: false, gapSec: 0,
            speedFromTrack: false, stationary: false, speedClass: 'auto'
          },
          avgSpeedKmh: null,
          slopePct: null,
          _vEffHist: [],
          kmStartAtCrono: null,
          kmMaxForward: 0,
          _lastProjIdx: 0,
          _offRouteStrikes: 0,
        };
        this.list.push(d);
      }

      d.status.gapSec = d.last?.ts ? (ts - d.last.ts) / 1000 : 0;

      // outlier geométrico
      let outlierJump = false;
      if (d.last?.lat != null && d.last?.lon != null && d.last?.ts) {
        const dt = Math.max(0.001, (ts - d.last.ts) / 1000);
        const dKm = haversineKm(d.last.lat, d.last.lon, lat, lon);
        const vKmhGeom = (dKm / (dt / 3600));
        if (vKmhGeom > 60) outlierJump = true;
      }
      d.status.outlierJump = outlierJump;

      d.history.push({ ts, lat, lon, velKmh: velKmhRaw, alt, dir });
      const cutoff = ts - this.historyMaxSec * 1000;
      while (d.history.length && d.history[0].ts < cutoff) d.history.shift();

      // ===== v efectiva + clasificación por modo =====
      const gpsSpeedOk = velKmhRaw >= this.minValidGpsSpeedKmh;

      // velocidad de pista preliminar para no quedarnos a cero si el GPS viene bajo
      const trackSpeedPre = computeTrackSpeedKmh(d.historyProj, ts, 15, 25, this.minTrackDeltaMeters, this.fallbackMaxJumpKmh);

      // v efectiva preliminar
      let vEffectiveKmh = gpsSpeedOk ? velKmhRaw : trackSpeedPre;

      pushVEff(d, ts, vEffectiveKmh);

      // clasificación robusta en los últimos 25 s por mediana
      d.status.speedClass = classifySpeed(d._vEffHist);

      // parámetros por modo
      const mp = modeParams(d.status.speedClass, gpx.cpStepMeters);

      // recalcular velocidad de pista con ventana por modo
      const useTrackWindow = (!d.status.offRoute && d.status.gapSec <= mp.gapForTrackSec);
      const trackSpeedKmh = useTrackWindow
        ? computeTrackSpeedKmh(d.historyProj, ts, mp.trackWinSecMin, mp.trackWinSecMax, this.minTrackDeltaMeters, this.fallbackMaxJumpKmh)
        : 0;

      // elegir fuente con histéresis
      let useTrack = false;
      if (gpsSpeedOk) {
        if (d.status.speedFromTrack && velKmhRaw < (this.minValidGpsSpeedKmh + this.hysteresisKmh) && trackSpeedKmh > 0) useTrack = true;
      } else useTrack = trackSpeedKmh > 0;

      vEffectiveKmh = useTrack ? trackSpeedKmh : (gpsSpeedOk ? velKmhRaw : 0);
      d.status.speedFromTrack = useTrack;

      // sustituye último punto de hist para coherencia
      if (d._vEffHist?.length) d._vEffHist[d._vEffHist.length - 1].v = vEffectiveKmh;

      // ===== Proyección sobre GPX con HINT por distancia esperada (salto grande) =====
      const lastKmFwd = Math.max(0, d.kmMaxForward || 0);

      // Distancia esperada desde el último tick: v (km/h) * dt(h)
      const dtSec = Math.min(8, Math.max(0, d.status.gapSec || 0));   // typical ~5s; clamp 0..8
      let deltaKmExp = (vEffectiveKmh > 0 ? (vEffectiveKmh * dtSec) / 3600 : 0);

      // Clamp para no irnos a la luna pero permitir moto/bici (hasta ~120 m)
      const MAX_JUMP_KM = 0.12;  // 120 m
      const MIN_JUMP_KM = 0.005; // 5 m para evitar 0 en gaps cortos
      deltaKmExp = Math.min(MAX_JUMP_KM, Math.max(MIN_JUMP_KM, deltaKmExp));

      const seedKm = lastKmFwd + deltaKmExp;

      // baseIdx desde seedKm (no desde cpIdx visual)
      const baseIdx = findCpIdxByKm(gpx.cps, seedKm);
      // pequeño backtrack para no atascarse en curvas
      const startIdx = Math.max(0, baseIdx - mp.backtrackSegs);

      const proj = progressBetweenCps(lat, lon, gpx.cps, gpx.totalKm, startIdx);
      let kmRaw = proj.kmRecorridos;
      let kmRestRaw = proj.kmRestantes;

      // Off-route con strikes para no penalizar un tick aislado
      const offR = proj && typeof proj.distDesdeCPm === 'number'
        ? (proj.distDesdeCPm < -this.offRouteMaxMeters || proj.distHastaCPm < -this.offRouteMaxMeters)
        : false;
      if (offR) d._offRouteStrikes = Math.min(3, (d._offRouteStrikes || 0) + 1);
      else d._offRouteStrikes = Math.max(0, (d._offRouteStrikes || 0) - 1);
      d.status.offRoute = d._offRouteStrikes >= 2;

      // Monotonía con tolerancia por modo
      if (this.startTime) {
        if (d.kmStartAtCrono == null) d.kmStartAtCrono = kmRaw;

        const backTolKm = mp.backToleranceMeters / 1000;
        if (d.kmMaxForward != null && kmRaw < d.kmMaxForward && (d.kmMaxForward - kmRaw) <= backTolKm) {
          kmRaw = d.kmMaxForward;
        }
        d.kmMaxForward = Math.max(d.kmMaxForward || 0, kmRaw);
        kmRaw = d.kmMaxForward;
        kmRestRaw = Math.max(0, gpx.totalKm - kmRaw);
      } else {
        d.kmMaxForward = kmRaw;
        d.kmStartAtCrono = null;
      }

      // guardar km proyectados
      d.kmRecorridos = kmRaw;
      d.kmRestantes = kmRestRaw;

      // cpIdx solo informativo
      d.cpIdx = findCpIdxByKm(gpx.cps, d.kmRecorridos);
      d.progressPct = gpx.totalKm > 0 ? (d.kmRecorridos / gpx.totalKm) * 100 : 0;

      d.historyProj.push({ ts, km: d.kmRecorridos });
      while (d.historyProj.length && d.historyProj[0].ts < cutoff) d.historyProj.shift();

      // ===== Media global basada en crono y km proyectado =====
      const stationary = isStationary(d.historyProj, ts);
      d.status.stationary = stationary;

      if (this.startTime && d.kmStartAtCrono != null) {
        const elapsedH = Math.max(0, (ts - this.startTime) / 3600000);
        const distKm = Math.max(0, d.kmRecorridos - d.kmStartAtCrono);
        d.avgSpeedKmh = elapsedH > 0 ? (distKm / elapsedH) : 0;
      } else {
        d.avgSpeedKmh = null;
      }

      // Pendiente con parámetros por modo
      d.slopePct = (!d.status.offRoute)
        ? computeImmediateSlopePct(d.history, d.historyProj, gpx.cps, {
            minM: mp.slopeMinM,
            maxM: mp.slopeMaxM,
            maxSec: mp.slopeMaxSec,
            clamp: this.slopeClampPct
          })
        : d.slopePct;

      // EMA de velocidad ajustada por modo (más reactiva en bike)
      const alpha = stationary ? Math.min(0.6, mp.emaAlpha * 2.0) : mp.emaAlpha;
      if (d.emaSpeed == null) d.emaSpeed = vEffectiveKmh;
      d.emaSpeed = alpha * vEffectiveKmh + (1 - alpha) * d.emaSpeed;

      // Ritmo
      if (!this.startTime || vEffectiveKmh < 1.2) d.paceAvgMinPerKm = null;
      else d.paceAvgMinPerKm = kmhToPaceMinPerKm(d.emaSpeed);

      // ETA
      const armed = (d.kmRecorridos / gpx.totalKm) >= this.etaStartPercent;
      d.etaArmed = armed;
      if (armed) {
        const remKm = Math.max(0, d.kmRestantes);
        const vStable = robustSpeedKmh(d.emaSpeed, d.avgSpeedKmh || 0);
        if (vStable > 0.5 && (remKm > 0 || d.kmRecorridos > 0)) {
          const elapsedMs = this.startTime ? (ts - this.startTime) : 0;
          const remainingMs = Math.round((remKm / vStable) * 3600 * 1000);
          d.etaMs = elapsedMs + remainingMs;
          d.status.frozenEta = false;
        } else {
          d.etaMs = null;
          d.status.frozenEta = true;
        }
      } else {
        d.etaMs = null;
        d.status.frozenEta = false;
      }

      // PB / objetivo
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

      d.consistency = computeConsistency(d.historyProj);
      d.last = { ts, lat, lon, velKmh: velKmhRaw, alt, dir };
    },

    setPersonalBest(id, pbTimeMs, pbDistKm) {
      const d = this.byId?.[id]; if (!d) return;
      if (!d.personalBest) d.personalBest = {};
      d.personalBest.pbTimeMs = Number(pbTimeMs);
      if (Number.isFinite(pbDistKm) && pbDistKm > 0) d.personalBest.pbDistanceKm = Number(pbDistKm);
      updatePersonalBestTarget(d, useGpxStore().totalKm);
    },

    async _ensureDvrStarted() {
      if (this._dvrActive) return;
      if (!this._wsConnected) return;
      if (this._timeSource) return;

      if (!this._dvrRaceId) {
        const gpx = useGpxStore();
        const base = (gpx?.name || gpx?.currentFileName || 'race').toString().replace(/[^\w\-]+/g, '').slice(0, 20) || 'race';
        const ts = new Date();
        const y = ts.getFullYear(); const m = String(ts.getMonth() + 1).padStart(2, '0'); const d = String(ts.getDate()).padStart(2, '0');
        const hh = String(ts.getHours()).padStart(2, '0'); const mm = String(ts.getMinutes()).padStart(2, '0'); const ss = String(ts.getSeconds()).padStart(2, '0');
        this._dvrRaceId = `${base}-${y}${m}${d}-${hh}${mm}${ss}`;
      }
      try {
        const resp = await fetch(`${this._bridgeHttpBase}/replay/start`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raceId: this._dvrRaceId, notes: this._dvrNotes || null }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        this._dvrActive = true;
        console.log('[tracking] DVR start ok ->', this._dvrRaceId);
      } catch (e) { console.warn('[tracking] DVR start falló:', e?.message || e); }
    },
    async _ensureDvrStopped() {
      if (!this._dvrActive) return;
      try {
        const resp = await fetch(`${this._bridgeHttpBase}/replay/stop`, { method: 'POST' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        console.log('[tracking] DVR stop ok');
      } catch (e) { console.warn('[tracking] DVR stop falló:', e?.message || e); }
      finally {
        this._dvrActive = false;
        this._dvrRaceId = null;
        this._dvrNotes = null;
      }
    },
    setDvrMeta({ raceId, notes, bridgeBase } = {}) {
      if (typeof raceId === 'string' && raceId.trim()) this._dvrRaceId = raceId.trim();
      if (typeof notes === 'string') this._dvrNotes = notes;
      if (typeof bridgeBase === 'string' && bridgeBase.trim()) this._bridgeHttpBase = bridgeBase.trim();
    },
  }
});

/* ===== Helpers ===== */

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

function pushVEff(d, ts, v) {
  if (!Array.isArray(d._vEffHist)) d._vEffHist = [];
  d._vEffHist.push({ ts, v });
  const cutoff = ts - 25000; // 25 s para clasificar
  while (d._vEffHist.length && d._vEffHist[0].ts < cutoff) d._vEffHist.shift();
}

// Clasificación robusta por mediana
function classifySpeed(vHist) {
  if (!Array.isArray(vHist) || vHist.length === 0) return 'auto';
  const speeds = vHist.map(x => x.v).filter(Number.isFinite).filter(v => v >= 0);
  if (!speeds.length) return 'auto';
  speeds.sort((a, b) => a - b);
  const med = speeds[Math.floor(speeds.length / 2)];
  if (!(med > 0)) return 'auto';
  if (med < 7) return 'walk';
  if (med < 18) return 'run';
  return 'bike';
}

// Parámetros por modo
function modeParams(mode, cpStepMeters) {
  const step = Math.max(1, cpStepMeters || 10);
  switch (mode) {
    case 'walk':
      return {
        backtrackSegs: 3,
        backToleranceMeters: 12,
        emaAlpha: 0.20,
        gapForTrackSec: 8,
        trackWinSecMin: 12,
        trackWinSecMax: 20,
        slopeMinM: 12,
        slopeMaxM: 18,
        slopeMaxSec: 15,
        effStepM: Math.max(step, 10),
      };
    case 'run':
      return {
        backtrackSegs: 3,
        backToleranceMeters: 8,
        emaAlpha: 0.25,
        gapForTrackSec: 10,
        trackWinSecMin: 12,
        trackWinSecMax: 20,
        slopeMinM: 15,
        slopeMaxM: 20,
        slopeMaxSec: 15,
        effStepM: Math.max(step, 10),
      };
    case 'bike':
    default:
      return {
        backtrackSegs: 4,
        backToleranceMeters: 5,
        emaAlpha: 0.32,
        gapForTrackSec: 12,
        trackWinSecMin: 15,
        trackWinSecMax: 25,
        slopeMinM: 18,
        slopeMaxM: 25,
        slopeMaxSec: 15,
        effStepM: Math.max(step, 12),
      };
  }
}

function isStationary(historyProj, nowTs) {
  if (!Array.isArray(historyProj) || historyProj.length < 2) return false;
  const last = historyProj[historyProj.length - 1];
  const minTs = nowTs - 10000;
  let first = last;
  for (let i = historyProj.length - 2; i >= 0; i--) {
    if (historyProj[i].ts < minTs) { first = historyProj[i]; break; }
    first = historyProj[i];
  }
  const deltaM = Math.max(0, (last.km - first.km) * 1000);
  return deltaM < 10;
}

function computeTrackSpeedKmh(historyProj, nowTs, minWinSec, maxWinSec, minDeltaMeters, maxClampKmh) {
  if (!Array.isArray(historyProj) || historyProj.length < 2) return 0;
  const last = historyProj[historyProj.length - 1];

  // pick dentro de ventana [min, max]
  let pick = null;
  for (let i = historyProj.length - 2; i >= 0; i--) {
    const p = historyProj[i];
    const ageSec = (nowTs - p.ts) / 1000;
    if (ageSec >= minWinSec && ageSec <= maxWinSec) { pick = p; break; }
    if (ageSec > maxWinSec) break;
  }
  if (!pick) {
    // fallback: más antiguo dentro de maxWinSec
    for (let i = 0; i < historyProj.length - 1; i++) {
      const p = historyProj[i];
      const ageSec = (nowTs - p.ts) / 1000;
      if (ageSec <= maxWinSec) { pick = p; break; }
    }
  }
  if (!pick) return 0;

  const deltaKm = Math.max(0, last.km - pick.km);
  const deltaH = Math.max(0, (last.ts - pick.ts) / 3600000);
  const meters = deltaKm * 1000;
  if (!isFinite(deltaH) || deltaH <= 0) return 0;
  if (meters < minDeltaMeters) return 0;
  const v = deltaKm / deltaH;
  if (!isFinite(v) || v < 0) return 0;
  return Math.min(v, maxClampKmh);
}

function robustSpeedKmh(ema, avgRecent) {
  if (avgRecent > 0 && ema > 0) return 0.5 * ema + 0.5 * avgRecent;
  if (avgRecent > 0) return avgRecent;
  return Math.max(0, ema || 0);
}

function computeImmediateSlopePct(history, historyProj, cps, opts) {
  const minM = Math.max(10, opts?.minM ?? 15);
  const maxM = Math.max(minM, opts?.maxM ?? 20);
  const maxSec = Math.max(5, opts?.maxSec ?? 15);
  const clampAbs = Math.max(5, opts?.clamp ?? 40);

  const hasHist = Array.isArray(history) && history.length >= 2;
  const hasProj = Array.isArray(historyProj) && historyProj.length >= 2;
  if (!hasHist || !hasProj || !Array.isArray(cps) || cps.length < 2) return null;

  const lastH = history[history.length - 1];
  const lastP = historyProj[historyProj.length - 1];
  if (!isFinite(lastH?.lat) || !isFinite(lastH?.lon) || !isFinite(lastH?.alt)) return null;

  let accM = 0, j = history.length - 1;
  for (; j > 0; j--) {
    const a = history[j - 1], b = history[j];
    if (!isFinite(a?.lat) || !isFinite(a?.lon) || !isFinite(a?.alt)) continue;
    accM += haversineKm(a.lat, a.lon, b.lat, b.lon) * 1000;
    const ageSec = (lastH.ts - a.ts) / 1000;
    if (accM >= minM || ageSec >= maxSec) break;
  }
  const firstH = history[Math.max(0, j - 1)];
  let gpsSlope = null;
  if (firstH && isFinite(firstH.alt)) {
    const baseM = Math.max(minM, Math.min(accM, maxM));
    const deltaAlt = lastH.alt - firstH.alt;
    const horizM = Math.max(1, baseM);
    gpsSlope = clamp((deltaAlt / horizM) * 100, -clampAbs, clampAbs);
  }

  const km2 = lastP.km;
  const wantKm = Math.max(0, km2 - (maxM / 1000));
  let km1 = km2;
  for (let i = historyProj.length - 2; i >= 0; i--) {
    km1 = historyProj[i].km;
    const ageSec = (lastP.ts - historyProj[i].ts) / 1000;
    if ((km2 - km1) * 1000 >= minM || ageSec >= maxSec) break;
  }
  let gpxSlope = null;
  if (km1 < km2) {
    const ele2 = altAtKm(cps, km2);
    const ele1 = altAtKm(cps, Math.max(0, km1, wantKm));
    const horizM = Math.max(1, (km2 - Math.max(0, km1, wantKm)) * 1000);
    if (Number.isFinite(ele1) && Number.isFinite(ele2) && horizM >= minM * 0.6) {
      gpxSlope = clamp(((ele2 - ele1) / horizM) * 100, -clampAbs, clampAbs);
    }
  }
  let slope = null;
  if (gpxSlope != null && gpsSlope != null) slope = 0.6 * gpxSlope + 0.4 * gpsSlope;
  else if (gpxSlope != null) slope = gpxSlope;
  else if (gpsSlope != null) slope = gpsSlope;

  return slope != null ? clamp(slope, -clampAbs, clampAbs) : null;
}

function computeConsistency(historyProj) {
  if (!Array.isArray(historyProj) || historyProj.length < 3) return null;
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
      if (paceMin && paceMin > 0) buckets.push(paceMin * 60);
      accStart = b.km; tStart = b.ts;
    }
  }
  if (buckets.length < 4) return null;
  buckets.sort((a, b) => a - b);
  const qLo = buckets[Math.floor(buckets.length * 0.1)];
  const qHi = buckets[Math.floor(buckets.length * 0.9)];
  const trimmed = buckets.filter(x => x >= qLo && x <= qHi);
  if (trimmed.length < 3) return null;
  const median = trimmed[Math.floor(trimmed.length / 2)];
  const deviations = trimmed.map(x => Math.abs(x - median)).sort((a, b) => a - b);
  const mad = deviations[Math.floor(deviations.length / 2)];
  const stdEq = 1.4826 * mad;
  const label =
    stdEq <= 6 ? 'muy constante' :
    stdEq <= 10 ? 'constante' :
    stdEq <= 18 ? 'variable' : 'muy variable';
  return { paceStdSec: stdEq, paceVarLabel: label };
}

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

/* ===== Helpers de tiempo ===== */
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

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
