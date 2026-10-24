// LÖVE 11 shaders on WebGL2: the game's .fs files (LÖVE GLSL, with an
// `effect` pixel function and optionally a `position` vertex function) are
// wrapped the way LÖVE wraps them and compiled as GLSL ES 3.00.
import type { Graphics, Texture } from './graphics';

const HEADER = (stage: 'VERTEX' | 'PIXEL') => `#version 300 es
#define ${stage}
precision highp float;
precision highp int;
#define number float
#define Image sampler2D
#define extern uniform
#define Texel texture
uniform vec4 love_ScreenSize;
`;

const DEFAULT_POSITION = `vec4 position(mat4 transform_projection, vec4 vertex_position) { return transform_projection * vertex_position; }\n`;
const DEFAULT_EFFECT = `vec4 effect(vec4 vcolor, Image tex, vec2 texcoord, vec2 pixcoord) { return Texel(tex, texcoord) * vcolor; }\n`;

/** `texture` is a builtin function in GLSL 3; LÖVE code uses it as a variable name */
function fixIdentifiers(code: string) {
  return code.replace(/\btexture\b(?!\s*\()/g, 'love_tex_param');
}

function buildSources(code: string | null): [string, string] {
  const user = code ? fixIdentifiers(code) : '';
  const hasPosition = /\bvec4\s+position\s*\(/.test(user);
  const hasEffect = /\bvec4\s+effect\s*\(/.test(user);

  const vs = HEADER('VERTEX') + `
uniform mat4 TransformProjectionMatrix;
in vec4 VertexPosition;
in vec4 VertexTexCoord;
in vec4 VertexColor;
out vec4 VaryingTexCoord;
out vec4 VaryingColor;
${hasPosition ? user : DEFAULT_POSITION}
void main() {
  VaryingTexCoord = VertexTexCoord;
  VaryingColor = VertexColor;
  gl_Position = position(TransformProjectionMatrix, VertexPosition);
}
`;
  const fs = HEADER('PIXEL') + `
uniform sampler2D MainTex;
in vec4 VaryingTexCoord;
in vec4 VaryingColor;
out vec4 love_PixelColor;
${hasEffect ? user : DEFAULT_EFFECT}
void main() {
  vec2 pc = vec2(gl_FragCoord.x, gl_FragCoord.y * love_ScreenSize.z + love_ScreenSize.w);
  love_PixelColor = effect(VaryingColor, MainTex, VaryingTexCoord.st, pc);
}
`;
  return [vs, fs];
}

function compile(gl: WebGL2RenderingContext, type: number, src: string, name: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    console.error(src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
    throw new Error(`shader ${name} (${type === gl.VERTEX_SHADER ? 'vertex' : 'pixel'}): ${log}`);
  }
  return s;
}

interface UniformInfo { loc: WebGLUniformLocation; type: number; size: number }

export class Shader {
  g: Graphics;
  program: WebGLProgram;
  uniforms = new Map<string, UniformInfo>();
  name: string;
  private locProj: WebGLUniformLocation | null;
  private locScreen: WebGLUniformLocation | null;
  private locTex: WebGLUniformLocation | null;

  constructor(g: Graphics, code: string | null, name = 'default') {
    this.g = g;
    this.name = name;
    const gl = g.gl;
    const [vsrc, fsrc] = buildSources(code);
    const vs = compile(gl, gl.VERTEX_SHADER, vsrc, name);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsrc, name);
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'VertexPosition');
    gl.bindAttribLocation(p, 1, 'VertexTexCoord');
    gl.bindAttribLocation(p, 2, 'VertexColor');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`shader ${name} link: ${gl.getProgramInfoLog(p)}`);
    }
    this.program = p;
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i)!;
      const uname = info.name.replace(/\[0\]$/, '');
      this.uniforms.set(uname, { loc: gl.getUniformLocation(p, info.name)!, type: info.type, size: info.size });
    }
    this.locProj = gl.getUniformLocation(p, 'TransformProjectionMatrix');
    this.locScreen = gl.getUniformLocation(p, 'love_ScreenSize');
    this.locTex = gl.getUniformLocation(p, 'MainTex');
  }

  hasUniform(name: string) { return this.uniforms.has(name); }

  /** Shader:send(name, value): numbers, booleans, or tables of numbers */
  send(name: string, value: any) {
    const u = this.uniforms.get(name);
    if (!u) return;
    this.g.flushIfUsing(this);
    const gl = this.g.gl;
    gl.useProgram(this.program);
    const v = value;
    switch (u.type) {
      case gl.FLOAT: gl.uniform1f(u.loc, num(v)); break;
      case gl.FLOAT_VEC2: gl.uniform2f(u.loc, num(v?.[0] ?? v?.x), num(v?.[1] ?? v?.y)); break;
      case gl.FLOAT_VEC3: gl.uniform3f(u.loc, num(v?.[0]), num(v?.[1]), num(v?.[2])); break;
      case gl.FLOAT_VEC4: gl.uniform4f(u.loc, num(v?.[0]), num(v?.[1]), num(v?.[2]), num(v?.[3] ?? 1)); break;
      case gl.BOOL: gl.uniform1i(u.loc, v ? 1 : 0); break;
      case gl.INT: gl.uniform1i(u.loc, Math.trunc(num(v))); break;
      default: break;
    }
  }

  /** set up the program for drawing to a target of w x h pixels */
  bind(w: number, h: number, toCanvas: boolean, tex: Texture) {
    const gl = this.g.gl;
    gl.useProgram(this.program);
    const sy = toCanvas ? 2 / h : -2 / h;
    const ty = toCanvas ? -1 : 1;
    if (this.locProj) {
      gl.uniformMatrix4fv(this.locProj, false, new Float32Array([
        2 / w, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, 1, 0,
        -1, ty, 0, 1,
      ]));
    }
    if (this.locScreen) gl.uniform4f(this.locScreen, w, h, toCanvas ? 1 : -1, toCanvas ? 0 : h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex.tex);
    if (this.locTex) gl.uniform1i(this.locTex, 0);
  }
}

function num(v: any): number {
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
