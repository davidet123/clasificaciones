// src/stores/runnersStore.js
import { defineStore } from 'pinia';

export const useRunnersStore = defineStore('runners', {
  state: () => ({
    list: [
      { id: 'A01', dorsal: 101, nombre: 'Ana Pérez', pais: 'ES' },
      { id: 'B07', dorsal: 203, nombre: 'Luis Martín', pais: 'ES' },
      { id: 'C12', dorsal: 315, nombre: 'Marta López', pais: 'PT' },
    ],
    selectedId: null,
  }),
  getters: {
    selected(state) {
      return state.list.find(r => r.id === state.selectedId) || null;
    }
  },
  actions: {
    select(id) { this.selectedId = id; }
  }
});
