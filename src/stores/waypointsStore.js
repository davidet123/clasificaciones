// src/stores/waypointsStore.js
import { defineStore } from 'pinia'

const STORAGE_KEY = 'race.waypoints.v1'

function normalizeKm(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}
function genId() {
  return 'wp_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36)
}

export const useWaypointsStore = defineStore('waypoints', {
  state: () => ({
    list: [], // [{ id, name, km, lat, lon, createdAt }]
    _loaded: false,
  }),
  getters: {
    sorted: (s) => s.list.slice().sort((a, b) => (a.km ?? 0) - (b.km ?? 0)),
    byId: (s) => Object.fromEntries(s.list.map(w => [w.id, w])),
  },
  actions: {
    load() {
      if (this._loaded) return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const arr = JSON.parse(raw)
          if (Array.isArray(arr)) this.list = arr.filter(x => x && typeof x.name === 'string')
        }
      } catch {}
      this._loaded = true
    },
    _save() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sorted)) } catch {}
    },
    addOrUpdate({ id, name, km, lat, lon }) {
      this.load()
      const wp = {
        id: id || genId(),
        name: String(name || '').trim() || 'Punto',
        km: normalizeKm(km),
        lat: Number(lat) || null,
        lon: Number(lon) || null,
        createdAt: Date.now(),
      }
      const idx = this.list.findIndex(x => x.id === wp.id)
      if (idx >= 0) this.list.splice(idx, 1, wp)
      else this.list.push(wp)
      this._save()
      return wp.id
    },
    remove(id) {
      this.load()
      const idx = this.list.findIndex(x => x.id === id)
      if (idx >= 0) this.list.splice(idx, 1)
      this._save()
    },
    clear() {
      this.list = []
      this._save()
    }
  },
})
