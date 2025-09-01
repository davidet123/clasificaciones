<template>
  <div class="perfil-wrap">
    <svg
      v-if="hasData"
      :viewBox="`0 0 ${vbW} ${vbH}`"
      preserveAspectRatio="xMidYMid meet"
      class="perfil-svg"
      role="img"
      :style="{ width: `${width}px`, height: `${height}px` }"
      aria-label="Perfil altimétrico de la ruta"
    >
      <path
        v-if="pathD"
        :d="`${pathD} L ${xScale(totalKm)} ${y0} L ${xScale(0)} ${y0} Z`"
        fill="rgba(0, 102, 204, 0.08)"
        stroke="none"
      />

      <g>
        <g v-for="t in xTicks" :key="'xt'+t.value">
          <line
            :x1="xScale(t.value)" :x2="xScale(t.value)"
            :y1="y0" :y2="yTop"
            stroke="rgba(0,0,0,0.06)" stroke-width="1" shape-rendering="crispEdges"
          />
          <line
            :x1="xScale(t.value)" :x2="xScale(t.value)"
            :y1="y0" :y2="y0 + 6"
            stroke="rgba(0,0,0,0.75)" stroke-width="1" shape-rendering="crispEdges"
          />
          <text
            :x="xScale(t.value)" :y="y0 + 20"
            text-anchor="middle" font-size="11" fill="rgba(0,0,0,0.95)"
          >{{ t.label }} km</text>
        </g>

        <g v-for="t in yTicks" :key="'yt'+t.value">
          <line
            :x1="xLeft" :x2="xRight"
            :y1="yScale(t.value)" :y2="yScale(t.value)"
            stroke="rgba(0,0,0,0.06)" stroke-width="1" shape-rendering="crispEdges"
          />
          <line
            :x1="xLeft - 6" :x2="xLeft"
            :y1="yScale(t.value)" :y2="yScale(t.value)"
            stroke="rgba(0,0,0,0.75)" stroke-width="1" shape-rendering="crispEdges"
          />
          <text
            :x="xLeft - 10" :y="yScale(t.value) + 3"
            text-anchor="end" font-size="11" fill="rgba(0,0,0,0.95)"
          >{{ t.label }} m</text>
        </g>
      </g>

      <path
        v-if="pathD"
        :d="pathD"
        fill="none"
        stroke="#0066cc"
        stroke-opacity="0.9"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
      />

      <g v-for="p in safePositions" :key="p.id">
        <line
          :x1="xScale(clampKm(p.km))" :x2="xScale(clampKm(p.km))"
          :y1="y0" :y2="yTop"
          :stroke="p.color || '#e53935'"
          stroke-opacity="0.35"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
        />
        <circle
          :cx="xScale(clampKm(p.km))"
          :cy="yScale(altAt(clampKm(p.km)))"
          r="3.5"
          :fill="p.color || '#e53935'"
          stroke="white"
          stroke-width="1.2"
          vector-effect="non-scaling-stroke"
        />
      </g>

      <line :x1="xLeft" :x2="xRight" :y1="y0" :y2="y0"
            stroke="rgba(0,0,0,0.85)" stroke-width="1" shape-rendering="crispEdges" />
      <text
        :x="(xLeft + xRight) / 2" :y="vbH - 8"
        text-anchor="middle" font-size="12" fill="rgba(0,0,0,0.95)"
      >Distancia (km)</text>

      <line :x1="xLeft" :x2="xLeft" :y1="y0" :y2="yTop"
            stroke="rgba(0,0,0,0.85)" stroke-width="1" shape-rendering="crispEdges" />
      <text
        :x="m.left - 42" :y="(yTop + y0) / 2"
        text-anchor="middle" font-size="12" fill="rgba(0,0,0,0.95)"
        :transform="`rotate(-90, ${m.left - 42}, ${(yTop + y0) / 2})`"
      >Altitud (m)</text>
    </svg>

    <div v-else class="perfil-empty">
      No hay datos de altitud para dibujar el perfil.
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { altAtKm as altAtKmFn } from '@/utils/geo';

const props = defineProps({
  cps: { type: Array, default: () => [] },
  positionsKm: { type: Array, default: () => [] },
  width: { type: Number, default: 1800 },
  height: { type: Number, default: 400 },
  showGrid: { type: Boolean, default: true }
});

const hasData = computed(() => props.cps && props.cps.length >= 2);

const vbW = 1800;
const vbH = computed(() => props.height);
const m = { top: 16, right: 18, bottom: 40, left: 72 };

const xLeft  = computed(() => m.left);
const xRight = computed(() => vbW - m.right);
const yTop   = computed(() => m.top);
const y0     = computed(() => vbH.value - m.bottom);

const innerW = computed(() => Math.max(100, xRight.value - xLeft.value));
const innerH = computed(() => Math.max(60, y0.value - yTop.value));

const totalKm = computed(() => props.cps.length ? props.cps[props.cps.length - 1].kmAcc : 0);
const eleVals = computed(() => props.cps.map(p => Number.isFinite(p.ele) ? p.ele : 0));
const rawMinEle = computed(() => Math.min(...eleVals.value));
const rawMaxEle = computed(() => Math.max(...eleVals.value));

// Rango Y adaptativo con mínimo de 10 m para asegurar ticks visibles
const MIN_Y_RANGE = 10;
const midEle = computed(() => (rawMinEle.value + rawMaxEle.value) / 2);
const adjMinEle = computed(() => {
  const range = rawMaxEle.value - rawMinEle.value;
  if (!Number.isFinite(range) || range <= 0) return rawMinEle.value - 1;
  if (range < MIN_Y_RANGE) return midEle.value - MIN_Y_RANGE / 2;
  return rawMinEle.value;
});
const adjMaxEle = computed(() => {
  const range = rawMaxEle.value - rawMinEle.value;
  if (!Number.isFinite(range) || range <= 0) return rawMaxEle.value + 1;
  if (range < MIN_Y_RANGE) return midEle.value + MIN_Y_RANGE / 2;
  return rawMaxEle.value;
});

function xScale(km) {
  const t = totalKm.value > 0 ? km / totalKm.value : 0;
  return xLeft.value + t * innerW.value;
}
function yScale(ele) {
  const span = adjMaxEle.value - adjMinEle.value || 1;
  const t = (ele - adjMinEle.value) / span;
  return yTop.value + (1 - t) * innerH.value;
}

const pathD = computed(() => {
  if (!hasData.value) return '';
  let d = '';
  for (let i = 0; i < props.cps.length; i++) {
    const p = props.cps[i];
    const cmd = i === 0 ? 'M' : 'L';
    d += `${cmd} ${xScale(p.kmAcc)} ${yScale(p.ele)} `;
  }
  return d.trim();
});

// Redondeo “bonito”
function niceStep(range, targetTicks, baseSet) {
  if (range <= 0 || !Number.isFinite(range)) return 1;
  const rough = range / Math.max(1, targetTicks - 1);
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
  const candidates = baseSet.map(b => b * pow10);
  let step = candidates[0];
  for (const c of candidates) { if (rough <= c) { step = c; break; } }
  return step;
}
function fmt(value, step, maxDecimals = 2) {
  const dec = Math.max(0, -Math.floor(Math.log10(step)) || 0);
  return value.toFixed(Math.min(maxDecimals, dec));
}

// X: 5–6 ticks con final garantizado
const xTicks = computed(() => {
  const max = totalKm.value;
  if (!Number.isFinite(max) || max <= 0) return [];
  const desired = 6;
  const step = niceStep(max, desired, [1, 2, 2.5, 5]);
  const ticks = [];
  for (let v = 0; v <= max + 1e-9; v += step) {
    const vv = +v.toFixed(6);
    ticks.push({ value: vv, label: fmt(vv, step) });
  }
  const lastV = ticks.length ? ticks[ticks.length - 1].value : 0;
  if (Math.abs(lastV - max) > step * 0.25) {
    ticks.push({ value: max, label: fmt(max, step) });
  } else {
    ticks[ticks.length - 1] = { value: max, label: fmt(max, step) };
  }
  if (ticks.length > desired + 1) {
    const reduced = [];
    for (let i = 0; i < ticks.length; i++) {
      if (i === 0 || i === ticks.length - 1 || i % 2 === 0) reduced.push(ticks[i]);
    }
    return reduced;
  }
  return ticks;
});

// Y: exactamente 5 ticks sobre el rango ajustado
const yTicks = computed(() => {
  const min = adjMinEle.value;
  const max = adjMaxEle.value;
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) return [];
  const desired = 5; // exacto
  const rawStep = range / (desired - 1);
  const step = niceStep(range, desired, [1, 2, 2.5, 5]); // base agradable
  // Si el step “nice” se aleja demasiado, usa el rawStep para clavar 5 divisiones
  const useStep = step > rawStep * 1.8 ? rawStep : step;

  const start = Math.ceil(min / useStep) * useStep;
  const vals = [];
  for (let i = 0; i < desired; i++) {
    vals.push(start + i * useStep);
  }
  const minL = vals[0];
  const maxL = vals[vals.length - 1];
  const shiftDown = minL > min ? minL - min : 0;
  const shiftUp = max > maxL ? max - maxL : 0;
  const shift = shiftDown - shiftUp;
  for (let i = 0; i < vals.length; i++) vals[i] -= shift;

  vals[0] = min;
  vals[vals.length - 1] = max;

  return vals.map(v => {
    const vv = Math.round(v);
    return { value: vv, label: String(vv) };
  });
});

function altAt(km) {
  const v = altAtKmFn(props.cps, km);
  return Number.isFinite(v) ? v : adjMinEle.value;
}

const safePositions = computed(() =>
  (props.positionsKm || []).map(p => ({
    id: String(p.id ?? ''),
    km: Number.isFinite(p.km) ? p.km : 0,
    color: p.color
  })).filter(p => p.id)
);

function clampKm(km) {
  if (!Number.isFinite(km)) return 0;
  if (km < 0) return 0;
  if (km > totalKm.value) return totalKm.value;
  return km;
}
</script>

<style scoped>
.perfil-wrap { width: 100%; overflow: hidden; }
.perfil-svg  { display: block; }
.perfil-empty { font-size: 12px; color: rgba(0,0,0,.6); padding: 8px 12px; }
</style>
