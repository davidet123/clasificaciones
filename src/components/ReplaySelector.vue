<template>
  <div class="p-4 bg-white shadow-xl rounded-lg w-96">
    <h2 class="text-lg font-semibold mb-3">Seleccionar Replay</h2>

    <div v-if="loading" class="text-gray-500">Cargando replays...</div>
    <div v-else-if="error" class="text-red-500">{{ error }}</div>
    <div v-else-if="replays.length === 0" class="text-gray-500">No hay replays disponibles</div>

    <ul v-else class="space-y-2">
      <li v-for="rep in replays" :key="rep.date + rep.raceId">
        <button
          class="w-full text-left px-3 py-2 rounded border hover:bg-blue-100"
          @click="selectReplay(rep)"
        >
          <div class="font-medium">{{ rep.date }} – {{ rep.raceId }}</div>
          <div class="text-xs text-gray-600">
            {{ formatDate(rep.t0) }} → {{ formatDate(rep.tEnd) }}
          </div>
          <div class="text-xs text-gray-500">
            {{ rep.devices?.length || 0 }} dispositivos
          </div>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useReplayStore } from "@/stores/replayStore";

const replayStore = useReplayStore();

const replays = ref([]);
const loading = ref(false);
const error = ref(null);

function formatDate(ms) {
  if (!ms) return "-";
  return new Date(ms).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

async function loadList() {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch("http://localhost:3000/replay/list");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    replays.value = await res.json();
  } catch (e) {
    error.value = `Error al cargar lista: ${e.message}`;
  } finally {
    loading.value = false;
  }
}

function selectReplay(rep) {
  console.log(rep)
  replayStore.setReplay(rep); // 🔹 usamos manifest completo
  replayStore.play()
}

onMounted(loadList);
</script>
