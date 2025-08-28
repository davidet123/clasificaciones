// src/stores/gpxStore.js
import { defineStore } from 'pinia';
import { parseGPX, resamplePolyline } from '@/utils/geo';

export const useGpxStore = defineStore('gpx', {
  state: () => ({
    loaded: false,
    loading: false,
    error: null,

    // GPX original para dibujar
    points: [],      // [{lat, lon, ele?}]
    totalKm: 0,

    // Checkpoints para cálculo
    cps: [],         // [{lat, lon, kmAcc, idxSeg, tSeg}]
    cpStepMeters: 50,
    name: 'Ruta GPX'
  }),
  actions: {
    // async loadFromPublic(path = '/assets/gran-fondo-de-siete-aguas.gpx', stepMeters) {
    async loadFromPublic(path = '/assets/ruta.gpx', stepMeters) {
      try {
        this.loading = true; this.error = null;

        const res = await fetch(path, { cache: 'no-store' });
        if (!res.ok) throw new Error(`No se pudo cargar GPX (${res.status})`);
        const xml = await res.text();

        const { points, totalKm } = parseGPX(xml);
        this.points = points;
        this.totalKm = totalKm;

        // Resolución adaptativa hacia ~400 CP, clamp 5–100 m salvo que pases stepMeters
        const adaptive = Math.max(5, Math.min(100, Math.round((totalKm * 1000) / 400)));
        const step = stepMeters ?? adaptive;

        const { cps } = resamplePolyline(points, step);
        this.cps = cps;
        this.cpStepMeters = step;

        this.loaded = true;
      } catch (e) {
        console.error('[GPX load error]', e);
        this.error = e.message || String(e);
      } finally {
        this.loading = false;
      }
    },
    resample(stepMeters = 50) {
      if (!this.points.length) return;
      const { cps } = resamplePolyline(this.points, stepMeters);
      this.cps = cps;
      this.cpStepMeters = stepMeters;
    }
  }
});
