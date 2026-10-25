// 楽器・伴奏は Web Audio で合成する。掛け声だけは VOICEVOX で生成した音声を再生する。
import { FEVER_COMBO, type PadId } from "./rhythm";
import type { Song } from "./songs";
import {
	CREW_ROLES,
	type VoiceKind,
	type VoiceManifest,
	voiceKey,
} from "./voiceLines";

export class Synth {
	readonly ctx: AudioContext;
	private readonly out: GainNode;
	private readonly noise: AudioBuffer;
	/** 子分の合唱をまとめるバス。人数ぶん重ねても割れないよう専用のコンプレッサーを通す */
	private readonly crewBus: GainNode;
	/** 録音済みの掛け声。読み込めなかったものはフォルマント合成で代用する */
	private readonly voices = new Map<
		string,
		{ buf: AudioBuffer; lead: number }
	>();

	constructor() {
		this.ctx = new AudioContext({ latencyHint: "interactive" });
		// 最終段のリミッター。声・キメ・伴奏が同時に鳴っても 1.0 を超えて割れないようにする
		const limiter = this.ctx.createDynamicsCompressor();
		limiter.threshold.value = -4;
		limiter.knee.value = 0;
		limiter.ratio.value = 20;
		limiter.attack.value = 0.001;
		limiter.release.value = 0.1;
		limiter.connect(this.ctx.destination);
		const comp = this.ctx.createDynamicsCompressor();
		comp.threshold.value = -14;
		comp.ratio.value = 4;
		comp.connect(limiter);
		this.out = this.ctx.createGain();
		this.out.gain.value = 0.6;
		this.out.connect(comp);

		const crewComp = this.ctx.createDynamicsCompressor();
		crewComp.threshold.value = -18;
		crewComp.knee.value = 6;
		crewComp.ratio.value = 6;
		crewComp.attack.value = 0.003;
		crewComp.release.value = 0.15;
		crewComp.connect(this.out);
		this.crewBus = this.ctx.createGain();
		this.crewBus.connect(crewComp);

		const len = this.ctx.sampleRate;
		this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
		const data = this.noise.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
	}

	private env(t: number, peak: number, decay: number): GainNode {
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
		g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
		g.connect(this.out);
		return g;
	}

	private osc(
		type: OscillatorType,
		t: number,
		dur: number,
		dest: AudioNode,
		freq: number,
		freqEnd?: number,
	): void {
		const o = this.ctx.createOscillator();
		o.type = type;
		o.frequency.setValueAtTime(freq, t);
		if (freqEnd)
			o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur * 0.6);
		o.connect(dest);
		o.start(t);
		o.stop(t + dur + 0.02);
	}

	private noiseHit(
		t: number,
		dur: number,
		peak: number,
		filter: BiquadFilterType,
		freq: number,
		q = 1,
	): void {
		const src = this.ctx.createBufferSource();
		src.buffer = this.noise;
		const f = this.ctx.createBiquadFilter();
		f.type = filter;
		f.frequency.value = freq;
		f.Q.value = q;
		src.connect(f);
		f.connect(this.env(t, peak, dur));
		src.start(t, Math.random() * 0.5);
		src.stop(t + dur + 0.02);
	}

	kick(t: number, vol = 1): void {
		this.osc("sine", t, 0.35, this.env(t, vol, 0.35), 150, 45);
	}

	hat(t: number, vol = 0.25, open = false): void {
		this.noiseHit(t, open ? 0.2 : 0.05, vol, "highpass", 8000);
	}

	/** 木の鍵盤を叩いたような明るい音。メロディ用 */
	marimba(t: number, freq: number, vol = 0.2): void {
		this.osc("sine", t, 0.35, this.env(t, vol, 0.35), freq);
		this.osc("sine", t, 0.08, this.env(t, vol * 0.35, 0.08), freq * 4);
	}

	/** 歯切れのいいベース。フィルタを閉じながら鳴らして「ボッ」と弾ませる */
	pluckBass(t: number, freq: number, dur: number, vol = 0.18): void {
		const f = this.ctx.createBiquadFilter();
		f.type = "lowpass";
		f.Q.value = 6;
		f.frequency.setValueAtTime(1800, t);
		f.frequency.exponentialRampToValueAtTime(250, t + dur);
		f.connect(this.env(t, vol, dur));
		this.osc("square", t, dur, f, freq);
	}

	/** 裏拍の短い和音（裏打ち） */
	stab(t: number, freqs: number[], vol = 0.05): void {
		for (const freq of freqs) this.tone(t, freq, 0.09, vol, "square");
	}

	/** スチールドラム風。倍音を少しずらして金属っぽい響きにする */
	steel(t: number, freq: number, vol = 0.16): void {
		this.osc("sine", t, 0.4, this.env(t, vol, 0.4), freq * 1.01, freq);
		this.osc("sine", t, 0.25, this.env(t, vol * 0.45, 0.25), freq * 2);
		this.osc("sine", t, 0.12, this.env(t, vol * 0.25, 0.12), freq * 3.96);
	}

	/** 8bit 風の矩形波リード */
	chipLead(t: number, freq: number, dur: number, vol = 0.06): void {
		const f = this.ctx.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.value = 5000;
		f.connect(this.env(t, vol, dur));
		this.osc("square", t, dur, f, freq);
	}

	/** やわらかく伸びる和音。ゆっくり立ち上げて、ほかの楽器の後ろに敷く */
	pad(t: number, freqs: number[], dur: number, vol = 0.025): void {
		const f = this.ctx.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.value = 1400;
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(vol, t + 0.12);
		g.gain.setValueAtTime(vol, t + dur * 0.7);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		f.connect(g);
		g.connect(this.out);
		for (const freq of freqs) {
			for (const detune of [0.997, 1.003])
				this.osc("sawtooth", t, dur, f, freq * detune);
		}
	}

	/** コンガ。ドンのタムより高い帯域で鳴らす */
	conga(t: number, freq: number, vol = 0.3): void {
		this.osc("sine", t, 0.18, this.env(t, vol, 0.18), freq * 1.25, freq);
		this.noiseHit(t, 0.02, vol * 0.4, "bandpass", 2500);
	}

	/** ノイズのスネア（8bit 風） */
	noiseSnare(t: number, vol = 0.25): void {
		this.noiseHit(t, 0.12, vol, "bandpass", 1800, 0.7);
	}

	/** ブラス風。フィルタを開いてから少し閉じ、「パァッ」と立ち上がる音にする */
	brass(t: number, freq: number, dur: number, vol = 0.05): void {
		const f = this.ctx.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.setValueAtTime(500, t);
		f.frequency.exponentialRampToValueAtTime(2600, t + 0.04);
		f.frequency.exponentialRampToValueAtTime(1200, t + dur);
		f.connect(this.env(t, vol, dur));
		this.osc("sawtooth", t, dur, f, freq);
		this.osc("sawtooth", t, dur, f, freq * 1.005);
	}

	/** エレピ風。FM（周波数変調）で鍵盤を叩いた瞬間の金属感を出す */
	epiano(t: number, freq: number, vol = 0.14): void {
		const carrier = this.ctx.createOscillator();
		carrier.frequency.value = freq;
		const mod = this.ctx.createOscillator();
		mod.frequency.value = freq;
		const depth = this.ctx.createGain();
		depth.gain.setValueAtTime(freq * 1.5, t);
		depth.gain.exponentialRampToValueAtTime(freq * 0.05, t + 0.4);
		mod.connect(depth);
		depth.connect(carrier.frequency);
		carrier.connect(this.env(t, vol, 0.9));
		for (const o of [carrier, mod]) {
			o.start(t);
			o.stop(t + 0.95);
		}
	}

	/** 笛。ゆっくり立ち上げてビブラートと息の音を足す */
	flute(t: number, freq: number, dur: number, vol = 0.09): void {
		const g = this.ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
		g.gain.setValueAtTime(vol, t + dur * 0.7);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		g.connect(this.out);
		const o = this.ctx.createOscillator();
		o.type = "triangle";
		o.frequency.value = freq;
		const vib = this.ctx.createOscillator();
		const vibAmt = this.ctx.createGain();
		vib.frequency.value = 5.5;
		vibAmt.gain.value = freq * 0.012;
		vib.connect(vibAmt);
		vibAmt.connect(o.frequency);
		o.connect(g);
		for (const x of [o, vib]) {
			x.start(t);
			x.stop(t + dur + 0.02);
		}
		this.noiseHit(t, 0.06, vol * 0.25, "highpass", 5000);
	}

	/** 歪んだギターの和音。波形を潰して倍音を増やし、耳に痛い高域は削る */
	guitar(t: number, freqs: number[], dur: number, vol = 0.03): void {
		const shaper = this.ctx.createWaveShaper();
		shaper.curve = DISTORTION;
		const f = this.ctx.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.value = 2400;
		shaper.connect(f);
		f.connect(this.env(t, vol, dur));
		for (const freq of freqs) this.osc("sawtooth", t, dur, shaper, freq);
	}

	/** シンセのリード。少しずらした 2 本ののこぎり波で厚みを出す */
	sawLead(t: number, freq: number, dur: number, vol = 0.04): void {
		const f = this.ctx.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.value = 3200;
		f.connect(this.env(t, vol, dur));
		for (const detune of [0.994, 1.006])
			this.osc("sawtooth", t, dur, f, freq * detune);
	}

	/** 丸いベース。ゆったりした曲用 */
	roundBass(t: number, freq: number, dur: number, vol = 0.2): void {
		this.osc("triangle", t, dur, this.env(t, vol, dur), freq);
	}

	/** スネア。胴鳴りも低くしすぎず、ドンのタムと帯域を分ける */
	snare(t: number, vol = 0.25): void {
		this.noiseHit(t, 0.14, vol, "bandpass", 2200, 0.8);
		this.osc("triangle", t, 0.06, this.env(t, vol * 0.5, 0.06), 330, 220);
	}

	/** 締太鼓風の高い太鼓 */
	shime(t: number, vol = 0.25): void {
		this.osc("sine", t, 0.08, this.env(t, vol, 0.08), 760, 560);
		this.noiseHit(t, 0.02, vol * 0.5, "bandpass", 3000);
	}

	/** メトロノーム風のリムクリック */
	click(t: number, vol = 0.3): void {
		this.noiseHit(t, 0.025, vol, "bandpass", 3200, 4);
		this.osc("sine", t, 0.03, this.env(t, vol * 0.4, 0.03), 2400);
	}

	clap(t: number, vol = 0.5): void {
		for (const d of [0, 0.012, 0.024]) {
			this.noiseHit(t + d, 0.12, vol, "bandpass", 1500, 0.8);
		}
	}

	tom(t: number, freq: number, vol = 0.9): void {
		this.osc("sine", t, 0.28, this.env(t, vol, 0.28), freq, freq * 0.55);
		this.noiseHit(t, 0.04, vol * 0.3, "lowpass", 2000);
	}

	shaker(t: number, vol = 0.45, long = false): void {
		this.noiseHit(t, long ? 0.35 : 0.09, vol, "bandpass", 6000, 1.5);
	}

	block(t: number, freq: number, vol = 0.7): void {
		this.osc("triangle", t, 0.09, this.env(t, vol, 0.09), freq);
		this.osc("sine", t, 0.05, this.env(t, vol * 0.5, 0.05), freq * 2.7);
	}

	bell(t: number, freq: number, vol = 0.3, dur = 0.6): void {
		this.osc("sine", t, dur, this.env(t, vol, dur), freq);
		this.osc("sine", t, dur * 0.6, this.env(t, vol * 0.4, dur * 0.6), freq * 3);
	}

	crash(t: number, vol = 0.35): void {
		this.noiseHit(t, 0.9, vol, "highpass", 5000);
	}

	tone(
		t: number,
		freq: number,
		dur: number,
		vol: number,
		type: OscillatorType = "square",
	): void {
		const f = this.ctx.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.value = 1800;
		f.connect(this.env(t, vol, dur));
		this.osc(type, t, dur, f, freq);
	}

	/** パッドを押した拍で鳴るフレーズ（1 拍ぶん） */
	padPhrase(pad: PadId, t: number, beat: number): void {
		switch (pad) {
			case "don": // ドン・ドコ（8 分 + 16 分 ×2）
				this.tom(t, 110, 1);
				this.tom(t + beat * 0.5, 160, 0.75);
				this.tom(t + beat * 0.75, 160, 0.75);
				break;
			case "shaka": // シャン・シャカ
				this.shaker(t, 0.6, true);
				this.clap(t, 0.25);
				this.shaker(t + beat * 0.5, 0.45);
				this.shaker(t + beat * 0.75, 0.45);
				break;
			case "poko": // ポコ・ポコ（8 分 ×2）
				this.block(t, 880);
				this.block(t + beat * 0.25, 660, 0.55);
				this.block(t + beat * 0.5, 880);
				this.block(t + beat * 0.75, 660, 0.55);
				break;
		}
	}

	/** 3 拍そろったときに休符拍で鳴るキメ */
	finisher(pad: PadId, t: number, fever: boolean): void {
		const root = { don: 196, shaka: 262, poko: 330 }[pad];
		switch (pad) {
			case "don":
				this.kick(t, 1.2);
				this.tom(t, 90, 1);
				break;
			case "shaka":
				this.shaker(t, 0.7, true);
				this.clap(t, 0.6);
				break;
			case "poko":
				this.block(t, 1320, 0.8);
				this.bell(t, 1320, 0.25);
				break;
		}
		this.crash(t, fever ? 0.4 : 0.2);
		// 掛け声の代わりに和音を短く鳴らす。フィーバー中は 3 和音に厚くする
		const chord = fever ? [1, 1.25, 1.5, 2] : [1, 1.5];
		for (const r of chord) this.tone(t, root * r, 0.3, 0.08);
	}

	/**
	 * 子分の声。フォルマント合成で母音を作り、子音はノイズの短い破裂で表す。
	 * 基本周波数を高くし、出だしで少し音程をしゃくり上げると幼くかわいく聞こえる。
	 */
	private syllable(
		t: number,
		syl: Syllable,
		dur: number,
		f0: number,
		vol: number,
	): void {
		const ctx = this.ctx;
		const cons = CONSONANT[syl.c ?? ""];
		if (cons) {
			this.noiseHit(t, cons.dur, vol * cons.vol, cons.type, cons.freq, 1.2);
		}
		const vt = t + (cons ? cons.dur * 0.6 : 0);
		const formants = FORMANT[syl.v];
		const amp = ctx.createGain();
		const peak = syl.v === "n" ? vol * 0.5 : vol;
		amp.gain.setValueAtTime(0.0001, vt);
		amp.gain.exponentialRampToValueAtTime(peak, vt + 0.015);
		amp.gain.setValueAtTime(peak, vt + dur * 0.6);
		amp.gain.exponentialRampToValueAtTime(0.0001, vt + dur);
		amp.connect(this.out);

		const src = ctx.createOscillator();
		src.type = "sawtooth";
		src.frequency.setValueAtTime(f0 * 0.88, vt);
		src.frequency.exponentialRampToValueAtTime(f0, vt + 0.04);
		const vib = ctx.createOscillator();
		const vibAmt = ctx.createGain();
		vib.frequency.value = 6;
		vibAmt.gain.value = f0 * 0.015;
		vib.connect(vibAmt);
		vibAmt.connect(src.frequency);

		formants.forEach((freq, i) => {
			const bp = ctx.createBiquadFilter();
			bp.type = "bandpass";
			bp.frequency.value = freq;
			bp.Q.value = 9;
			const g = ctx.createGain();
			g.gain.value = [1, 0.6, 0.25][i] ?? 0.2;
			src.connect(bp);
			bp.connect(g);
			g.connect(amp);
		});
		for (const o of [src, vib]) {
			o.start(vt);
			o.stop(vt + dur + 0.05);
		}
	}

	private sing(
		t: number,
		line: Note[],
		beat: number,
		f0: number,
		vol: number,
	): void {
		// わずかにずらした 2 声で重ね、子分たちの合唱にする
		for (const detune of [1, 1.012]) {
			for (const n of line) {
				const pitch = f0 * detune * 2 ** (n.semi / 12);
				this.syllable(t + n.at * beat, n, n.len * beat, pitch, vol);
			}
		}
	}

	/** 掛け声の音声を読み込む。失敗した分はフォルマント合成のままにして、警告を出す */
	async loadVoices(
		urls: Record<string, string>,
		manifest: VoiceManifest,
	): Promise<void> {
		await Promise.all(
			Object.entries(urls).map(async ([key, url]) => {
				try {
					const res = await fetch(url);
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
					this.voices.set(key, { buf, lead: manifest[key]?.lead ?? 0 });
				} catch (err) {
					console.warn(
						`掛け声 ${key} を読み込めないので合成音声で代用する`,
						err,
					);
				}
			}),
		);
	}

	/** 最初の母音が t に来るように、子音ぶん早めて再生する */
	private playVoice(
		key: string,
		t: number,
		vol: number,
		opts: { rate?: number; pan?: number; dest?: AudioNode } = {},
	): boolean {
		const v = this.voices.get(key);
		if (!v) return false;
		const rate = opts.rate ?? 1;
		const src = this.ctx.createBufferSource();
		src.buffer = v.buf;
		src.playbackRate.value = rate;
		const g = this.ctx.createGain();
		g.gain.value = vol;
		src.connect(g);
		let node: AudioNode = g;
		if (opts.pan) {
			const panner = this.ctx.createStereoPanner();
			panner.pan.value = opts.pan;
			g.connect(panner);
			node = panner;
		}
		node.connect(opts.dest ?? this.out);
		src.start(Math.max(this.ctx.currentTime, t - v.lead / rate));
		return true;
	}

	/**
	 * 子分全員で同じ掛け声を歌う。並び順どおり左から右へ定位させ、少しずつ出だしをずらして厚みを出す。
	 * 無相関な声は重ねると音量が人数の平方根で増えるので、1 人あたりを 1/√N にして合計を 1 人ぶん程度に保つ。
	 */
	private singCrew(
		pad: PadId,
		kind: VoiceKind,
		t: number,
		vol: number,
		rate = 1,
	): boolean {
		const roles = CREW_ROLES.filter((r) =>
			this.voices.has(voiceKey(r, pad, kind)),
		);
		if (roles.length === 0) return false;
		const each = vol / Math.sqrt(roles.length);
		roles.forEach((role, i) => {
			const pan =
				roles.length === 1 ? 0 : -0.7 + (1.4 * i) / (roles.length - 1);
			const jitter = CREW_JITTER[i % CREW_JITTER.length] ?? 0;
			this.playVoice(voiceKey(role, pad, kind), t + jitter, each, {
				rate,
				pan,
				dest: this.crewBus,
			});
		});
		return true;
	}

	/**
	 * プレイヤーがパッドを叩いたときの掛け声。押した瞬間に鳴らすので子音ぶんの前倒しはしない。
	 * 音声が読み込めていなければ楽器のフレーズで代用する。
	 */
	playerChant(pad: PadId, t: number, beat: number, rise: boolean): void {
		const key = voiceKey("player", pad, rise ? "rise" : "hit");
		if (this.voices.has(key)) {
			this.playVoice(key, t + (this.voices.get(key)?.lead ?? 0), 1.1);
			return;
		}
		this.padPhrase(pad, t, beat);
	}

	/** プレイヤー側の入力がそろったときに休符拍で鳴らすキメの掛け声 */
	playerFinish(pad: PadId, t: number): void {
		if (this.playVoice(voiceKey("player", pad, "finish"), t, 1.2)) return;
		this.finisher(pad, t, false);
	}

	/** 子分が 1 拍ぶんの掛け声を歌う。rise は 3 拍目用で、語尾が上がる */
	crewChant(pad: PadId, t: number, beat: number, rise: boolean): void {
		if (this.singCrew(pad, rise ? "rise" : "hit", t, 1.2)) return;
		const f0 = VOICE[pad].f0 * (rise ? 2 ** (3 / 12) : 1);
		this.sing(t, VOICE[pad].hit, beat, f0, 0.32);
	}

	/** 子分のキメの掛け声 */
	crewFinish(pad: PadId, t: number, beat: number, fever: boolean): void {
		// フィーバー中は少し高く速く再生してはしゃいだ声にする
		if (this.singCrew(pad, "finish", t, 1.4, fever ? 1.06 : 1)) return;
		this.sing(
			t,
			VOICE[pad].finish,
			beat,
			VOICE[pad].f0 * (fever ? 2 ** (2 / 12) : 1),
			0.4,
		);
	}
}

/** 子分ごとの出だしのずれ（秒）。そろいすぎると 1 人の声に聞こえるため */
const CREW_JITTER = [0, 0.012, -0.008, 0.006, -0.012, 0.009];

/** 先読みで伴奏を予約するループ。曲の終わりまで来たら頭に戻る */
export class Backing {
	private timer = 0;
	private nextStep = 0;
	/** 今のコンボ数。増えるほど楽器が重なって盛り上がる */
	combo = 0;

	constructor(
		private readonly synth: Synth,
		private readonly startTime: number,
		private readonly beatSec: number,
		private readonly song: Song,
	) {}

	start(): void {
		this.timer = window.setInterval(() => this.schedule(), 25);
		this.schedule();
	}

	stop(): void {
		clearInterval(this.timer);
	}

	private schedule(): void {
		const step = this.beatSec / 4;
		const horizon = this.synth.ctx.currentTime + 0.12;
		while (this.startTime + this.nextStep * step < horizon) {
			this.playStep(this.nextStep, this.startTime + this.nextStep * step);
			this.nextStep++;
		}
	}

	private playStep(n: number, stepTime: number): void {
		const s = this.synth;
		const song = this.song;
		const loopStep = n % song.steps;
		const inBar = loopStep % 16;
		const beat = Math.floor(inBar / 4);
		const sixteenth = inBar % 4;
		const sec = this.beatSec / 4;
		const full = this.combo >= FULL_COMBO;
		const fever = this.combo >= FEVER_COMBO;
		const chordNotes = song.chords[loopStep] ?? [];
		const chord = chordNotes.map(hz);

		// 拍の目印は高域のクリック。低域はドン（タム・キック）が使うので伴奏では鳴らさない。
		// 判定の基準なのでスウィングさせない
		if (sixteenth === 0) {
			s.click(stepTime, beat === 0 ? 0.5 : 0.3);
			if (loopStep === 0) s.bell(stepTime, 1046.5, 0.08, 0.3);
		}

		// 8 分の裏（各拍の 3 つ目の 16 分）を遅らせて跳ねさせる
		const t = sixteenth === 2 ? stepTime + song.swing * sec : stepTime;

		this.playPerc(t, loopStep, full, fever);

		const bass = song.bass.get(loopStep);
		if (bass) this.playBass(t, hz(bass[0]), bass[1] * sec);

		// 和音・伴奏の刻み・メロディはコンボに関係なく常に鳴らし、ミスしても曲として聴けるようにする
		const prev = song.chords[(loopStep + song.steps - 1) % song.steps];
		if (prev !== chordNotes) {
			s.pad(t, chord, this.chordLength(loopStep) * sec, fever ? 0.03 : 0.022);
		}

		this.playComp(t, n, chord, sec);
		const note = song.melody.get(loopStep);
		// 4 拍目はキメの掛け声が乗るので控えめにする
		if (note) this.playLead(t, hz(note), beat === 3 ? 0.6 : 1, sec);

		if (fever && note) {
			// コードの構成音から、メロディのすぐ下の音を選んでハモらせる
			const harmony = harmonyBelow(note, chordNotes);
			if (harmony) this.playLead(t, hz(harmony), 0.45, sec);
			s.bell(t, hz(note) * 2, 0.035, 0.2);
		}
	}

	/** 今のコードが何ステップ続くか（曲の終わりでは止める） */
	private chordLength(loopStep: number): number {
		const chords = this.song.chords;
		let len = 1;
		while (
			loopStep + len < chords.length &&
			chords[loopStep + len] === chords[loopStep]
		) {
			len++;
		}
		return len;
	}

	private playBass(t: number, freq: number, dur: number): void {
		const s = this.synth;
		switch (this.song.bassKind) {
			case "pluck":
				s.pluckBass(t, freq, dur, 0.16);
				break;
			case "chip":
				s.chipLead(t, freq, dur * 0.8, 0.07);
				break;
			case "round":
				s.roundBass(t, freq, dur * 0.9, 0.2);
				break;
		}
	}

	private playComp(t: number, n: number, chord: number[], sec: number): void {
		const s = this.synth;
		const sixteenth = n % 4;
		switch (this.song.comp) {
			case "stab":
				if (sixteenth === 2) s.stab(t, chord, 0.032);
				break;
			case "arp": {
				const note = chord[n % chord.length];
				if (!note) break;
				if (this.song.lead === "chip")
					s.chipLead(t, note * 2, sec * 0.7, 0.025);
				else s.sawLead(t, note * 2, sec * 0.7, 0.018);
				break;
			}
			case "power":
				// 8 分で刻み、拍の頭だけ長く伸ばす
				if (sixteenth === 0) s.guitar(t, chord, sec * 1.8, 0.03);
				else if (sixteenth === 2) s.guitar(t, chord, sec * 0.8, 0.022);
				break;
			case "none":
				break;
		}
	}

	private playLead(t: number, freq: number, level: number, sec: number): void {
		const s = this.synth;
		switch (this.song.lead) {
			case "marimba":
				s.marimba(t, freq, 0.17 * level);
				break;
			case "steel":
				s.steel(t, freq, 0.16 * level);
				break;
			case "chip":
				s.chipLead(t, freq, sec * 1.6, 0.055 * level);
				break;
			case "brass":
				s.brass(t, freq, sec * 1.6, 0.05 * level);
				break;
			case "epiano":
				s.epiano(t, freq, 0.14 * level);
				break;
			case "flute":
				s.flute(t, freq, sec * 1.8, 0.09 * level);
				break;
			case "saw":
				s.sawLead(t, freq, sec * 1.7, 0.04 * level);
				break;
		}
	}

	/** groove が true（コンボ 2 以上）で打楽器を足す */
	private playPerc(
		t: number,
		loopStep: number,
		groove: boolean,
		fever: boolean,
	): void {
		const s = this.synth;
		const inBar = loopStep % 16;
		const beat = Math.floor(inBar / 4);
		const sixteenth = inBar % 4;
		const backbeat = sixteenth === 0 && (beat === 1 || beat === 3);
		// 2 小節ごとのフレーズの終わり。小さなフィルで次のフレーズへの勢いをつける
		const fill = fever && loopStep % 32 >= 30;

		switch (this.song.perc) {
			case "pop":
				if (sixteenth === 2) s.hat(t, 0.16);
				else if (groove && sixteenth !== 0) s.hat(t, 0.06);
				if (groove && backbeat) s.clap(t, fever ? 0.32 : 0.2);
				if (fever) s.shaker(t, sixteenth === 2 ? 0.14 : 0.07);
				if (fill) s.clap(t, 0.18);
				break;
			case "tropical": {
				s.shaker(t, sixteenth === 2 ? 0.16 : 0.07);
				const conga = TROPICAL_CONGA[inBar];
				if (groove && conga) s.conga(t, conga, 0.26);
				if (groove && sixteenth === 0 && beat === 3) s.clap(t, 0.16);
				if (fever && sixteenth === 2) s.hat(t, 0.1);
				if (fill) s.conga(t, 420, 0.24);
				break;
			}
			case "chip":
				if (sixteenth === 2) s.hat(t, 0.12);
				else if (fever && sixteenth !== 0) s.hat(t, 0.05);
				if (groove && backbeat) s.noiseSnare(t, fever ? 0.3 : 0.22);
				if (fill) s.noiseSnare(t, 0.2);
				break;
			case "funk":
				// 16 分を全部刻み、裏にアクセント。スネアの前に小さなゴーストを入れる
				if (sixteenth !== 0) s.hat(t, sixteenth === 2 ? 0.15 : 0.06);
				if (groove && backbeat) s.snare(t, fever ? 0.3 : 0.24);
				if (groove && (inBar === 7 || inBar === 15)) s.snare(t, 0.07);
				if (fever) s.shaker(t, 0.06);
				if (fill) s.snare(t, 0.18);
				break;
			case "lofi":
				if (sixteenth === 2) s.hat(t, 0.1);
				if (groove && backbeat) s.noiseSnare(t, 0.14);
				if (fever && sixteenth === 0) s.shaker(t, 0.08);
				break;
			case "march":
				if (groove && sixteenth === 2) s.snare(t, 0.16);
				// 各小節の終わりにロール
				if (groove && inBar >= 13) s.snare(t, 0.1);
				if (groove && loopStep === 0) s.crash(t, 0.18);
				if (sixteenth === 0 && (beat === 1 || beat === 3)) s.hat(t, 0.08);
				if (fever && sixteenth === 0) s.crash(t, 0.06);
				break;
			case "matsuri":
				// テン・テケ のくり返し
				if ([0, 2, 3, 8, 10, 11].includes(inBar))
					s.shime(t, groove ? 0.24 : 0.16);
				if (groove && sixteenth === 0 && (beat === 1 || beat === 3)) {
					s.bell(t, 2093, 0.07, 0.25);
					s.bell(t, 2960, 0.04, 0.2);
				}
				if (fever && backbeat) s.clap(t, 0.24);
				if (fill) s.shime(t, 0.22);
				break;
			case "rock":
				if (sixteenth === 0 || sixteenth === 2)
					s.hat(t, sixteenth === 0 ? 0.1 : 0.14);
				if (groove && backbeat) s.snare(t, fever ? 0.34 : 0.26);
				if (groove && loopStep === 0) s.crash(t, 0.22);
				if (fever && sixteenth === 0 && beat === 0) s.crash(t, 0.12);
				if (fill) s.snare(t, 0.22);
				break;
		}
	}
}

/** 打楽器が増えるコンボ数 */
export const FULL_COMBO = 2;

/** コードの構成音のうち、メロディより下で一番近い音（3〜9 半音下）を返す */
function harmonyBelow(note: number, chord: number[]): number | null {
	let best: number | null = null;
	for (const c of chord) {
		for (let octave = -2; octave <= 2; octave++) {
			const candidate = c + octave * 12;
			const gap = note - candidate;
			if (gap >= 3 && gap <= 9 && (best === null || candidate > best)) {
				best = candidate;
			}
		}
	}
	return best;
}

/** トロピカルのコンガ（小節内ステップ → 周波数） */
const TROPICAL_CONGA: Record<number, number> = {
	2: 330,
	3: 330,
	6: 260,
	10: 330,
	11: 330,
	14: 260,
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** ギターの歪み用の波形変換カーブ */
const DISTORTION = (() => {
	const n = 1024;
	const curve = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const x = (i / (n - 1)) * 2 - 1;
		curve[i] = Math.tanh(x * 4);
	}
	return curve;
})();

type Vowel = "a" | "i" | "u" | "e" | "o" | "n";
interface Syllable {
	c?: "d" | "k" | "p" | "sh";
	v: Vowel;
}
/** at・len は拍単位、semi は基本音からの半音数 */
interface Note extends Syllable {
	at: number;
	len: number;
	semi: number;
}

// 子どもの声を想定して大人より高めにとったフォルマント（Hz）
const FORMANT: Record<Vowel, number[]> = {
	a: [1000, 1500, 3300],
	i: [400, 2900, 3800],
	u: [450, 1500, 3000],
	e: [650, 2400, 3500],
	o: [600, 1000, 3000],
	n: [300, 1800, 2900],
};

const CONSONANT: Record<
	string,
	{ dur: number; vol: number; type: BiquadFilterType; freq: number }
> = {
	d: { dur: 0.015, vol: 0.5, type: "bandpass", freq: 1500 },
	k: { dur: 0.02, vol: 0.6, type: "bandpass", freq: 2600 },
	p: { dur: 0.015, vol: 0.5, type: "bandpass", freq: 800 },
	sh: { dur: 0.06, vol: 0.5, type: "highpass", freq: 3200 },
};

const q = (
	c: Syllable["c"],
	v: Vowel,
	at: number,
	len: number,
	semi: number,
): Note => ({
	c,
	v,
	at,
	len,
	semi,
});

const VOICE: Record<PadId, { f0: number; hit: Note[]; finish: Note[] }> = {
	// ドン・ドコ
	don: {
		f0: 523,
		hit: [
			q("d", "o", 0, 0.25, 0),
			q(undefined, "n", 0.25, 0.25, 0),
			q("d", "o", 0.5, 0.25, 2),
			q("k", "o", 0.75, 0.25, 0),
		],
		finish: [q("d", "o", 0, 0.5, 5), q(undefined, "n", 0.5, 0.4, 5)],
	},
	// シャン・シャカ
	shaka: {
		f0: 587,
		hit: [
			q("sh", "a", 0, 0.25, 0),
			q(undefined, "n", 0.25, 0.25, 0),
			q("sh", "a", 0.5, 0.25, 2),
			q("k", "a", 0.75, 0.25, 0),
		],
		finish: [q("sh", "a", 0, 0.5, 5), q(undefined, "n", 0.5, 0.4, 5)],
	},
	// ポコ・ポコ
	poko: {
		f0: 659,
		hit: [
			q("p", "o", 0, 0.25, 0),
			q("k", "o", 0.25, 0.25, -2),
			q("p", "o", 0.5, 0.25, 0),
			q("k", "o", 0.75, 0.25, -2),
		],
		finish: [q("p", "o", 0, 0.25, 3), q(undefined, "n", 0.25, 0.5, 7)],
	},
};
