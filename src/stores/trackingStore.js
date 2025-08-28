// src/stores/trackingStore.js
// ETA robusta, cronómetro auto al pasar CP1, ventana por metros + EMA,
// off-route flexible, clamps ETA. Añadido:
// - Consistencia de ritmo (std de ritmos recientes)
// - Objetivo personal (PB) por dispositivo con persistencia
// - Delta vs PB y bandera onTarget para resaltar en el mapa

import { defineStore } from 'pinia';
import {
  kmhToPaceMinPerKm,
  progressBetweenCps,
  haversineKm
} from '@/utils/geo';
import { useGpxStore } from './gpxStore';

const COLORS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa'];

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function msToHMS(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const hh = String(Math.floor(s/3600)).padStart(2,'0');
  const mm = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}
function parseHMSToMs(str){
  if (!str) return null;
  const parts = str.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  let h=0,m=0,s=0;
  if (parts.length === 3){ [h,m,s]=parts; }
  else if (parts.length === 2){ [m,s]=parts; }
  else if (parts.length === 1){ [s]=parts; }
  return ((h*3600)+(m*60)+s)*1000;
}

export const useTrackingStore = defineStore('tracking', {
  state: () => ({
    connected: false,
    ws: null,

    devices: {
      // [id]: {
      //   ... estado de seguimiento ...
      //   personalBest: { pbTimeMs, pbDistanceKm, targetPaceMinPerKm }
      //   consistency: { paceStdSec, paceVarLabel, samples: number }
      //   target: { deltaToPBms, onTarget, gapPaceSecPerKm }
      // }
    },

    // Crono global
    startTime: null,
    lastMessageAt: null,

    // ---------- CONFIG ROBUSTEZ ----------
    // Velocidad de entrada YA en km/h (normalizada en servidor)
    speedIncomingUnit: 'kmh',

    // Saltos imposibles por ruido
    maxJumpSpeedKmh: 36,       // ~10 m/s

    // Off-route (distancia perpendicular a la proyección)
    offRouteMeters: 35,        // rechazo duro = 2x esto

    // Ventana por metros para media reciente (valor máximo; el efectivo es adaptativo)
    lastMetersWindowMax: 0.6,  // km (600 m), efectivo = min(600m, 30% ruta, >=200m)

    // Suavizado
    emaAlpha: 0.20,

    // Gaps (solo afectan a confianza)
    gapShortSec: 4,
    gapMediumSec: 20,

    // Paradas y congelación (solo si de verdad paras)
    stopSpeedKmh: 0.5,
    stopGraceSec: 8,

    // Clamp de ETA
    etaChangeClampSec: 5,
    etaChangeClampFinalSec: 3,
    finalTightKm: 0.3,

    // Activación de ETA por progreso
    etaStartPercent: 0.05,     // 5% de la ruta
    etaStartMinKm: 0.25,       // al menos 250 m

    // Consistencia de ritmo
    consistencyWindowKmMax: 2.0,     // ventana sup. para consistencia
    consistencyWindowKmMin: 1.0,     // ventana inf. para consistencia
    // Etiquetas por std (seg/km)
    consistencyBandsSec: [6, 12, 20], // muy constante / constante / variable / muy variable

    // Historial
    historyMaxSec: 240,
  }),
  getters: {
    list(state) {
      return Object.entries(state.devices).map(([id, v]) => ({ id, ...v }));
    },
    elapsedMs(state) {
      return state.startTime ? Date.now() - state.startTime : 0;
    }
  },
  actions: {
    // PB helpers (persistencia localStorage)
    _pbKey(id){ return `pb:${id}`; },
    loadPB(id){
      try {
        const raw = localStorage.getItem(this._pbKey(id));
        if (!raw) return null;
        const o = JSON.parse(raw);
        if (!o || typeof o.pbTimeMs !== 'number') return null;
        return o;
      } catch { return null; }
    },
    savePB(id, pb){
      try { localStorage.setItem(this._pbKey(id), JSON.stringify(pb)); } catch {}
    },
    setPersonalBest(id, pbTimeMs, pbDistanceKm){
      const gpx = useGpxStore();
      const dev = this.devices[id]; if (!dev) return;
      const distKm = (typeof pbDistanceKm === 'number' && pbDistanceKm > 0) ? pbDistanceKm : (gpx.totalKm || 0);
      const paceMinPerKm = distKm > 0 ? (pbTimeMs/1000) / 60 / distKm : null;
      dev.personalBest = {
        pbTimeMs: pbTimeMs || null,
        pbDistanceKm: distKm,
        targetPaceMinPerKm: paceMinPerKm
      };
      if (pbTimeMs) this.savePB(id, dev.personalBest);
    },

    startCrono(){ this.startTime = Date.now(); },
    stopCrono(){ this.startTime = null; },

    // Modo test: forzar inicio en CP1
    forceStartAtFirstCP() {
      const gpx = useGpxStore();
      if (!gpx.loaded || !gpx.cps.length) return;
      this.startTime = Date.now();
      Object.values(this.devices).forEach(dev => {
        dev.prevCpIdx = 0;
        dev.cpIdx = 1;
        const km1 = gpx.cps[1]?.kmAcc ?? 0;
        dev.kmRecorridos = km1;
        dev.kmRestantes = Math.max(0, gpx.totalKm - km1);
        dev.distDesdeCPm = 0;
        dev.distHastaCPm = ((gpx.cps[2]?.kmAcc ?? km1) - km1) * 1000;
        dev.progressPct = gpx.totalKm > 0 ? (dev.kmRecorridos / gpx.totalKm) * 100 : 0;
      });
    },

    resetAll() {
      this.startTime = null;
      this.devices = {};
    },

    connectWS(url = 'ws://localhost:3000') {
      if (this.ws) try { this.ws.close(); } catch {}
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => { this.connected = true; };
      ws.onclose = () => {
        this.connected = false;
        setTimeout(() => this.connectWS(url), 2000);
      };
      ws.onerror = (e) => { console.warn('[WS error]', e); };
      ws.onmessage = this.onMessage;
    },

    onMessage(evt) {
      this.lastMessageAt = Date.now();

      let payload; try { payload = JSON.parse(evt.data); } catch { return; }
      const arr = Array.isArray(payload) ? payload : [payload];

      const gpx = useGpxStore();
      if (!gpx.loaded || !gpx.cps.length) return;

      // Parámetros ADAPTATIVOS según la ruta cargada
      const totalKm = gpx.totalKm || 0;
      const winKm = Math.min(
        this.lastMetersWindowMax,
        Math.max(0.2, totalKm * 0.30)      // 30% de la ruta, mínimo 200 m
      );
      const clampFinalKm = Math.min(this.finalTightKm, Math.max(0.1, totalKm * 0.08)); // tramo final adaptativo
      const offRouteHardMeters = this.offRouteMeters * 2; // rechazo duro
      const etaStartKm = Math.max(this.etaStartMinKm, totalKm * this.etaStartPercent);

      // Ventana de consistencia
      const consWin = clamp(totalKm * 0.30, this.consistencyWindowKmMin, this.consistencyWindowKmMax);

      for (const msg of arr) {
        const id = String(msg?.identificador ?? '');
        const d = msg?.datos ?? null;
        if (!id || !d) continue;

        const ts = Date.now();
        const rawLat = Number(d.lat);
        const rawLon = Number(d.lon);
        const velKmh = Number(d.velocidad ?? 0); // ya en km/h
        const alt = d.altitud ?? null;
        const dir = d.direccion ?? null;

        // Crear dispositivo si no existe
        if (!this.devices[id]) {
          const color = COLORS[Object.keys(this.devices).length % COLORS.length];

          // Carga PB persistido si existe
          const pbSaved = this.loadPB(id);
          let personalBest = null;
          if (pbSaved && typeof pbSaved.pbTimeMs === 'number') {
            const distKm = pbSaved.pbDistanceKm ?? totalKm;
            const pace = distKm > 0 ? (pbSaved.pbTimeMs/1000)/60/distKm : null;
            personalBest = { pbTimeMs: pbSaved.pbTimeMs, pbDistanceKm: distKm, targetPaceMinPerKm: pace };
          }

          this.devices[id] = {
            color,

            // Dibujo (GPS crudo)
            last: null,
            history: [],

            // Cálculo (sobre proyección)
            historyProj: [],
            proj: null,

            // Progreso
            kmRecorridos: 0,
            kmRestantes: totalKm,
            distDesdeCPm: 0,
            distHastaCPm: 0,
            cpIdx: 0,
            prevCpIdx: 0,
            progressPct: 0,

            // Métricas
            paceNowMinPerKm: null,
            paceAvgMinPerKm: null,
            etaMs: null,
            etaArmed: false,
            _emaV: null,
            _lastEtaMsRaw: null,
            _lastEtaMsShown: null,
            _lastUpdateTs: null,
            _lastProjForCalc: null,

            // Objetivo personal
            personalBest,  // puede ser null al inicio
            target: { deltaToPBms: null, onTarget: false, gapPaceSecPerKm: null },

            // Consistencia
            consistency: { paceStdSec: null, paceVarLabel: null, samples: 0 },

            // Estado/calidad
            status: {
              offRoute: false,
              outlierJump: false,
              gapSec: 0,
              frozenEta: false,
              speedUnit: 'kmh',
              confidence: 100
            }
          };
        }

        const dev = this.devices[id];

        // Gap de llegada (solo para info/confianza)
        const prevTs = dev._lastUpdateTs ?? ts;
        const deltaTs = Math.max(0, (ts - prevTs) / 1000);
        dev.status.gapSec = deltaTs;

        // Dibujo crudo
        dev.last = { lat: rawLat, lon: rawLon, velKmh, alt, dir, ts };
        dev.history.push(dev.last);
        const minTs = ts - this.historyMaxSec * 1000;
        dev.history = dev.history.filter(p => p.ts >= minTs);

        // Salto imposible (por posición cruda)
        let outlierJump = false;
        if (dev.history.length >= 2) {
          const prev = dev.history[dev.history.length - 2];
          const dKm = haversineKm(prev.lat, prev.lon, rawLat, rawLon);
          const dtH = Math.max(1e-6, (ts - prev.ts) / 3600000);
          const vJump = dKm / dtH;
          if (vJump > this.maxJumpSpeedKmh) outlierJump = true;
        }

        // CP más cercano
        let bestIdx = 0, bestDistKmToCP = Infinity;
        for (let i = 0; i < gpx.cps.length; i++) {
          const dKm = haversineKm(rawLat, rawLon, gpx.cps[i].lat, gpx.cps[i].lon);
          if (dKm < bestDistKmToCP) { bestDistKmToCP = dKm; bestIdx = i; }
        }
        dev.prevCpIdx = dev.cpIdx;
        dev.cpIdx = Math.max(0, Math.min(bestIdx, gpx.cps.length - 2));

        // Proyección y progreso
        const prog = progressBetweenCps(rawLat, rawLon, gpx.cps, gpx.totalKm, dev.cpIdx);
        const perpDistM = haversineKm(rawLat, rawLon, prog.projLat, prog.projLon) * 1000;

        // Off-route según proyección
        const offRoute = perpDistM > this.offRouteMeters;

        // ACEPTACIÓN para CÁLCULO:
        // Solo rechazo por salto imposible o off-route DURO (> 2x).
        const rejectForCalc =
          outlierJump ||
          perpDistM > offRouteHardMeters;

        if (!rejectForCalc) {
          dev.kmRecorridos = prog.kmRecorridos;
          dev.kmRestantes = prog.kmRestantes;
          dev.distDesdeCPm = prog.distDesdeCPm;
          dev.distHastaCPm = prog.distHastaCPm;
          dev.proj = { lat: prog.projLat, lon: prog.projLon, ts, perpDistM };
          dev._lastProjForCalc = dev.proj;

          dev.progressPct = totalKm > 0 ? (dev.kmRecorridos / totalKm) * 100 : 0;

          dev.historyProj.push({ lat: prog.projLat, lon: prog.projLon, ts, kmRecorridos: dev.kmRecorridos });
          dev.historyProj = dev.historyProj.filter(p => p.ts >= minTs);

          // AUTO-START del crono al pasar por CP1 (o más)
          if (this.startTime == null && dev.prevCpIdx === 0 && dev.cpIdx >= 1) {
            this.startCrono();
          }
        } else {
          if (dev._lastProjForCalc) dev.proj = { ...dev._lastProjForCalc };
          else dev.proj = null;
        }

        // Ritmos
        dev.paceNowMinPerKm = kmhToPaceMinPerKm(velKmh);

        // Velocidad media por metros recientes: ventana ADAPTATIVA
        const hist = dev.historyProj;
        let vAvgKmhMeters = 0;
        if (hist && hist.length >= 2) {
          const latest = hist[hist.length - 1];
          let idx = hist.length - 2;
          while (idx >= 0 && (latest.kmRecorridos - hist[idx].kmRecorridos) < winKm) idx--;
          idx = Math.max(0, idx);
          const first = hist[idx];
          const distKm = Math.max(0, latest.kmRecorridos - first.kmRecorridos);
          const dtH = (latest.ts - first.ts) / 3600000;
          vAvgKmhMeters = dtH > 0 ? (distKm / dtH) : 0;
        }

        // Semillado/actualización de EMA:
        const vSeed = (vAvgKmhMeters > 0 ? vAvgKmhMeters : (velKmh > 0 ? velKmh : 0));
        if (vSeed > 0) {
          dev._emaV = dev._emaV == null
            ? vSeed
            : (this.emaAlpha * vSeed + (1 - this.emaAlpha) * dev._emaV);
        }
        dev.paceAvgMinPerKm = kmhToPaceMinPerKm(dev._emaV ?? 0);

        // --------- ETA activable por porcentaje ----------
        dev.etaArmed = dev.kmRecorridos >= etaStartKm;

        // ETA base (solo si crono en marcha Y etaArmed)
        let etaRaw = null;
        const v = dev._emaV && dev._emaV > 0 ? dev._emaV : 0;
        if (v > 0 && this.startTime != null && dev.etaArmed) {
          const kmRest = Math.max(0, gpx.totalKm - dev.kmRecorridos);
          const hoursLeft = kmRest / v;
          const msLeft = hoursLeft * 3600000;
          const alreadyMs = Date.now() - this.startTime;
          etaRaw = msLeft + alreadyMs;
        }

        // Consistencia de ritmo (std de ritmos en ventana por metros)
        // Construimos ritmos por tramo dentro de una ventana consWin hacia atrás
        let paceStdSec = null, samples = 0;
        if (hist && hist.length >= 3) {
          const latest = hist[hist.length - 1];
          let idx = hist.length - 2;
          while (idx >= 0 && (latest.kmRecorridos - hist[idx].kmRecorridos) < consWin) idx--;
          idx = Math.max(0, idx);
          // Ritmos tramo-a-tramo en s/km
          const pacesSec = [];
          for (let i = idx; i < hist.length - 1; i++) {
            const a = hist[i], b = hist[i+1];
            const dk = Math.max(0, b.kmRecorridos - a.kmRecorridos);
            const dt = Math.max(0, (b.ts - a.ts) / 1000); // s
            if (dk > 0 && dt > 0) {
              const vKmh = (dk) / (dt/3600);
              const paceMin = kmhToPaceMinPerKm(vKmh);
              if (paceMin && isFinite(paceMin)) {
                pacesSec.push(paceMin*60);
              }
            }
          }
          // Limpieza simple: recorte 10% extremos
          pacesSec.sort((x,y)=>x-y);
          if (pacesSec.length >= 5) {
            const cut = Math.floor(pacesSec.length * 0.1);
            const core = pacesSec.slice(cut, pacesSec.length - cut);
            const n = core.length;
            if (n >= 3) {
              const mean = core.reduce((a,b)=>a+b,0)/n;
              const varr = core.reduce((a,b)=>a+(b-mean)*(b-mean),0)/n;
              paceStdSec = Math.sqrt(varr);
              samples = n;
            }
          }
        }
        if (paceStdSec != null) {
          const [b1,b2,b3] = this.consistencyBandsSec;
          let label = 'muy variable';
          if (paceStdSec <= b1) label = 'muy constante';
          else if (paceStdSec <= b2) label = 'constante';
          else if (paceStdSec <= b3) label = 'variable';
          dev.consistency = { paceStdSec, paceVarLabel: label, samples };
        } else {
          dev.consistency = { paceStdSec: null, paceVarLabel: null, samples: 0 };
        }

        // Congelación SOLO por parada breve (no por gap)
        const isStopped = v < this.stopSpeedKmh;
        let frozen = false;
        if (isStopped && dev.status.gapSec <= this.stopGraceSec && dev._lastEtaMsShown != null) {
          etaRaw = dev._lastEtaMsShown;
          frozen = true;
        }

        // Clamp de ETA (más estricto en tramo final adaptativo)
        let etaClamped = etaRaw;
        if (etaRaw != null) {
          const clampSec = (dev.kmRestantes <= clampFinalKm) ? this.etaChangeClampFinalSec : this.etaChangeClampSec;
          if (dev._lastEtaMsShown != null) {
            const diff = etaRaw - dev._lastEtaMsShown;
            const maxDelta = clampSec * 1000;
            if (diff > maxDelta) etaClamped = dev._lastEtaMsShown + maxDelta;
            else if (diff < -maxDelta) etaClamped = dev._lastEtaMsShown - maxDelta;
          }
        }

        // Estado y confianza (gap solo baja el score)
        dev.status.offRoute = offRoute;
        dev.status.outlierJump = outlierJump;
        dev.status.frozenEta = !!frozen;
        dev.status.speedUnit = 'kmh';

        let conf = 100;
        if (offRoute) conf -= 20;
        if (perpDistM > offRouteHardMeters) conf -= 15;
        if (outlierJump) conf -= 25;
        if (dev.status.gapSec > this.gapShortSec) conf -= 15;
        if (v <= 0) conf -= 10;
        if (!dev.proj) conf -= 10;
        dev.status.confidence = Math.max(0, Math.min(100, conf));

        // Persistencia de ETA
        dev._lastEtaMsRaw = etaRaw ?? dev._lastEtaMsRaw;
        dev._lastEtaMsShown = etaClamped ?? dev._lastEtaMsShown;
        dev.etaMs = dev._lastEtaMsShown ?? null;

        // --- Delta vs PB y gap de ritmo ---
        if (dev.personalBest && dev.personalBest.pbTimeMs && this.startTime != null && dev.etaArmed && dev.etaMs != null) {
          const targetPaceMinPerKm = dev.personalBest.targetPaceMinPerKm;
          const refDist = dev.personalBest.pbDistanceKm || totalKm;
          const adjustedTargetTimeMs = (targetPaceMinPerKm ? targetPaceMinPerKm * 60 * (totalKm || refDist) * 1000 : dev.personalBest.pbTimeMs);
          const deltaMs = Math.round(dev.etaMs - adjustedTargetTimeMs);
          const gapPaceSecPerKm = (dev.paceAvgMinPerKm && targetPaceMinPerKm) ? Math.round((dev.paceAvgMinPerKm - targetPaceMinPerKm)*60) : null;
          dev.target = {
            deltaToPBms: deltaMs,
            onTarget: deltaMs <= 0,        // SOLO nos importa si va mejor (negativo)
            gapPaceSecPerKm
          };
        } else {
          dev.target = { deltaToPBms: null, onTarget: false, gapPaceSecPerKm: null };
        }

        dev._lastUpdateTs = ts;
      }
    }
  }
});

export { msToHMS, parseHMSToMs };
