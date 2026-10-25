import { Backing, Synth } from "./audio";
import { BPM, RhythmState } from "./rhythm";
import { findSong, type Song } from "./songs";
import { VOICE_MANIFEST, VOICE_URLS } from "./voice";

export const BEAT_SEC = 60 / BPM;
const OFFSET_KEY = "pokodon.offsetMs";

/** 音声・伴奏・判定をまとめ、曲の時刻を一元管理する */
export class Conductor {
	readonly synth: Synth;
	readonly rhythm = new RhythmState(BEAT_SEC);
	readonly startTime: number;
	readonly song: Song;
	private readonly backing: Backing;
	offsetMs = loadOffset();

	/** ユーザ操作のイベントハンドラ内で呼ぶこと（音声の再開に必要） */
	constructor(songId: string) {
		// iOS で消音スイッチがオンでも鳴るように再生カテゴリを指定する
		const nav = navigator as Navigator & { audioSession?: { type: string } };
		if (nav.audioSession) nav.audioSession.type = "playback";

		this.synth = new Synth();
		void this.synth.ctx.resume();
		// 最初の応答は早くても 1 小節後なので、読み込みを待たずに始める
		void this.synth.loadVoices(VOICE_URLS, VOICE_MANIFEST);
		this.startTime = this.synth.ctx.currentTime + 0.4;
		this.song = findSong(songId);
		this.backing = new Backing(this.synth, this.startTime, BEAT_SEC, this.song);
		this.backing.start();
	}

	get ctx(): AudioContext {
		return this.synth.ctx;
	}

	/** 伴奏の盛り上がりをコンボ数に合わせる */
	set combo(n: number) {
		this.backing.combo = n;
	}

	/**
	 * performance.now() 基準の時刻を「その瞬間に聞こえている曲の時刻（秒）」に変換する。
	 * 予約時刻（currentTime）から出力レイテンシを引いたものが聞こえている時刻。
	 * getOutputTimestamp は出力デバイスが無い環境などで contextTime が進まないことがあるため、
	 * 直接は使わず、レイテンシの推定にだけ使う。
	 */
	songTime(perfNow: number): number {
		const heard =
			this.ctx.currentTime -
			this.latency() -
			(performance.now() - perfNow) / 1000;
		return heard - this.startTime;
	}

	private latency(): number {
		const ts = this.ctx.getOutputTimestamp?.();
		if (ts?.contextTime && ts.performanceTime) {
			const measured =
				this.ctx.currentTime -
				ts.contextTime -
				(performance.now() - ts.performanceTime) / 1000;
			if (measured >= 0 && measured < 0.5) return measured;
		}
		return this.ctx.outputLatency || this.ctx.baseLatency || 0;
	}

	/** 判定に使う時刻。ユーザのオフセット補正を含む */
	judgeTime(perfNow: number): number {
		return this.songTime(perfNow) - this.offsetMs / 1000;
	}

	/** 曲の時刻 t（秒）を音声の予約時刻に変換する */
	audioTimeAt(t: number): number {
		return this.startTime + t;
	}

	addOffset(ms: number): void {
		this.offsetMs += ms;
		try {
			localStorage.setItem(OFFSET_KEY, String(this.offsetMs));
		} catch {
			// プライベートブラウズ等で保存できなくてもプレイには影響しない
		}
	}

	stop(): void {
		this.backing.stop();
		void this.ctx.close();
	}
}

function loadOffset(): number {
	try {
		return Number(localStorage.getItem(OFFSET_KEY)) || 0;
	} catch {
		return 0;
	}
}
