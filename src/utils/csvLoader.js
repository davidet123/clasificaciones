// /src/utils/csvLoader.js
// Carga texto remoto detectando codificación de forma fiable.
// Regla: PRIORIDAD UTF-8 ESTRICTO. Si falla, caer a Windows-1252.
// Ignoramos el charset del header porque demasiadas veces miente.

export async function fetchTextSmart(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error HTTP ${res.status} al descargar ${url}`);

  const ab = await res.arrayBuffer();

  // 1) Intentar UTF-8 en modo "fatal" para detectar cualquier byte inválido.
  try {
    const utf8Strict = new TextDecoder('utf-8', { fatal: true }).decode(ab);
    // Si llegó aquí, los bytes son UTF-8 válido. Devuelve esto y no mires atrás.
    return utf8Strict;
  } catch {
    // no es UTF-8 puro; seguimos
  }

  // 2) Caer a Windows-1252 (cubre ñ/acentos típicos en España)
  try {
    const cp1252 = new TextDecoder('windows-1252', { fatal: false }).decode(ab);
    return cp1252;
  } catch {
    // Último cartucho: latin-1
    return new TextDecoder('iso-8859-1', { fatal: false }).decode(ab);
  }
}
