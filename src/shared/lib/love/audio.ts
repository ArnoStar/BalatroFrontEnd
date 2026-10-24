// love.audio on WebAudio. Every source plays a decoded buffer on the audio
// thread: the effects ('static') and the long tracks ('stream': music,
// ambience) alike. (The tracks used to be media elements; some browsers
// silenced those while the page was rendering, but never the effects.)
// setPitch changes speed and pitch together, as in LÖVE.

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
    // the game's sounds are 44.1 kHz: decoded at that rate they aren't resampled
    // (and the music's buffers are smaller than at the device's 48 kHz)
    try {
      this.ctx = new AudioContext({ sampleRate: 44100 });
    } catch {
      this.ctx = new AudioContext();
    }
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
  }

  /** browsers start audio only after a user gesture */
  resume() {
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  url(code: string) { return `${this.baseUrl}/${code}.ogg`; }

  /** the decoded sound, if it is ready */
  ready(code: string): AudioBuffer | null {
    const b = this.buffers.get(code);
    return b instanceof AudioBuffer ? b : null;
  }

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
    const buf = this.a.ready(this.code);
    if (buf) start(buf);
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

/**
 * A long track (LÖVE streams it from its file). Its buffer is decoded once
 * and shared. The track keeps its own clock from play(): if the buffer is
 * still decoding then, it starts where it would be by the time it's ready,
 * so tracks started together (the five music tracks) stay in step.
 */
class StreamSource implements Source {
  private a: Audio;
  private code: string;
  private node: AudioBufferSourceNode | null = null;
  private gain: GainNode;
  private playing = false;
  private pitch = 1;
  /** the position in the track (s) at the context time `at` */
  private pos = 0;
  private at = 0;

  constructor(a: Audio, code: string) {
    this.a = a;
    this.code = code;
    this.gain = a.ctx.createGain();
    this.gain.connect(a.master);
    a.preload(code);
  }

  private position() {
    return this.pos + (this.a.ctx.currentTime - this.at) * this.pitch;
  }

  play() {
    this.stop();
    this.playing = true;
    this.pos = 0;
    this.at = this.a.ctx.currentTime;
    const start = (b: AudioBuffer | null) => {
      if (!this.playing || this.node) return;
      const offset = this.position();
      if (!b || offset >= b.duration) { this.playing = false; return; }
      const n = this.a.ctx.createBufferSource();
      n.buffer = b;
      n.playbackRate.value = this.pitch;
      n.connect(this.gain);
      n.onended = () => { if (this.node === n) { this.playing = false; this.node = null; } };
      this.node = n;
      n.start(0, offset);
    };
    const buf = this.a.ready(this.code);
    if (buf) start(buf);
    else this.a.preload(this.code).then(start);
  }

  stop() {
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
    if (p === this.pitch) return;
    this.pos = this.position();
    this.at = this.a.ctx.currentTime;
    this.pitch = p;
    if (this.node) this.node.playbackRate.value = p;
  }
  release() { this.stop(); this.gain.disconnect(); }
}
