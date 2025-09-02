// src/services/vmixService.js
export class VmixService {
  constructor({ baseUrl = 'http://localhost:8088/api', enabled = false } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.enabled = !!enabled;
  }

  setEnabled(on) { this.enabled = !!on; }
  setBaseUrl(url) { this.baseUrl = url.replace(/\/+$/, ''); }

  async _call(query) {
    if (!this.enabled) {
      console.info('[vMix SIM]', query);
      return { ok: true, simulated: true };
    }
    const url = `${this.baseUrl}?${query}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`vMix HTTP ${res.status}`);
    return { ok: true };
  }

  // ---- Operaciones típicas ----
  updateTitleField({ input, field, value }) {
    // vMix: SetText / SetTitle
    // Variante común: Function=SetText&Input=MyTitle&SelectedName=Field1&Value=Hello
    const q = new URLSearchParams({
      Function: 'SetText',
      Input: String(input),
      SelectedName: String(field),
      Value: String(value ?? ''),
    }).toString();
    return this._call(q);
  }

  setPreview({ input }) {
    const q = new URLSearchParams({ Function: 'PreviewInput', Input: String(input) }).toString();
    return this._call(q);
  }

  cutToProgram({ input }) {
    const q = new URLSearchParams({ Function: 'CutDirect', Input: String(input) }).toString();
    return this._call(q);
  }

  // Overlay 1..4
  showOverlay({ overlay, input }) {
    const q = new URLSearchParams({ Function: `OverlayInput${overlay}`, Input: String(input) }).toString();
    return this._call(q);
  }
  hideOverlay({ overlay }) {
    const q = new URLSearchParams({ Function: `OverlayInput${overlay}Off` }).toString();
    return this._call(q);
  }

  // Estado (opcional): XML/JSON. Aquí dejamos un ping simple.
  async ping() {
    if (!this.enabled) return { ok: true, simulated: true };
    const url = `${this.baseUrl}`;
    const res = await fetch(url);
    return { ok: res.ok };
  }
}
