<!-- src/views/ConfigCarrera.vue -->
<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h1 class="text-2xl font-semibold mb-4">Configuración de carrera</h1>

    <!-- vMix -->
    <section class="mb-8 border rounded-xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-medium">Conexión vMix</h2>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="flex-1">
          <label class="block text-sm text-gray-600 mb-1">URL de vMix</label>
          <input
            v-model="vmixUrlLocal"
            type="text"
            placeholder="http://127.0.0.1:8088/"
            class="w-full border rounded-lg px-3 py-2"
          />
          <p class="text-xs text-gray-500 mt-1">
            Usa la URL de la API Web (puerto 8088 por defecto).
          </p>
        </div>

        <div class="flex gap-2">
          <button
            @click="guardarVmixUrl"
            class="px-4 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200"
            title="Guardar URL en configuración y reflejar en vMix store"
          >
            Guardar
          </button>
          <button
            @click="probarPing"
            class="px-4 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200"
            :disabled="probando"
            title="Probar conexión con vMix"
          >
            {{ probando ? 'Probando…' : 'Probar' }}
          </button>
        </div>
      </div>

      <p v-if="pingMsg" class="text-sm mt-2" :class="pingOk ? 'text-green-600' : 'text-red-600'">
        {{ pingMsg }}
      </p>
    </section>

    <!-- Live/WS -->
    <section class="mb-8 border rounded-xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-medium">Dispositivos en Live</h2>
        <div class="flex gap-2">
          <button
            v-if="!wsConnected"
            @click="conectarLive"
            class="px-3 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200"
            title="Conectar temporalmente al WebSocket del bridge para descubrir dispositivos"
          >
            Conectar Live
          </button>
          <button
            v-else
            @click="desconectarLive"
            class="px-3 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200"
            title="Desconectar WebSocket"
          >
            Desconectar
          </button>

          <button
            @click="sincronizarDispositivos"
            class="px-3 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200"
            title="Añadir a la configuración los dispositivos detectados sin sobrescribir nombres existentes"
          >
            Refrescar dispositivos
          </button>

          <button
            @click="guardarTodo"
            class="px-3 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200"
            title="Guardar configuración en localStorage"
          >
            Guardar todo
          </button>
        </div>
      </div>

      <p class="text-xs text-gray-500 mb-3">
        Estado WS: <strong>{{ wsConnected ? 'Conectado' : 'Desconectado' }}</strong>
        <span v-if="idsLive.length" class="ml-2">· Detectados: {{ idsLive.length }}</span>
      </p>

      <div v-if="rows.length === 0" class="text-sm text-gray-600">
        No hay dispositivos aún. Abre la vista Live (/mapa) para que lleguen posiciones, pulsa “Conectar Live”
        si usas esta vista en solitario, o dale a “Refrescar dispositivos”.
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
              <td class="py-2 pr-4 align-top">
                <code class="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{{ row.id }}</code>
              </td>
              <td class="py-2 pr-4">
                <input
                  type="text"
                  class="w-full border rounded-lg px-2 py-1"
                  :value="row.name"
                  @input="onEditName(row.id, $event.target.value)"
                  placeholder="Nombre público (dorsal/alias)"
                />
              </td>
              <td class="py-2 pr-4">
                <select
                  class="border rounded-lg px-2 py-1"
                  :value="row.category"
                  @change="onEditCategory(row.id, $event.target.value)"
                >
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
        No se toca <code>trackingStore</code>. Solo se guarda un mapeo local id → { nombre, categoría }.
      </p>
    </section>

    <section class="text-xs text-gray-500">
      Para usar nombres/categorías en otras vistas:
      <code>useRaceConfigStore().devicesConfig[id]</code>.
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRaceConfigStore } from '@/stores/raceConfigStore';
import { useTrackingStore } from '@/stores/trackingStore';
import { usevMixStore } from '@/stores/vMix'; // usar, NO modificar el archivo

const race = useRaceConfigStore();
const tracking = useTrackingStore();
const vmix = usevMixStore();

const { deviceList } = storeToRefs(race);
const vmixUrlLocal = ref('');
const probando = ref(false);
const pingMsg = ref('');
const pingOk = ref(false);

// Conectividad WS (lectura simple del flag interno)
const wsConnected = computed(() => Boolean(tracking._ws && tracking._wsUrl));

// IDs actualmente en Live
const idsLive = computed(() => (tracking.list || []).map(d => d.id));

// Filas ordenadas para la tabla
const rows = computed(() => deviceList.value.slice().sort((a, b) => a.id.localeCompare(b.id)));

onMounted(() => {
  race.init();
  vmixUrlLocal.value = race.vmixUrl || vmix.url || '';

  // Sincroniza placeholders con lo que ya hubiera al montar
  if (idsLive.value.length) race.ensureDevices(idsLive.value);
});

// 1) Sincronización reactiva: cuando cambia el listado de dispositivos Live, completar placeholders
watch(
  () => idsLive.value.join(','),
  () => {
    if (idsLive.value.length) race.ensureDevices(idsLive.value);
  },
  { immediate: false }
);

function guardarVmixUrl() {
  race.setVmixUrl(vmixUrlLocal.value);
  pingMsg.value = 'URL guardada.';
  pingOk.value = true;
  setTimeout(() => (pingMsg.value = ''), 1400);
}

async function probarPing() {
  probando.value = true;
  pingMsg.value = '';
  pingOk.value = false;
  try {
    race.setVmixUrl(vmixUrlLocal.value); // sincroniza primero
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

function sincronizarDispositivos() {
  if (idsLive.value.length) race.ensureDevices(idsLive.value);
}

// 2) Conectar/desconectar Live desde aquí si trabajas en solitario en /config
const WS_URL_DEFAULT = 'ws://localhost:3000';

function conectarLive() {
  try {
    tracking.connectWS?.(WS_URL_DEFAULT);
  } catch {/* sin drama */}
}

function desconectarLive() {
  try {
    tracking.disconnectWS?.();
  } catch {/* sin drama */}
}

function onEditName(id, name) {
  race.setDeviceName(id, name);
}

function onEditCategory(id, category) {
  race.setDeviceCategory(id, category);
}

function guardarTodo() {
  race.saveToStorage();
  pingMsg.value = 'Configuración guardada.';
  pingOk.value = true;
  setTimeout(() => (pingMsg.value = ''), 1400);
}
</script>

<style scoped>
/* Minimalista para operador de realización */
</style>
