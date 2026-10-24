// love.audio on WebAudio. 'static' sources are decoded buffers; 'stream'
// sources (music, ambience) are media elements, so the long tracks aren't
// decoded into memory. setPitch changes speed and pitch together, as in LÖVE.

export interface Source {
  play(): void;
  stop(): void;
  isPlaying(): boolean;
  setVolume(v: number): void;
  setPitch(p: number): void;
  release(): void;
}

export class Audio {
  ctx: AudioContext;
  master: GainNode;
  private buffers = new Map<string, AudioBuffer | Promise<AudioBuffer | null>>();
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
  }

  /** browsers start audio only after a user gesture */
  resume() {
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  url(code: string) { return `${this.baseUrl}/${code}.ogg`; }

  preload(code: string): Promise<AudioBuffer | null> {
    const have = this.buffers.get(code);
    if (have) return Promise.resolve(have);
    const p = fetch(this.url(code))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then((b) => this.ctx.decodeAudioData(b))
      .then((buf) => { this.buffers.set(code, buf); return buf; })
      .catch(() => null);
    this.buffers.set(code, p);
    return p;
  }

  newSource(code: string, type: 'static' | 'stream'): Source {
    return type === 'stream' ? new StreamSource(this, code) : new StaticSource(this, code);
  }
}

class StaticSource implements Source {
  private a: Audio;
  private code: string;
  private node: AudioBufferSourceNode | null = null;
  private gain: GainNode;
  private playing = false;
  private pitch = 1;
  private pending = false;

  constructor(a: Audio, code: string) {
    this.a = a;
    this.code = code;
    this.gain = a.ctx.createGain();
    this.gain.connect(a.master);
  }

  play() {
    this.stop();
    this.playing = true;
    const buf = (this.a as any).buffers.get(this.code);
    const start = (b: AudioBuffer | null) => {
      if (!b || !this.playing) { this.playing = false; return; }
      const n = this.a.ctx.createBufferSource();
      n.buffer = b;
      n.playbackRate.value = this.pitch;
      n.connect(this.gain);
      n.onended = () => { if (this.node === n) { this.playing = false; this.node = null; } };
      this.node = n;
      n.start();
    };
    if (buf instanceof AudioBuffer) start(buf);
    else {
      this.pending = true;
      this.a.preload(this.code).then((b) => { if (this.pending) { this.pending = false; start(b); } });
    }
  }

  stop() {
    this.pending = false;
    if (this.node) {
      try { this.node.stop(); } catch { /* not started */ }
      this.node.disconnect();
      this.node = null;
    }
    this.playing = false;
  }

  isPlaying() { return this.playing; }
  setVolume(v: number) { this.gain.gain.value = Math.max(0, v); }
  setPitch(p: number) {
    this.pitch = p;
    if (this.node) this.node.playbackRate.value = p;
  }
  release() { this.stop(); this.gain.disconnect(); }
}

class StreamSource implements Source {
  private el: HTMLAudioElement;
  private gain: GainNode;
  private node: MediaElementAudioSourceNode;
  private playing = false;

  constructor(a: Audio, code: string) {
    this.el = new window.Audio(a.url(code));
    this.el.preload = 'auto';
    (this.el as any).preservesPitch = false;
    (this.el as any).mozPreservesPitch = false;
    this.el.crossOrigin = 'anonymous';
    this.node = a.ctx.createMediaElementSource(this.el);
    this.gain = a.ctx.createGain();
    this.node.connect(this.gain);
    this.gain.connect(a.master);
    this.el.addEventListener('ended', () => { this.playing = false; });
  }

  play() {
    this.playing = true;
    this.el.currentTime = 0;
    this.el.play().catch(() => { this.playing = false; });
  }
  stop() { this.playing = false; this.el.pause(); }
  isPlaying() { return this.playing; }
  setVolume(v: number) { this.gain.gain.value = Math.max(0, v); }
  setPitch(p: number) {
    const r = Math.min(16, Math.max(0.0625, p));
    if (Math.abs(this.el.playbackRate - r) > 1e-4) this.el.playbackRate = r;
  }
  release() { this.stop(); this.node.disconnect(); this.gain.disconnect(); this.el.src = ''; }
}
