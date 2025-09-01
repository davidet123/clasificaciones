// src/utils/kmlParser.js
//
// Parser robusto para KML de Traccar (gx:Track).
// Devuelve { tracksById: { [id]: Array<{ts,id,lat,lon,alt,speedKmh,course}> }, t0, tEnd }
//
// - Empareja EN ORDEN cada <when> con el <gx:coord> siguiente dentro del mismo <gx:Track>.
// - Si hay varios Placemark/gx:Track, crea una entrada por cada uno (id = <name> o 'kml-device').
// - Si no hay gx:Track, intenta <LineString><coordinates> (sin tiempos reales).

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) - Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function parseKmlTracks(kmlText) {
  const out = { tracksById: {}, t0: 0, tEnd: 0 };
  if (!kmlText || typeof kmlText !== 'string') return out;

  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, 'application/xml');
  if (doc.querySelector('parsererror')) return out;

  const NS_GX = 'http://www.google.com/kml/ext/2.2';
  const placemarks = Array.from(doc.getElementsByTagName('Placemark'));
  let globalMin = Infinity, globalMax = -Infinity;

  for (const pm of placemarks) {
    const name = pm.querySelector('name')?.textContent?.trim() || 'kml-device';
    const tracks = Array.from(pm.getElementsByTagNameNS(NS_GX, 'Track'));
    const rows = [];

    // Caso A: gx:Track
    for (const trk of tracks) {
      let pendingWhen = null;
      for (const node of Array.from(trk.childNodes)) {
        if (node.nodeType !== 1) continue; // solo elementos
        if (node.localName === 'when') {
          const ts = Date.parse(node.textContent.trim());
          pendingWhen = Number.isFinite(ts) ? ts : null;
        } else if (node.namespaceURI === NS_GX && node.localName === 'coord') {
          const parts = node.textContent.trim().split(/\s+/).map(Number);
          const lon = parts[0], lat = parts[1], alt = Number.isFinite(parts[2]) ? parts[2] : null;
          if (pendingWhen != null && Number.isFinite(lat) && Number.isFinite(lon)) {
            rows.push({ ts: pendingWhen, id: name, lat, lon, alt, speedKmh: null, course: null });
          }
          pendingWhen = null;
        }
      }
    }

    // Caso B: LineString (sin tiempos)
    if (!rows.length) {
      const coordsTags = Array.from(pm.getElementsByTagName('coordinates'));
      for (const tag of coordsTags) {
        const coordsText = tag.textContent?.trim() || '';
        const lines = coordsText.split(/\s+/);
        // Asigna tiempos uniformes (1 Hz) desde ahora hacia adelante
        let ts = Date.now();
        for (const line of lines) {
          if (!line) continue;
          const [lon, lat, alt] = line.split(',').map(Number);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          rows.push({ ts, id: name, lat, lon, alt: Number.isFinite(alt) ? alt : null, speedKmh: null, course: null });
          ts += 1000;
        }
      }
    }

    if (!rows.length) continue;
    rows.sort((a, b) => a.ts - b.ts);

    // Derivar velocidad/rumbo si no están
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      const dt = Math.max(0.001, (b.ts - a.ts) / 1000);
      const dKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
      const v = dKm / (dt / 3600);
      if (!Number.isFinite(b.speedKmh)) b.speedKmh = v;
      if (!Number.isFinite(b.course)) b.course = bearingDeg(a.lat, a.lon, b.lat, b.lon);
    }
    if (rows[0] && rows[1]) {
      if (!Number.isFinite(rows[0].speedKmh)) rows[0].speedKmh = rows[1].speedKmh;
      if (!Number.isFinite(rows[0].course)) rows[0].course = rows[1].course;
    }

    out.tracksById[name] = rows;
    globalMin = Math.min(globalMin, rows[0].ts);
    globalMax = Math.max(globalMax, rows[rows.length - 1].ts);
  }

  if (!isFinite(globalMin) || !isFinite(globalMax)) return out;
  out.t0 = globalMin;
  out.tEnd = globalMax;
  return out;
}
