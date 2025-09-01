// src/stores/raceConfigStore.js
import { defineStore } from 'pinia';
import { usevMixStore } from '@/stores/vMix'; // usar, NO modificar ese archivo

const LS_KEY = 'raceConfig.v1';

export const useRaceConfigStore = defineStore('raceConfig', {
  state: () => ({
    // URL editable de vMix (se refleja también en usevMixStore().url)
    vmixUrl: '',
    // Mapa id -> { name, category }
    // category ∈ {'Masculina','Femenina','Otro'}
    devicesConfig: {},
    _loaded: false,
  }),

  getters: {
    deviceList: (s) =>
      Object.entries(s.devicesConfig).map(([id, cfg]) => ({
        id,
        name: cfg?.name ?? '',
        category: cfg?.category ?? 'Otro',
      })),
  },

  actions: {
    init() {
      if (this._loaded) return;
      this.loadFromStorage();

      // Si no hay URL en storage, intenta leer la del store de vMix
      try {
        const vmix = usevMixStore();
        if (!this.vmixUrl && typeof vmix?.url === 'string' && vmix.url) {
          this.vmixUrl = vmix.url;
        }
      } catch {/* opcional */}

      this._loaded = true;
    },

    loadFromStorage() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.vmixUrl === 'string') this.vmixUrl = parsed.vmixUrl;
          if (parsed.devicesConfig && typeof parsed.devicesConfig === 'object') {
            this.devicesConfig = { ...parsed.devicesConfig };
          }
        }
      } catch {/* ignorar corrupción */}
    },

    saveToStorage() {
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({
            vmixUrl: this.vmixUrl || '',
            devicesConfig: this.devicesConfig || {},
          })
        );
      } catch {/* sin drama si falla */}
    },

    setVmixUrl(urlStr) {
      const url = String(urlStr || '').trim();
      this.vmixUrl = url;
      // Reflejo en el store de vMix sin tocar su código fuente
      try {
        const vmix = usevMixStore();
        vmix.url = url;
      } catch {/* si no está creado aún, no pasa nada */}
      this.saveToStorage();
    },

    // Asegura placeholders para IDs nuevos sin machacar ya configurados
    ensureDevices(ids = []) {
      const next = { ...this.devicesConfig };
      for (const id of ids) {
        if (!next[id]) next[id] = { name: '', category: 'Otro' };
      }
      this.devicesConfig = next;
      this.saveToStorage();
    },

    setDeviceName(id, name) {
      if (!id) return;
      const cfg = this.devicesConfig[id] || { name: '', category: 'Otro' };
      this.devicesConfig = { ...this.devicesConfig, [id]: { ...cfg, name: String(name || '') } };
      this.saveToStorage();
    },

    setDeviceCategory(id, category) {
      if (!id) return;
      const allowed = ['Masculina', 'Femenina', 'Otro'];
      const cat = allowed.includes(category) ? category : 'Otro';
      const cfg = this.devicesConfig[id] || { name: '', category: 'Otro' };
      this.devicesConfig = { ...this.devicesConfig, [id]: { ...cfg, category: cat } };
      this.saveToStorage();
    },

    clearDevices() {
      this.devicesConfig = {};
      this.saveToStorage();
    },
  },
});
