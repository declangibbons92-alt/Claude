/*
 * Finger-friendly signature pad.
 * - Pointer Events (works with finger, Apple Pencil and mouse)
 * - Strokes are stored as points, so the drawing survives rotation/resizes
 * - Smooth quadratic curves with light pressure/velocity-based width
 * - export() returns a tightly cropped, transparent PNG + its aspect ratio
 */
export class SignaturePad {
  constructor(canvas, { color = "#0b0b0b", minWidth = 1.6, maxWidth = 4.2 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.color = color;
    this.minWidth = minWidth;
    this.maxWidth = maxWidth;
    this.strokes = [];
    this.current = null;
    this.onChange = () => {};

    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up = this._up.bind(this);
    canvas.addEventListener("pointerdown", this._down);
    canvas.addEventListener("pointermove", this._move);
    canvas.addEventListener("pointerup", this._up);
    canvas.addEventListener("pointercancel", this._up);
    canvas.addEventListener("pointerleave", this._up);
    // Belt and braces: stop iOS from scrolling / zooming while signing.
    const block = (e) => e.preventDefault();
    canvas.addEventListener("touchstart", block, { passive: false });
    canvas.addEventListener("touchmove", block, { passive: false });

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas);
    this.resize();
  }

  isEmpty() {
    // A couple of stray taps is not a signature.
    return this.strokes.reduce((n, s) => n + s.length, 0) < 3;
  }

  clear() {
    this.strokes = [];
    this.current = null;
    this.redraw();
    this.onChange();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssW = r.width;
    this.cssH = r.height;
    this.redraw();
  }

  // Points are stored normalised (0..1) so a rotate keeps the drawing in place.
  _pt(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      p: e.pressure && e.pointerType === "pen" ? e.pressure : 0.5,
      t: e.timeStamp,
    };
  }

  _down(e) {
    if (e.button !== undefined && e.button > 0) return;
    e.preventDefault();
    this.canvas.setPointerCapture?.(e.pointerId);
    this.current = [this._pt(e)];
    this.strokes.push(this.current);
    this._dot(this.current[0]);
  }

  _move(e) {
    if (!this.current) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const pt = this._pt(ev);
      const last = this.current[this.current.length - 1];
      const dx = (pt.x - last.x) * this.cssW;
      const dy = (pt.y - last.y) * this.cssH;
      if (dx * dx + dy * dy < 1.5) continue; // ignore jitter
      this.current.push(pt);
      this._segment(this.current, this.current.length - 1);
    }
  }

  _up() {
    if (!this.current) return;
    this.current = null;
    this.onChange();
  }

  _width(a, b) {
    const dist = Math.hypot((b.x - a.x) * this.cssW, (b.y - a.y) * this.cssH);
    const dt = Math.max(b.t - a.t, 1);
    const v = dist / dt; // px per ms
    const w = this.maxWidth - Math.min(v, 2.5) * ((this.maxWidth - this.minWidth) / 2.5);
    return Math.max(this.minWidth, w * (0.6 + b.p * 0.8));
  }

  _dot(p) {
    const c = this.ctx;
    c.fillStyle = this.color;
    c.beginPath();
    c.arc(p.x * this.cssW, p.y * this.cssH, (this.minWidth + this.maxWidth) / 4, 0, Math.PI * 2);
    c.fill();
  }

  // Draw the segment ending at index i using a midpoint quadratic curve.
  _segment(s, i) {
    if (i < 1) return;
    const c = this.ctx;
    const W = this.cssW, H = this.cssH;
    const p0 = s[i - 2] || s[i - 1];
    const p1 = s[i - 1];
    const p2 = s[i];
    const m1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const m2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    p2.w = p2.w ?? (p1.w ? p1.w * 0.6 + this._width(p1, p2) * 0.4 : this._width(p1, p2));
    c.strokeStyle = this.color;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.lineWidth = p2.w;
    c.beginPath();
    c.moveTo(m1.x * W, m1.y * H);
    c.quadraticCurveTo(p1.x * W, p1.y * H, m2.x * W, m2.y * H);
    c.stroke();
  }

  redraw() {
    const c = this.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.restore();
    for (const s of this.strokes) {
      if (s.length === 1) this._dot(s[0]);
      for (let i = 1; i < s.length; i++) this._segment(s, i);
    }
  }

  /**
   * Returns { dataUrl, width, height } — a transparent PNG cropped to the ink
   * with a small margin, rendered at high resolution for print-quality PDFs.
   */
  export() {
    if (this.isEmpty()) return null;
    const W = this.cssW, H = this.cssH;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of this.strokes) for (const p of s) {
      minX = Math.min(minX, p.x * W); maxX = Math.max(maxX, p.x * W);
      minY = Math.min(minY, p.y * H); maxY = Math.max(maxY, p.y * H);
    }
    const pad = this.maxWidth * 2 + 4;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const w = maxX - minX, h = maxY - minY;
    const scale = Math.min(4, 1600 / Math.max(w, h)); // crisp but bounded size
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(w * scale));
    out.height = Math.max(1, Math.round(h * scale));
    const oc = out.getContext("2d");
    oc.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);

    // Re-render strokes onto the export canvas using the same algorithm.
    const ghost = Object.create(this);
    ghost.ctx = oc;
    for (const s of this.strokes) {
      if (s.length === 1) ghost._dot(s[0]);
      for (let i = 1; i < s.length; i++) ghost._segment(s, i);
    }
    return { dataUrl: out.toDataURL("image/png"), width: out.width, height: out.height };
  }

  destroy() {
    this._ro.disconnect();
  }
}
