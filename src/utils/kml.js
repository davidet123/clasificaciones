// Reemplaza esta función en src/utils/kml.js
export function parseTraccarKML(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') {
    return { tracksById: {}, t0: 0, tEnd: 0 };
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) {
    console.error('KML inválido');
    return { tracksById: {}, t0: 0, tEnd: 0 };
  }

  const NS_GX = 'http://www.google.com/kml/ext/2.2';
  const placemarks = Array.from(doc.getElementsByTagName('Placemark'));
  const tracksById = {};
  let globalMin = Infinity;
  let globalMax = -Infinity;

  for (const pm of placemarks) {
    const name = pm.querySelector('name')?.textContent?.trim() || 'device';

    // Captura cada gx:Track por separado y recorre sus hijos EN ORDEN
    const gxTracks = Array.from(pm.getElementsByTagNameNS(NS_GX, 'Track'));
    if (!gxTracks.length) continue;

    const rows = [];
    for (const trk of gxTracks) {
      let pendingWhen = null;
      for (const node of Array.from(trk.childNodes)) {
        if (node.nodeType !== 1) continue; // solo elementos
        if (node.localName === 'when') {
          // guarda el tiempo a la espera de su coord siguiente
          const ts = Date.parse(node.textContent.trim());
          pendingWhen = Number.isFinite(ts) ? ts : null;
        } else if (node.namespaceURI === NS_GX && node.localName === 'coord') {
          const parts = node.textContent.trim().split(/\s+/).map(Number);
          const lon = parts[0], lat = parts[1], alt = Number.isFinite(parts[2]) ? parts[2] : 0;
          if (pendingWhen != null && Number.isFinite(lat) && Number.isFinite(lon)) {
            rows.push({ ts: pendingWhen, lat, lon, alt });
          }
          pendingWhen = null; // resetea esperando el próximo when
        }
      }
    }

    if (!rows.length) continue;

    // Ordena y dedup por ts
    rows.sort((a, b) => a.ts - b.ts);
    const dedup = [];
    let lastTs = -1;
    for (const r of rows) {
      if (r.ts !== lastTs) { dedup.push(r); lastTs = r.ts; }
    }

    // Deriva speed/course por diferencias
    for (let i = 1; i < dedup.length; i++) {
      const a = dedup[i - 1], b = dedup[i];
      const dt = (b.ts - a.ts) / 1000;
      if (dt <= 0) continue;
      const dKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
      b.speed = (dKm / (dt / 3600)); // km/h
      b.course = bearingDeg(a.lat, a.lon, b.lat, b.lon);
    }
    if (!Number.isFinite(dedup[0].speed) && dedup[1]?.speed) dedup[0].speed = dedup[1].speed;
    if (!Number.isFinite(dedup[0].course) && dedup[1]?.course) dedup[0].course = dedup[1].course;

    tracksById[name] = dedup;
    globalMin = Math.min(globalMin, dedup[0].ts);
    globalMax = Math.max(globalMax, dedup[dedup.length - 1].ts);
  }

  if (!isFinite(globalMin) || !isFinite(globalMax)) {
    return { tracksById: {}, t0: 0, tEnd: 0 };
  }
  return { tracksById, t0: globalMin, tEnd: globalMax };
}
