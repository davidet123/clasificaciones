// src/utils/geo.js
// Utilidades geométricas y de formato usadas por el mapa, el sidebar y el store GPX.

// -----------------------------
// Distancias y proyección
// -----------------------------

// Distancia Haversine en km
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0088;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Proyección local de un punto P sobre el segmento AB y progreso sobre el track (en km acumulados)
// Ahora también devuelve segIdx (segmento elegido) y tSeg (0..1 dentro del segmento)
export function progressBetweenCps(lat, lon, cps, totalKm, startIdx = 0) {
  if (!Array.isArray(cps) || cps.length < 2) {
    return {
      projLat: lat, projLon: lon,
      kmRecorridos: 0, kmRestantes: totalKm || 0,
      distDesdeCPm: 0, distHastaCPm: (totalKm || 0) * 1000,
      segIdx: 0, tSeg: 0
    };
  }

  const lo = Math.max(0, startIdx - 5);
  const hi = Math.min(cps.length - 2, startIdx + 5);

  let best = { d: Infinity, projLat: cps[startIdx].lat, projLon: cps[startIdx].lon, i: startIdx, t: 0 };

  for (let i = lo; i <= hi; i++) {
    const A = cps[i], B = cps[i + 1];
    // Plano local equirectangular en metros
    const toRad = x => (x * Math.PI) / 180;
    const R = 6371008.8; // m
    const lat0 = toRad(A.lat);
    const xA = toRad(A.lon) * Math.cos(lat0) * R, yA = toRad(A.lat) * R;
    const xB = toRad(B.lon) * Math.cos(lat0) * R, yB = toRad(B.lat) * R;
    const xP = toRad(lon) * Math.cos(lat0) * R, yP = toRad(lat) * R;

    const vx = xB - xA, vy = yB - yA;
    const wx = xP - xA, wy = yP - yA;
    const L2 = vx * vx + vy * vy || 1e-9;
    let t = (wx * vx + wy * vy) / L2;
    t = Math.max(0, Math.min(1, t));

    const xH = xA + t * vx, yH = yA + t * vy;
    const d = Math.hypot(xP - xH, yP - yH);

    if (d < best.d) {
      best = {
        d,
        projLat: (yH / R) * 180 / Math.PI,
        projLon: (xH / (R * Math.cos(lat0))) * 180 / Math.PI,
        i,
        t
      };
    }
  }

  const i = best.i;
  const A = cps[i], B = cps[i + 1];
  const segKm = Math.max(0, (B.kmAcc - A.kmAcc));
  const alongKm = segKm * best.t;
  const kmRecorridos = (A.kmAcc + alongKm);
  const total = totalKm || cps[cps.length - 1].kmAcc || 0;
  const kmRestantes = Math.max(0, total - kmRecorridos);

  const distDesdeCPm = alongKm * 1000;
  const distHastaCPm = Math.max(0, (segKm - alongKm) * 1000);

  return {
    projLat: best.projLat,
    projLon: best.projLon,
    kmRecorridos,
    kmRestantes,
    distDesdeCPm,
    distHastaCPm,
    segIdx: i,
    tSeg: best.t
  };
}

// -----------------------------
// Ritmos y formatos
// -----------------------------

// Velocidad (km/h) -> ritmo (min/km) en decimal de minutos
export function kmhToPaceMinPerKm(vKmh) {
  const v = Number(vKmh);
  if (!isFinite(v) || v <= 0) return null;
  return 60 / v; // minutos por km (decimal)
}

// Formatea minutos por km (decimal) a "mm:ss/km"
export function formatPace(minPerKm) {
  const p = Number(minPerKm);
  if (!isFinite(p) || p <= 0) return '—';
  const totalSeconds = Math.round(p * 60);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}/km`;
}

// "HH:MM:SS" desde milisegundos
export function formatHMSfromMs(ms) {
  const v = Number(ms);
  if (!isFinite(v) || v < 0) return '00:00:00';
  const s = Math.floor(v / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// -----------------------------
// Parser GPX y remuestreo
// -----------------------------

/**
 * Resamplea una polilínea de puntos {lat, lon, ele?} cada ~stepMeters.
 * Devuelve { cps } con puntos equiespaciados y kmAcc; intenta interpolar ele si existe.
 */
export function resamplePolyline(points, stepMeters) {
  if (!Array.isArray(points) || points.length < 2 || !stepMeters || stepMeters <= 0) {
    // Compatibilidad: devolvemos cps de todos los puntos con kmAcc
    const { cps } = buildCpsFromPoints(points || [], undefined);
    return { cps };
  }
  // Simplemente nos apoyamos en buildCpsFromPoints con stepMeters
  const { cps } = buildCpsFromPoints(points, stepMeters);
  return { cps };
}

/**
 * parseGPX
 * Recibe el XML GPX en texto y devuelve:
 *  - points: [{lat, lon, ele?}] todos los puntos del track
 *  - cps: [{lat, lon, kmAcc, ele?}] checkpoints con distancia acumulada (siempre)
 *  - totalKm: distancia total del track
 *
 * @param {string} xmlText - contenido del .gpx
 * @param {number|undefined} stepMeters - si se indica, re-muestrea para crear CPs cada ~stepMeters
 */
export function parseGPX(xmlText, stepMeters) {
  if (!xmlText || typeof xmlText !== 'string') {
    return { points: [], cps: [], totalKm: 0 };
  }

  // Parse básico de GPX
  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlText, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error('GPX XML inválido');
  } catch {
    return { points: [], cps: [], totalKm: 0 };
  }

  const trkpts = Array.from(doc.querySelectorAll('trkpt'));
  const pick = (nodes) =>
    nodes.map(el => {
      const eleNode = el.querySelector('ele');
      return {
        lat: parseFloat(el.getAttribute('lat')),
        lon: parseFloat(el.getAttribute('lon')),
        ele: eleNode ? parseFloat(eleNode.textContent) : undefined
      };
    }).filter(p => isFinite(p.lat) && isFinite(p.lon));

  const rawPoints = trkpts.length ? pick(trkpts) : pick(Array.from(doc.querySelectorAll('rtept')));
  const points = rawPoints;

  const { cps, totalKm } = buildCpsFromPoints(points, stepMeters);
  return { points, cps, totalKm };
}

// Construye CPs con km acumulado; si stepMeters se indica, genera CPs aprox cada stepMeters.
// Incluye elevación (ele) si está disponible en los puntos originales.
function buildCpsFromPoints(points, stepMeters) {
  if (!Array.isArray(points) || points.length < 2) {
    return { cps: [], totalKm: 0 };
  }

  // Distancia acumulada por punto
  const kmAccByIdx = new Array(points.length).fill(0);
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    acc += haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    kmAccByIdx[i] = acc;
  }
  const totalKm = acc;

  // Si no hay stepMeters, dejamos cps = todos los puntos con su kmAcc (y ele si existe)
  if (!stepMeters || !isFinite(stepMeters) || stepMeters <= 0) {
    const cps = points.map((p, i) => ({
      lat: p.lat, lon: p.lon, kmAcc: kmAccByIdx[i],
      ele: (Number.isFinite(p.ele) ? p.ele : undefined)
    }));
    return { cps, totalKm };
  }

  // Re-muestreo: cp cada ~stepMeters a lo largo del track
  const targetStepKm = stepMeters / 1000;
  const cps = [];
  let nextKm = 0;

  cps.push({
    lat: points[0].lat,
    lon: points[0].lon,
    kmAcc: 0,
    ele: (Number.isFinite(points[0].ele) ? points[0].ele : undefined)
  });

  for (let i = 1; i < points.length; i++) {
    const kA = kmAccByIdx[i - 1], kB = kmAccByIdx[i];
    while (kB >= nextKm + targetStepKm) {
      const kmTarget = nextKm + targetStepKm;
      const t = (kmTarget - kA) / Math.max(1e-9, (kB - kA));
      const lat = lerp(points[i - 1].lat, points[i].lat, t);
      const lon = lerp(points[i - 1].lon, points[i].lon, t);
      const eA = Number.isFinite(points[i - 1].ele) ? points[i - 1].ele : undefined;
      const eB = Number.isFinite(points[i].ele) ? points[i].ele : undefined;
      const ele = (Number.isFinite(eA) && Number.isFinite(eB)) ? lerp(eA, eB, t) : undefined;
      cps.push({ lat, lon, kmAcc: kmTarget, ele });
      nextKm += targetStepKm;
    }
  }

  // Asegura último punto/meta
  const last = points[points.length - 1];
  if (cps[cps.length - 1]?.kmAcc !== totalKm) {
    cps.push({
      lat: last.lat,
      lon: last.lon,
      kmAcc: totalKm,
      ele: (Number.isFinite(last.ele) ? last.ele : undefined)
    });
  }

  return { cps, totalKm };
}

function lerp(a, b, t) { return a + (b - a) * t; }

// -----------------------------
// Altitud a lo largo del km (para perfil/slope)
// -----------------------------
export function altAtKm(cps, km) {
  if (!Array.isArray(cps) || cps.length === 0 || !isFinite(km)) return null;
  const total = cps[cps.length - 1].kmAcc ?? 0;
  const x = Math.max(0, Math.min(total, km));

  // Búsqueda lineal rápida (arrays no enormes). Si quieres, cámbialo por binaria.
  for (let i = 0; i < cps.length - 1; i++) {
    const a = cps[i], b = cps[i + 1];
    if (x >= a.kmAcc && x <= b.kmAcc) {
      const seg = b.kmAcc - a.kmAcc || 1e-9;
      const t = (x - a.kmAcc) / seg;
      const eA = Number.isFinite(a.ele) ? a.ele : null;
      const eB = Number.isFinite(b.ele) ? b.ele : null;
      if (eA == null || eB == null) return null;
      return lerp(eA, eB, t);
    }
  }
  const last = cps[cps.length - 1];
  return Number.isFinite(last.ele) ? last.ele : null;
}
