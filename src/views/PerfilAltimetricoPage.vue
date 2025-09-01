<template>
  <v-container fluid class="perfil-page pa-0">
    <div class="header">
      <div class="title">
        <v-icon icon="mdi-chart-areaspline" size="20" class="mr-2" />
        Perfil altimétrico
      </div>
      <div class="actions">
        <v-btn icon="mdi-map" variant="flat" color="primary" @click="$router.push({ name: 'Mapa' })" title="Ir al mapa" />
      </div>
    </div>

    <div class="content">
      <div class="scroll-x">
        <PerfilAltimetrico
          :cps="gpx.cps"
          :positions-km="positions"
          :width="1800"
          :height="400"
          :show-grid="true"
        />
      </div>
    </div>

    <div class="legend" v-if="devices.length">
      <div v-for="d in devices" :key="d.id" class="leg-item">
        <span class="dot" :style="{ backgroundColor: d.color || '#e53935' }"></span>
        <span class="id">{{ displayName(d.id) }}</span>
        <span class="km">{{ (d.kmRecorridos ?? 0).toFixed(2) }} km</span>
      </div>
    </div>
  </v-container>
</template>

<script setup>
import { computed } from 'vue';
import { useGpxStore } from '@/stores/gpxStore';
import { useTrackingStore } from '@/stores/trackingStore';
import PerfilAltimetrico from '@/components/PerfilAltimetrico.vue';
import { useRaceConfigStore } from '@/stores/raceConfigStore'; // ⬅️ añadido

const gpx = useGpxStore();
const tracking = useTrackingStore();

const race = useRaceConfigStore();
const displayName = (id) => (race.devicesConfig?.[id]?.name?.trim() || id);

const devices = computed(() => tracking.list);
const positions = computed(() =>
  tracking.list.map(d => ({
    id: d.id,
    km: d.kmRecorridos ?? 0,
    color: d.color ?? '#e53935'
  }))
);
</script>

<style scoped>
.perfil-page { background: #fff; min-height: 100vh; display: flex; flex-direction: column; }
.header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid rgba(0,0,0,.06); }
.title { font-weight: 600; display: flex; align-items: center; }
.content { padding: 8px 14px 0 14px; }
.scroll-x { width: 100%; overflow-x: auto; }
.legend { display: flex; flex-wrap: wrap; gap: 10px; padding: 8px 14px 14px 14px; font-size: 14px; color: rgba(0,0,0,.75); }
.leg-item { display: flex; align-items: center; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.id { font-weight: 600; margin-right: 6px; }
.km { font-variant-numeric: tabular-nums; }
</style>
