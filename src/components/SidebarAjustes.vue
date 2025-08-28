<template>
  <!-- Panel inferior SIN overlay -->
  <transition name="slide-up">
    <v-sheet
      v-if="open"
      color="surface"
      elevation="6"
      class="bottom-sheet"
      :style="sheetStyle"
      role="dialog"
      aria-modal="true"
    >
      <!-- Barra superior del panel -->
      <div class="sheet-header">
        <div class="dragbar" />
        <div class="title">
          <v-icon icon="mdi-tune" size="20" class="mr-2" />
          Ajustes / Monitor
        </div>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" @click="open = false" />
      </div>

      <!-- Contenido scrollable -->
      <div class="sheet-body">
        <!-- Cronómetro -->
        <v-card variant="tonal" class="mb-4">
          <v-card-text class="py-4">
            <div class="text-overline mb-2">Cronómetro</div>
            <div class="text-h3 font-mono">{{ elapsedLabel }}</div>
            <div class="mt-2">
              <v-chip size="small" :color="running ? 'success' : 'grey'">
                {{ running ? 'En marcha' : 'Detenido' }}
              </v-chip>
            </div>
            <div class="mt-3 flex gap-2 flex-wrap">
              <v-btn color="primary" @click="forceStart">Iniciar (CP1)</v-btn>
              <v-btn color="secondary" variant="tonal" @click="stop">Parar</v-btn>
              <v-btn color="error" variant="tonal" @click="reset">Reset</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-divider class="my-4" />

        <!-- Dispositivos -->
        <div class="text-subtitle-1 mb-2">Dispositivos</div>
        <v-table density="compact" class="mb-8">
          <thead>
            <tr>
              <th>Id</th>
              <th>CP</th>
              <th>%</th>
              <th>Km</th>
              <th>Rest.</th>
              <th>Vel</th>
              <th>Ritmo</th>
              <th>ETA</th>
              <th>Consistencia</th>
              <th>PB</th>
              <th>Δ objetivo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in devices" :key="d.id">
              <td>
                <v-chip :style="{background:d.color,color:'white'}" size="small">{{ d.id }}</v-chip>
              </td>
              <td> {{ d.cpIdx ?? 0 }} / {{ totalCps }} </td>
              <td> {{ (d.progressPct ?? 0).toFixed(1) }}% </td>
              <td>{{ (d.kmRecorridos ?? 0).toFixed(2) }}</td>
              <td>{{ (d.kmRestantes ?? 0).toFixed(2) }}</td>
              <td>{{ (d.last?.velKmh ?? 0).toFixed(1) }} km/h</td>
              <td>{{ formatPace(d.paceAvgMinPerKm) }}</td>

              <!-- ETA -->
              <td>
                <div v-if="d.etaArmed && isFiniteMs(d.etaMs)">
                  {{ formatHMSfromMs(d.etaMs) }}
                </div>
                <div v-else class="text-medium-emphasis">
                  Pendiente {{ etaStartPercent * 100 }}%
                </div>
              </td>

              <!-- Consistencia -->
              <td>
                <template v-if="d.consistency?.paceStdSec != null">
                  ±{{ Math.round(d.consistency.paceStdSec) }} s/km
                  <v-chip size="x-small" class="ml-1" :color="consColor(d)">
                    {{ d.consistency.paceVarLabel }}
                  </v-chip>
                </template>
                <template v-else>—</template>
              </td>

              <!-- PB + edición -->
              <td style="min-width: 280px;">
                <div class="text-caption" v-if="d.personalBest?.pbTimeMs">
                  {{ hms(d.personalBest.pbTimeMs) }} ({{ formatPace(d.personalBest.targetPaceMinPerKm) }})
                </div>
                <div class="d-flex align-center mt-1">
                  <v-text-field
                    v-model="pbTimeById[d.id]"
                    label="PB hh:mm:ss"
                    hide-details="auto"
                    density="compact"
                    style="max-width: 140px"
                  />
                  <v-text-field
                    v-model="pbDistById[d.id]"
                    label="Dist (km)"
                    hide-details="auto"
                    density="compact"
                    style="max-width: 100px"
                    class="ml-2"
                  />
                  <v-btn size="small" class="ml-2" @click="savePB(d.id)" color="primary" variant="tonal">Guardar</v-btn>
                </div>
              </td>

              <!-- Δ objetivo en segundos con flecha -->
              <td>
                <template v-if="d.target?.deltaToPBms != null && d.etaArmed">
                  <div class="d-flex align-center">
                    <v-icon
                      :icon="d.target.onTarget ? 'mdi-arrow-down-bold' : 'mdi-arrow-up-bold'"
                      :color="d.target.onTarget ? 'success' : 'error'"
                      size="18"
                      class="mr-1"
                    />
                    <span :class="d.target.onTarget ? 'text-success' : 'text-error'">
                      {{ formatDeltaSeconds(d.target.deltaToPBms) }}
                    </span>
                  </div>
                </template>
                <template v-else>—</template>
              </td>

              <!-- Estado -->
              <td class="whitespace">
                <v-chip v-if="d.status?.offRoute" color="warning" size="x-small" class="mr-1">Off-route</v-chip>
                <v-chip v-if="d.status?.outlierJump" color="error" size="x-small" class="mr-1">Jump</v-chip>
                <v-chip v-if="d.status?.frozenEta" color="info" size="x-small" class="mr-1">ETA congelada</v-chip>
                <v-chip v-if="(d.status?.gapSec ?? 0) > 4" color="grey" size="x-small" class="mr-1">{{ Math.round(d.status.gapSec) }}s gap</v-chip>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-sheet>
  </transition>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useTrackingStore } from '@/stores/trackingStore';
import { useGpxStore } from '@/stores/gpxStore';
import { formatPace, formatHMSfromMs } from '@/utils/geo';
import { msToHMS as hms, parseHMSToMs } from '@/stores/trackingStore';

const props = defineProps({ modelValue: { type: Boolean, default: false } });
const emit = defineEmits(['update:modelValue']);

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
});

const tracking = useTrackingStore();
const gpx = useGpxStore();
const { list } = storeToRefs(tracking);
const devices = list;
const totalCps = computed(() => gpx.cps?.length ? gpx.cps.length - 1 : 0);
const etaStartPercent = computed(() => tracking.etaStartPercent);

// Crono
const now = ref(Date.now());
let int = null;
onMounted(() => { int = setInterval(() => { now.value = Date.now(); }, 250); });
onBeforeUnmount(() => { if (int) clearInterval(int); });

const running = computed(() => !!tracking.startTime);
const elapsedMs = computed(() => tracking.startTime ? (now.value - tracking.startTime) : 0);
const elapsedLabel = computed(() => formatHMSfromMs(elapsedMs.value));

function forceStart(){ tracking.forceStartAtFirstCP(); }
function reset(){ tracking.resetAll(); }
function stop(){ tracking.stopCrono(); }

// PB inputs por dispositivo
const pbTimeById = ref({});
const pbDistById = ref({});

watch(devices, (arr) => {
  arr.forEach(d => {
    if (d.personalBest?.pbTimeMs && !pbTimeById.value[d.id]) {
      pbTimeById.value[d.id] = hms(d.personalBest.pbTimeMs);
    }
    if (d.personalBest?.pbDistanceKm && !pbDistById.value[d.id]) {
      pbDistById.value[d.id] = String(d.personalBest.pbDistanceKm);
    }
  });
}, { immediate: true, deep: true });

function savePB(id){
  const tStr = pbTimeById.value[id];
  const ms = parseHMSToMs(tStr);
  const dist = Number(pbDistById.value[id]);
  if (!ms || ms <= 0) return;
  tracking.setPersonalBest(id, ms, isFinite(dist) && dist > 0 ? dist : undefined);
}

function sign(ms){ return ms <= 0 ? '-' : '+'; }
function formatDeltaSeconds(ms){
  if (ms == null || !isFinite(ms)) return '—';
  const s = Math.round(Math.abs(ms)/1000);
  return `${sign(ms)} ${s}s`;
}

function paceGapText(sec){
  const sign = sec >= 0 ? '+' : '';
  return `${sign}${sec} s/km vs objetivo`;
}

function consColor(d){
  const label = d.consistency?.paceVarLabel || '';
  if (label === 'muy constante') return 'success';
  if (label === 'constante') return 'info';
  if (label === 'variable') return 'warning';
  return 'error';
}

function isFiniteMs(v){ return v != null && isFinite(v); }

/* Altura fija del panel: cambia aquí si quieres otro valor */
const sheetHeightPx = 500; // ← ajusta este número (por ejemplo 400, 600, 800)
const sheetStyle = computed(() => {
  return `
    position: fixed;
    left: 0; right: 0; bottom: 0;
    height: ${sheetHeightPx}px;
    z-index: 1001;
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    display: flex;
    flex-direction: column;
  `;
});
</script>

<style scoped>
/* Animación de entrada/salida inferior */
.slide-up-enter-active, .slide-up-leave-active {
  transition: transform .22s ease, opacity .22s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(12px);
  opacity: 0;
}

/* Layout del sheet */
.bottom-sheet { overflow: hidden; }
.sheet-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0,0,0,.08);
}
.dragbar {
  width: 36px; height: 4px; border-radius: 999px;
  background: rgba(0,0,0,.2);
  margin: 6px auto 8px 8px;
}
.title { font-weight: 600; display: flex; align-items: center; }

.sheet-body {
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.whitespace { white-space: nowrap; }
.text-success { color: #2e7d32; }
.text-error { color: #c62828; }
</style>
