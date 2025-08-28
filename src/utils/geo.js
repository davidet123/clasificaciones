// src/utils/geo.js
// Geodesia, parse de GPX, resampleo a checkpoints y utilidades de proyección.
// Distancias en km, velocidades km/h, ritmo min/km.

const R = 6371; // km

export function toRad(d) { return d * Math.PI / 180; }

export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ----------------- GPX -----------------
export function buildCumulative(points) {
  const cumKm = [0];
  for (let i = 1; i < points.length; i++) {
    cumKm.push(cumKm[i-1] + haversineKm(points[i-1].lat, points[i-1].lon, points[i].lat, points[i].lon));
  }
  return { cumKm, totalKm: cumKm[cumKm.length - 1] };
}

export function parseGPX(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const pts = Array.from(doc.getElementsByTagName("trkpt")).map(el => ({
    lat: parseFloat(el.getAttribute("lat")),
    lon: parseFloat(el.getAttribute("lon")),
    ele: el.getElementsByTagName("ele")[0]?.textContent ? parseFloat(el.getElementsByTagName("ele")[0].textContent) : null
  }));
  if (pts.length < 2) throw new Error("GPX sin suficientes trkpt");
  const { totalKm } = buildCumulative(pts);
  return { points: pts, totalKm };
}

// ----------------- Resampleo a checkpoints -----------------
function lerpLatLon(p0, p1, t) {
  return { lat: p0.lat + (p1.lat - p0.lat) * t, lon: p0.lon + (p1.lon - p0.lon) * t };
}

export function resamplePolyline(points, stepMeters = 50) {
  const stepKm = stepMeters / 1000;
  const { cumKm, totalKm } = buildCumulative(points);
  const cps = [];

  const nSteps = Math.max(1, Math.floor(totalKm / stepKm));
  for (let i = 0; i <= nSteps; i++) {
    const targetKm = Math.min(totalKm, i * stepKm);

    // localizar segmento con búsqueda binaria
    let lo = 0, hi = points.length - 2, seg = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cumKm[mid] <= targetKm && targetKm <= cumKm[mid + 1]) { seg = mid; break; }
      if (cumKm[mid] < targetKm) lo = mid + 1; else hi = mid - 1;
    }
    const segStartKm = cumKm[seg];
    const segLenKm = Math.max(0, cumKm[seg+1] - cumKm[seg]);
    const tSeg = segLenKm > 0 ? (targetKm - segStartKm) / segLenKm : 0;
    const p = lerpLatLon(points[seg], points[seg+1], tSeg);

    cps.push({ lat: p.lat, lon: p.lon, kmAcc: targetKm, idxSeg: seg, tSeg });
  }

  // último punto exacto
  const last = points[points.length - 1];
  if (cps[cps.length - 1].kmAcc < totalKm - 1e-6) {
    cps.push({ lat: last.lat, lon: last.lon, kmAcc: totalKm, idxSeg: points.length - 2, tSeg: 1 });
  }
  return { cps, totalKm };
}

// ----------------- Proyección / progreso -----------------
function _projXY(lat, lon, refLat) {
  const kx = Math.cos(toRad(refLat));
  return { x: lon * kx, y: lat };
}
function _invXY(x, y, refLat) {
  const kx = Math.cos(toRad(refLat));
  return { lat: y, lon: x / kx };
}

export function projectPointToSegment(lat, lon, a, b) {
  const refLat = (a.lat + b.lat) / 2;
  const A = _projXY(lat, lon, refLat);
  const P0 = _projXY(a.lat, a.lon, refLat);
  const P1 = _projXY(b.lat, b.lon, refLat);

  const dx = P1.x - P0.x, dy = P1.y - P0.y;
  const denom = (dx*dx + dy*dy) || 1e-12;
  let t = ((A.x - P0.x) * dx + (A.y - P0.y) * dy) / denom;
  const tClamp = Math.max(0, Math.min(1, t));
  const px = P0.x + tClamp * dx;
  const py = P0.y + tClamp * dy;
  const proj = _invXY(px, py, refLat);

  const segLenKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
  return { tClamp, projLat: proj.lat, projLon: proj.lon, segLenKm };
}

export function progressBetweenCps(lat, lon, cps, totalKm, i) {
  const a = cps[i];
  const b = cps[Math.min(i + 1, cps.length - 1)];
  const proj = projectPointToSegment(lat, lon, a, b);
  const kmLocal = proj.segLenKm * proj.tClamp;
  const kmRecorridos = Math.min(totalKm, a.kmAcc + kmLocal);
  const kmRestantes = Math.max(0, totalKm - kmRecorridos);
  return {
    kmRecorridos,
    kmRestantes,
    distDesdeCPm: kmLocal * 1000,
    distHastaCPm: Math.max(0, (proj.segLenKm * 1000) - kmLocal * 1000),
    i,
    projLat: proj.projLat,
    projLon: proj.projLon
  };
}

// Buscar CP más cercano en ventana con tolerancia
export function nearestCpInWindow(lat, lon, cps, fromIdx, windowSize = 10, toleranceMeters = 50) {
  const toIdx = Math.min(cps.length - 1, fromIdx + windowSize);
  let best = { cpIdx: -1, distKm: Infinity };
  for (let i = fromIdx; i <= toIdx; i++) {
    const d = haversineKm(lat, lon, cps[i].lat, cps[i].lon);
    if (d < best.distKm) best = { cpIdx: i, distKm: d };
  }
  if (best.cpIdx === -1) return null;
  if (best.distKm > toleranceMeters / 1000) return null;
  return best;
}

// ----------------- Formatos -----------------
export function kmhToPaceMinPerKm(kmh) {
  if (!kmh || kmh <= 0) return null;
  return 60 / kmh;
}
export function formatPace(minPerKm) {
  if (!minPerKm) return '—';
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2,'0')} min/km`;
}
export function formatHMSfromMs(ms) {
  if (ms < 0 || !isFinite(ms)) return '—';
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
export function formatClockFromMsFromNow(msFromNow) {
  if (!isFinite(msFromNow)) return '—';
  const dt = new Date(Date.now() + msFromNow);
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
