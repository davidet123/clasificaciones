// src/stores/gpxStore.js
import { defineStore } from 'pinia';
import { parseGPX, resamplePolyline, haversineKm } from '@/utils/geo';

export const useGpxStore = defineStore('gpx', {
  state: () => ({
    loaded: false,
    loading: false,
    error: null,

    // GPX original para dibujar
    points: [],      // [{lat, lon, ele?}]
    totalKm: 0,

    // Checkpoints para cálculo
    cps: [],         // [{lat, lon, ele, kmAcc}]
    cpStepMeters: 50,
    name: 'Ruta GPX',

    // Añadido: última ruta cargada para prefill en UI
    currentPath: '',
  }),
  actions: {
    // async loadFromPublic(path = '/assets/gran-fondo-de-siete-aguas.gpx', stepMeters) {
    async loadFromPublic(path = '/assets/ruta_casa_1.gpx', stepMeters) {
      try {
        this.loading = true; this.error = null;

        const res = await fetch(path, { cache: 'no-store' });
        if (!res.ok) throw new Error(`No se pudo cargar GPX (${res.status})`);
        const xml = await res.text();

        // 1) Parse básico para points + totalKm
        const parsed = parseGPX(xml);
        const points = parsed.points || [];
        const totalKm = parsed.totalKm || 0;

        this.points = points;
        this.totalKm = totalKm;

        // 2) Resolución adaptativa hacia ~400 CP, clamp 5–100 m salvo que pases stepMeters
        const adaptive = Math.max(5, Math.min(100, Math.round((totalKm * 1000) / 400)));
        const step = stepMeters ?? adaptive;

        // 3) Generar cps usando resamplePolyline (ahora devuelve { cps })
        const { cps: sampled } = resamplePolyline(points, step);
        const cps = [];
        let acc = 0;
        if (sampled.length) {
          cps.push({ lat: sampled[0].lat, lon: sampled[0].lon, ele: sampled[0].ele, kmAcc: 0 });
          for (let i = 1; i < sampled.length; i++) {
            acc += haversineKm(
              sampled[i - 1].lat, sampled[i - 1].lon,
              sampled[i].lat, sampled[i].lon
            );
            cps.push({ lat: sampled[i].lat, lon: sampled[i].lon, ele: sampled[i].ele, kmAcc: acc });
          }
        }

        this.cps = cps;
        this.cpStepMeters = step;

        this.loaded = true;
        this.currentPath = String(path || '');
      } catch (e) {
        console.error('[GPX load error]', e);
        this.error = e.message || String(e);
      } finally {
        this.loading = false;
      }
    },

    resample(stepMeters = 50) {
      if (!this.points.length) return;

      // ✅ Corregido: desestructuramos cps
      const { cps: sampled } = resamplePolyline(this.points, stepMeters);
      const cps = [];
      let acc = 0;
      if (sampled.length) {
        cps.push({ lat: sampled[0].lat, lon: sampled[0].lon, ele: sampled[0].ele, kmAcc: 0 });
        for (let i = 1; i < sampled.length; i++) {
          acc += haversineKm(
            sampled[i - 1].lat, sampled[i - 1].lon,
            sampled[i].lat, sampled[i].lon
          );
          cps.push({ lat: sampled[i].lat, lon: sampled[i].lon, ele: sampled[i].ele, kmAcc: acc });
        }
      }

      this.cps = cps;
      this.cpStepMeters = stepMeters;
    }

  }
});
