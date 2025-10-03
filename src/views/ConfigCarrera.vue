<!-- src/views/ConfigCarrera.vue -->
<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h1 class="text-2xl font-semibold mb-4">Configuración de carrera</h1>

    <!-- vMix -->
    <section class="mb-8 border rounded-xl p-4">
      <h2 class="text-lg font-medium mb-3">Conexión vMix</h2>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="flex-1">
          <label class="block text-sm text-gray-600 mb-1">URL de vMix</label>
          <input
            v-model="vmixUrlLocal"
            type="text"
            placeholder="http://127.0.0.1:8088/"
            class="w-full border rounded-lg px-3 py-2"
          />
          <p class="text-xs text-gray-500 mt-1">Usa el endpoint de la API Web de vMix (8088).</p>
        </div>
        <div class="flex gap-2">
          <button @click="guardarVmixUrl" class="px-4 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200">Guardar</button>
          <button @click="probarPing" :disabled="probando" class="px-4 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200">
            {{ probando ? 'Probando…' : 'Probar' }}
          </button>
        </div>
      </div>
      <p v-if="pingMsg" class="text-sm mt-2" :class="pingOk ? 'text-green-600' : 'text-red-600'">{{ pingMsg }}</p>
    </section>

    <!-- GPX global -->
    <section class="mb-8 border rounded-xl p-4">
      <h2 class="text-lg font-medium mb-3">Ruta GPX (global)</h2>

      <div class="flex flex-col gap-3 md:flex-row md:items-end">
        <div class="flex-1">
          <label class="block text-sm text-gray-600 mb-1">Ruta GPX</label>
          <input
            v-model="gpxPathLocal"
            type="text"
            placeholder="/assets/media_albacete.gpx"
            class="w-full border rounded-lg px-3 py-2"
          />
          <p class="text-xs text-gray-500 mt-1">
            Se guardará en localStorage y se cargará globalmente al iniciar la app.
          </p>
        </div>

        <div class="w-full md:w-64">
          <label class="block text-sm text-gray-600 mb-1">Recientes</label>
          <select v-model="gpxPathLocal" class="w-full border rounded-lg px-2 py-2">
            <option v-for="p in race.recentGpxPaths" :key="p" :value="p">{{ p }}</option>
            <option v-if="!race.recentGpxPaths?.length" disabled>(Sin recientes)</option>
          </select>
        </div>

        <div class="flex gap-2">
          <button @click="guardarGpxPath" class="px-4 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200" title="Guardar ruta GPX">
            Guardar
          </button>
          <button @click="aplicarGpxAhora" class="px-4 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200" title="Cargar GPX ahora">
            Aplicar GPX
          </button>
        </div>
      </div>

      <p v-if="gpxMsg" class="text-sm mt-2" :class="gpxOk ? 'text-green-600' : 'text-red-600'">{{ gpxMsg }}</p>
    </section>

    <!-- Dispositivos -->
    <section class="mb-8 border rounded-xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-medium">Dispositivos y metadatos</h2>
        <div class="flex gap-2">
          <button @click="sincronizarDispositivos" class="px-3 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200">
            Refrescar dispositivos
          </button>
          <button @click="guardarTodo" class="px-3 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200">
            Guardar todo
          </button>
        </div>
      </div>

      <div v-if="rows.length === 0" class="text-sm text-gray-600">
        No hay dispositivos aún. Abre la vista Live (/mapa) o pulsa “Refrescar dispositivos” cuando exista listado en el tracking.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left border-b">
              <th class="py-2 pr-4">ID</th>
              <th class="py-2 pr-4">Nombre</th>
              <th class="py-2 pr-4">Categoría</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" class="border-b last:border-0">
              <td class="py-2 pr-4 align-top"><code class="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{{ row.id }}</code></td>
              <td class="py-2 pr-4">
                <input type="text" class="w-full border rounded-lg px-2 py-1" :value="row.name" @input="onEditName(row.id, $event.target.value)" placeholder="Nombre público" />
              </td>
              <td class="py-2 pr-4">
                <select class="border rounded-lg px-2 py-1" :value="row.category" @change="onEditCategory(row.id, $event.target.value)">
                  <option value="Masculina">Masculina</option>
                  <option value="Femenina">Femenina</option>
                  <option value="Otro">Otro</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-xs text-gray-500 mt-3">
        Esta configuración no toca el <code>trackingStore</code>. Solo guarda un mapeo local id → { nombre, categoría }.
      </p>
    </section>

    <section class="text-xs text-gray-500">
      Para usar estos nombres/categorías en otras vistas, lee <code>useRaceConfigStore().devicesConfig[id]</code>.
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRaceConfigStore } from '@/stores/raceConfigStore';
import { useTrackingStore } from '@/stores/trackingStore';
import { useGpxStore } from '@/stores/gpxStore';
import { usevMixStore } from '@/stores/vMix'; // usar, NO modificar el archivo

const race = useRaceConfigStore();
const tracking = useTrackingStore();
const gpx = useGpxStore();
const vmix = usevMixStore();

const { deviceList } = storeToRefs(race);

// vMix
const vmixUrlLocal = ref('');
const probando = ref(false);
const pingMsg = ref('');
const pingOk = ref(false);

// GPX
const gpxPathLocal = ref('');
const gpxMsg = ref('');
const gpxOk = ref(false);

// Tabla
const rows = computed(() => deviceList.value.slice().sort((a, b) => a.id.localeCompare(b.id)));

onMounted(() => {
  race.init();
  vmixUrlLocal.value = race.vmixUrl || vmix.url || '';

  // Prefill GPX desde config o el actual
  gpxPathLocal.value = race.gpxPath || gpx.currentPath || '';

  // Rellenar placeholders con ids activos si ya hay lista
  const ids = (tracking.list || []).map(d => d.id);
  if (ids.length) race.ensureDevices(ids);
});

// vMix
function guardarVmixUrl() {
  race.setVmixUrl(vmixUrlLocal.value);
  pingMsg.value = 'URL guardada.';
  pingOk.value = true;
  setTimeout(() => (pingMsg.value = ''), 1500);
}

async function probarPing() {
  probando.value = true;
  pingMsg.value = '';
  pingOk.value = false;
  try {
    race.setVmixUrl(vmixUrlLocal.value);
    await vmix.pingVmix?.();
    if (vmix.status === 200) {
      pingMsg.value = 'Conexión OK.';
      pingOk.value = true;
    } else {
      pingMsg.value = vmix.errorTxt ? `Error: ${vmix.errorTxt}` : `Estado HTTP: ${vmix.status || 'desconocido'}`;
      pingOk.value = false;
    }
  } catch {
    pingMsg.value = 'No se pudo conectar con vMix.';
    pingOk.value = false;
  } finally {
    probando.value = false;
  }
}

// GPX
function guardarGpxPath() {
  race.setGpxPath(gpxPathLocal.value);
  gpxMsg.value = 'Ruta GPX guardada.';
  gpxOk.value = true;
  setTimeout(() => (gpxMsg.value = ''), 1500);
}

async function aplicarGpxAhora() {
  try {
    race.setGpxPath(gpxPathLocal.value);
    await gpx.loadFromPublic(gpxPathLocal.value); // carga inmediata
    gpxMsg.value = 'GPX cargado.';
    gpxOk.value = true;
  } catch (e) {
    gpxMsg.value = 'No se pudo cargar el GPX.';
    gpxOk.value = false;
  } finally {
    setTimeout(() => (gpxMsg.value = ''), 1800);
  }
}

// Dispositivos
function sincronizarDispositivos() {
  const ids = (tracking.list || []).map(d => d.id);
  race.ensureDevices(ids);
}
function onEditName(id, name) { race.setDeviceName(id, name); }
function onEditCategory(id, category) { race.setDeviceCategory(id, category); }
function guardarTodo() {
  race.saveToStorage();
  pingMsg.value = 'Configuración guardada.';
  pingOk.value = true;
  setTimeout(() => (pingMsg.value = ''), 1500);
}
</script>

<style scoped>
/* Minimalista para operador */
</style>
