// A WebGL2 implementation of the part of LÖVE 11's love.graphics that Balatro
// uses: a transform stack, colours, filled/outlined polygons and rectangles,
// images and quads, text, canvases and the game's own GLSL shaders.
//
// As in LÖVE 11, vertices are transformed on the CPU into the pixel space of
// the current render target, so a shader's `vertex_position` is in pixels and
// `transform_projection` is only the projection.
import { Shader } from './shader';
import type { Font, Text } from './font';

export type Colour = number[];

const FLOATS_PER_VERTEX = 8; // x, y, u, v, r, g, b, a
const MAX_VERTICES = 65536;

export class Texture {
  tex: WebGLTexture;
  /** size in pixels */
  pixelWidth: number;
  pixelHeight: number;
  /** size in LÖVE units (pixels / dpiscale) */
  width: number;
  height: number;
  dpiscale: number;
  constructor(tex: WebGLTexture, pw: number, ph: number, dpiscale = 1) {
    this.tex = tex;
    this.pixelWidth = pw;
    this.pixelHeight = ph;
    this.dpiscale = dpiscale;
    this.width = pw / dpiscale;
    this.height = ph / dpiscale;
  }
  getDimensions(): [number, number] { return [this.width, this.height]; }
  getWidth() { return this.width; }
  getHeight() { return this.height; }
  getPixelHeight() { return this.pixelHeight; }
  getPixelWidth() { return this.pixelWidth; }
}

export class Image extends Texture {
  readonly kind = 'image';
}

export class Canvas extends Texture {
  readonly kind = 'canvas';
  fbo: WebGLFramebuffer;
  constructor(tex: WebGLTexture, fbo: WebGLFramebuffer, w: number, h: number) {
    super(tex, w, h, 1);
    this.fbo = fbo;
  }
}

export class Quad {
  x: number; y: number; w: number; h: number; sw: number; sh: number;
  constructor(x: number, y: number, w: number, h: number, sw: number, sh: number) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.sw = sw; this.sh = sh;
  }
  setViewport(x: number, y: number, w: number, h: number) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }
}

type Matrix = [number, number, number, number, number, number]; // a b c d e f : X = a x + c y + e, Y = b x + d y + f

export class Graphics {
  gl: WebGL2RenderingContext;
  domCanvas: HTMLCanvasElement;

  private m: Matrix = [1, 0, 0, 1, 0, 0];
  private stack: Matrix[] = [];
  private colour: Colour = [1, 1, 1, 1];
  private lineWidth = 1;
  private shader: Shader | null = null;
  private target: Canvas | null = null;

  private defaultShader!: Shader;
  private whiteTex!: Texture;

  private vbo: WebGLBuffer;
  private vao: WebGLVertexArrayObject;
  private data = new Float32Array(MAX_VERTICES * FLOATS_PER_VERTEX);
  private count = 0;
  private batchTex: Texture | null = null;
  private batchShader: Shader | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.domCanvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS_PER_VERTEX * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);

    gl.enable(gl.BLEND);
    // LÖVE's "alpha" blend mode with "alphamultiply"
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.whiteTex = new Texture(t, 1, 1);
    this.defaultShader = new Shader(this, null);
  }

  // ---------------------------------------------------------------- window
  getWidth() { return this.domCanvas.width; }
  getHeight() { return this.domCanvas.height; }
  getDimensions(): [number, number] { return [this.getWidth(), this.getHeight()]; }

  /** width/height of the current render target in pixels */
  targetSize(): [number, number] {
    return this.target ? [this.target.pixelWidth, this.target.pixelHeight] : [this.getWidth(), this.getHeight()];
  }

  // ------------------------------------------------------------- transform
  push() { this.stack.push([...this.m] as Matrix); }
  pop() { const m = this.stack.pop(); if (m) this.m = m; }
  origin() { this.m = [1, 0, 0, 1, 0, 0]; }
  translate(x: number, y: number) {
    const m = this.m;
    m[4] += m[0] * x + m[2] * y;
    m[5] += m[1] * x + m[3] * y;
  }
  rotate(r: number) {
    const m = this.m, c = Math.cos(r), s = Math.sin(r);
    const a = m[0], b = m[1], cc = m[2], d = m[3];
    m[0] = a * c + cc * s; m[1] = b * c + d * s;
    m[2] = -a * s + cc * c; m[3] = -b * s + d * c;
  }
  scale(sx: number, sy?: number) {
    if (sy === undefined) sy = sx;
    const m = this.m;
    m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy;
  }

  // ---------------------------------------------------------------- state
  setColor(r: number | Colour, g?: number, b?: number, a?: number) {
    if (Array.isArray(r)) {
      this.colour = [r[0] ?? 1, r[1] ?? 1, r[2] ?? 1, r[3] ?? 1];
    } else {
      this.colour = [r, g ?? 1, b ?? 1, a ?? 1];
    }
  }
  getColor(): Colour { return [...this.colour]; }
  setLineWidth(w: number) { this.lineWidth = w; }
  setLineStyle(_s: string) { /* always 'rough' */ }
  setDefaultFilter(_min: string, _mag: string) { /* textures are linear */ }

  setShader(s?: Shader | null) {
    this.shader = s ?? null;
  }
  getShader() { return this.shader; }

  setCanvas(c?: Canvas | null | { 0: Canvas }) {
    let canvas: Canvas | null = null;
    if (c && (c as any).kind === 'canvas') canvas = c as Canvas;
    else if (c && (c as any)[0]) canvas = (c as any)[0];
    if (canvas === this.target) return;
    this.flush();
    this.target = canvas;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, canvas ? canvas.fbo : null);
    const [w, h] = this.targetSize();
    gl.viewport(0, 0, w, h);
  }

  clear(r: number | Colour = 0, g = 0, b = 0, a = 1) {
    this.flush();
    const gl = this.gl;
    if (Array.isArray(r)) gl.clearColor(r[0], r[1], r[2], r[3] ?? 1);
    else gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // ------------------------------------------------------------- resources
  newCanvas(w: number, h: number): Canvas {
    const gl = this.gl;
    w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target ? this.target.fbo : null);
    return new Canvas(tex, fbo, w, h);
  }

  releaseCanvas(c: Canvas) {
    if (!c) return;
    if (this.target === c) this.setCanvas(null);
    this.gl.deleteFramebuffer(c.fbo);
    this.gl.deleteTexture(c.tex);
  }

  /** an image from a decoded bitmap; `mipmaps` as LÖVE's newImage flag */
  newImageFromSource(src: TexImageSource, w: number, h: number, opts: { mipmaps?: boolean; dpiscale?: number; nearest?: boolean } = {}): Image {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const filt = opts.nearest ? gl.NEAREST : gl.LINEAR;
    if (opts.mipmaps) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.nearest ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    return new Image(tex, w, h, opts.dpiscale ?? 1);
  }

  newQuad(x: number, y: number, w: number, h: number, sw: number, sh: number) {
    return new Quad(x, y, w, h, sw, sh);
  }

  newShader(source: string) {
    return new Shader(this, source);
  }

  // ------------------------------------------------------------- batching
  /** flushes the batch if `s` is the shader the pending vertices use */
  flushIfUsing(s: Shader) {
    if (this.count > 0 && (this.batchShader === s || (s === this.defaultShader && this.batchShader === null))) this.flush();
  }

  flush() {
    if (this.count === 0) return;
    const gl = this.gl;
    const shader = this.batchShader ?? this.defaultShader;
    const [w, h] = this.targetSize();
    shader.bind(w, h, this.target !== null, this.batchTex ?? this.whiteTex);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * FLOATS_PER_VERTEX);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
    this.count = 0;
  }

  private begin(tex: Texture | null, nverts: number) {
    const t = tex ?? this.whiteTex;
    if (this.count > 0 && (this.batchTex !== t || this.batchShader !== this.shader || this.count + nverts > MAX_VERTICES)) {
      this.flush();
    }
    this.batchTex = t;
    this.batchShader = this.shader;
  }

  private vtx(x: number, y: number, u: number, v: number, c: Colour) {
    const m = this.m, d = this.data;
    let i = this.count * FLOATS_PER_VERTEX;
    d[i++] = m[0] * x + m[2] * y + m[4];
    d[i++] = m[1] * x + m[3] * y + m[5];
    d[i++] = u; d[i++] = v;
    d[i++] = c[0]; d[i++] = c[1]; d[i++] = c[2]; d[i++] = c[3];
    this.count++;
  }

  // ------------------------------------------------------------- drawing
  rectangle(mode: 'fill' | 'line', x: number, y: number, w: number, h: number) {
    if (mode === 'fill') {
      this.begin(null, 6);
      const c = this.colour;
      this.vtx(x, y, 0, 0, c); this.vtx(x, y + h, 0, 0, c); this.vtx(x + w, y, 0, 0, c);
      this.vtx(x + w, y, 0, 0, c); this.vtx(x, y + h, 0, 0, c); this.vtx(x + w, y + h, 0, 0, c);
    } else {
      this.polyline([x, y, x + w, y, x + w, y + h, x, y + h, x, y]);
    }
  }

  /** LÖVE draws filled polygons as a triangle fan from the first vertex */
  polygon(mode: 'fill' | 'line', ...args: any[]) {
    const v: number[] = Array.isArray(args[0]) ? args[0] : args;
    const n = Math.floor(v.length / 2);
    if (n < 3) return;
    if (mode === 'fill') {
      this.begin(null, (n - 2) * 3);
      const c = this.colour;
      for (let i = 1; i < n - 1; i++) {
        this.vtx(v[0], v[1], 0, 0, c);
        this.vtx(v[i * 2], v[i * 2 + 1], 0, 0, c);
        this.vtx(v[i * 2 + 2], v[i * 2 + 3], 0, 0, c);
      }
    } else {
      const closed = v.slice(0, n * 2);
      closed.push(v[0], v[1]);
      this.polyline(closed);
    }
  }

  line(...args: any[]) {
    const v: number[] = Array.isArray(args[0]) ? args[0] : args;
    this.polyline(v);
  }

  /** LÖVE 11's miter-join polyline, 'rough' style */
  private polyline(coords: number[]) {
    const count = Math.floor(coords.length / 2);
    if (count < 2) return;
    const hw = this.lineWidth * 0.5;
    const P = (i: number) => [coords[i * 2], coords[i * 2 + 1]];
    const anchors: number[][] = [];
    const normals: number[][] = [];
    const first = P(0), last = P(count - 1);
    const looping = first[0] === last[0] && first[1] === last[1];
    let s: number[];
    if (!looping) s = [P(1)[0] - first[0], P(1)[1] - first[1]];
    else { const p = P(count - 2); s = [first[0] - p[0], first[1] - p[1]]; }
    let len_s = Math.hypot(s[0], s[1]);
    const normal = (vx: number, vy: number, sc: number) => [-vy * sc, vx * sc];
    let ns = normal(s[0], s[1], hw / len_s);

    const renderEdge = (q: number[], r: number[]) => {
      const t = [r[0] - q[0], r[1] - q[1]];
      const len_t = Math.hypot(t[0], t[1]);
      const nt = normal(t[0], t[1], hw / len_t);
      anchors.push(q, q);
      const det = s[0] * t[1] - s[1] * t[0];
      if (Math.abs(det) / (len_s * len_t) < 0.05 && s[0] * t[0] + s[1] * t[1] > 0) {
        normals.push(ns, [-ns[0], -ns[1]]);
      } else {
        const dx = nt[0] - ns[0], dy = nt[1] - ns[1];
        const lambda = (dx * t[1] - dy * t[0]) / det;
        const d = [ns[0] + s[0] * lambda, ns[1] + s[1] * lambda];
        normals.push(d, [-d[0], -d[1]]);
      }
      s = t; ns = nt; len_s = len_t;
    };

    let q: number[], r = first;
    for (let i = 0; i + 1 < count; i++) {
      q = r; r = P(i + 1);
      renderEdge(q, r);
    }
    q = r;
    r = looping ? P(1) : [r[0] + s[0], r[1] + s[1]];
    renderEdge(q, r);

    const verts = anchors.map((a, i) => [a[0] + normals[i][0], a[1] + normals[i][1]]);
    // triangle strip -> triangles
    const nt = verts.length - 2;
    if (nt <= 0) return;
    this.begin(null, nt * 3);
    const c = this.colour;
    for (let i = 0; i < nt; i++) {
      const a = verts[i], b = verts[i + 1], d = verts[i + 2];
      if (![a, b, d].every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))) continue;
      this.vtx(a[0], a[1], 0, 0, c); this.vtx(b[0], b[1], 0, 0, c); this.vtx(d[0], d[1], 0, 0, c);
    }
  }

  /**
   * love.graphics.draw(drawable, [quad], x, y, r, sx, sy, ox, oy)
   */
  draw(drawable: Texture | Text, ...args: any[]) {
    let quad: Quad | null = null;
    if (args[0] instanceof Quad) quad = args.shift();
    const [x = 0, y = 0, r = 0, sx = 1, syArg, ox = 0, oy = 0] = args;
    const sy = syArg ?? sx;

    this.push();
    this.translate(x, y);
    if (r) this.rotate(r);
    this.scale(sx, sy);
    this.translate(-ox, -oy);

    if ((drawable as Text).isText) {
      (drawable as Text).emit(this);
    } else {
      const tex = drawable as Texture;
      let qx = 0, qy = 0, qw = tex.width, qh = tex.height, sw = tex.width, sh = tex.height;
      if (quad) { qx = quad.x; qy = quad.y; qw = quad.w; qh = quad.h; sw = quad.sw; sh = quad.sh; }
      const u0 = qx / sw, v0 = qy / sh, u1 = (qx + qw) / sw, v1 = (qy + qh) / sh;
      this.begin(tex, 6);
      const c = this.colour;
      this.vtx(0, 0, u0, v0, c); this.vtx(0, qh, u0, v1, c); this.vtx(qw, 0, u1, v0, c);
      this.vtx(qw, 0, u1, v0, c); this.vtx(0, qh, u0, v1, c); this.vtx(qw, qh, u1, v1, c);
    }
    this.pop();
  }

  /** used by Text: a textured quad in the current transform, in vertex colour * current colour */
  glyphQuad(tex: Texture, x0: number, y0: number, x1: number, y1: number, u0: number, v0: number, u1: number, v1: number, col: Colour) {
    this.begin(tex, 6);
    const k = this.colour;
    const c = [col[0] * k[0], col[1] * k[1], col[2] * k[2], col[3] * k[3]];
    this.vtx(x0, y0, u0, v0, c); this.vtx(x0, y1, u0, v1, c); this.vtx(x1, y0, u1, v0, c);
    this.vtx(x1, y0, u1, v0, c); this.vtx(x0, y1, u0, v1, c); this.vtx(x1, y1, u1, v1, c);
  }

  present() { this.flush(); }

  newText(font: Font, text: any) {
    return font.newText(text);
  }
}
