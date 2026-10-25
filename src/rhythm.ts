// リズム判定の純粋ロジック。時刻はすべて「曲の開始からの秒数」で受け取る。
// 1 小節 = 4 拍。0〜2 拍目が入力枠、3 拍目は休符（フィニッシュが鳴る拍）。
// 2 小節で 1 セット。3 拍そろった次の小節は子分が同じリズムを返す「応答小節」で、プレイヤーは叩かない。

export type PadId = "don" | "shaka" | "poko";
export type Judge = "perfect" | "good" | "miss";

export const BPM = 130;
export const BEATS_PER_BAR = 4;
export const INPUT_BEATS = 3;
export const PERFECT_WINDOW = 0.075;
export const GOOD_WINDOW = 0.16;
export const FEVER_COMBO = 3;

export interface TapResult {
	judge: Judge;
	bar: number;
	beat: number;
	/** 拍からのズレ（秒）。負なら早い */
	delta: number;
	/** このタップで連続入力が途切れたか */
	broke: boolean;
	/** 応答小節（子分の番）に叩いてしまった */
	interrupt: boolean;
	/** 3 拍そろった瞬間だけ、入力されたパッド列が入る */
	complete: PadId[] | null;
}

export interface BarEnd {
	bar: number;
	/** そろわずに小節が終わり、コンボが切れた */
	broke: boolean;
}

export class RhythmState {
	combo = 0;
	private bar = -1;
	private hits: PadId[] = [];
	private failed = false;
	private completed = false;
	private lastResolvedBar = -1;
	/** 子分が応答する小節 */
	private responseBar = -1;
	private responseInterrupted = false;

	constructor(readonly beatSec: number) {}

	get fever(): boolean {
		return this.combo >= FEVER_COMBO;
	}

	tap(pad: PadId, t: number): TapResult {
		const beatIndex = Math.round(t / this.beatSec);
		const delta = t - beatIndex * this.beatSec;
		const bar = Math.floor(beatIndex / BEATS_PER_BAR);
		const beat = beatIndex - bar * BEATS_PER_BAR;
		const timing: Judge =
			Math.abs(delta) <= PERFECT_WINDOW
				? "perfect"
				: Math.abs(delta) <= GOOD_WINDOW
					? "good"
					: "miss";

		// 曲の開始前、もしくは解決済みの小節に属するタップは判定だけ返す
		if (beatIndex < 0 || bar <= this.lastResolvedBar) {
			return {
				judge: "miss",
				bar,
				beat,
				delta,
				broke: false,
				interrupt: false,
				complete: null,
			};
		}
		if (bar === this.responseBar) {
			// 子分の番に叩いたらミス。同じ小節で何度叩いてもコンボ切れの通知は 1 回だけ
			const broke = !this.responseInterrupted && this.combo > 0;
			this.responseInterrupted = true;
			this.combo = 0;
			return {
				judge: "miss",
				bar,
				beat,
				delta,
				broke,
				interrupt: true,
				complete: null,
			};
		}
		if (bar !== this.bar) {
			this.bar = bar;
			this.hits = [];
			this.failed = false;
			this.completed = false;
		}

		const result: TapResult = {
			judge: timing,
			bar,
			beat,
			delta,
			broke: false,
			interrupt: false,
			complete: null,
		};

		if (beat >= INPUT_BEATS) {
			// 休符の拍で押したらミス
			result.judge = "miss";
			result.broke = this.breakCombo();
			return result;
		}
		if (this.failed || this.completed) {
			// 同じ小節の中では立て直せない。完成後の追い打ちは二度押し扱い
			if (this.completed) {
				result.judge = "miss";
				result.broke = this.breakCombo();
			}
			return result;
		}
		if (timing === "miss" || this.hits.length !== beat) {
			// タイミング外れ・二度押し・拍の飛ばし
			if (this.hits.length > beat) result.judge = "miss";
			result.broke = this.breakCombo();
			return result;
		}

		this.hits.push(pad);
		if (this.hits.length === INPUT_BEATS) {
			this.completed = true;
			this.combo++;
			this.responseBar = bar + 1;
			this.responseInterrupted = false;
			result.complete = [...this.hits];
		}
		return result;
	}

	/**
	 * 休符拍の中央を過ぎた小節を確定させる。そろわなかった小節（無入力含む）でコンボを切る。
	 * 応答小節はプレイヤーが叩かない小節なので、確定してもコンボは切らない。
	 * 休符拍の中央以降のタップは四捨五入で次の小節の 0 拍目に属するので、ここで確定してよい。
	 */
	tick(t: number): BarEnd[] {
		const resolvable = Math.floor(
			(t / this.beatSec - (BEATS_PER_BAR - 0.5)) / BEATS_PER_BAR,
		);
		const ended: BarEnd[] = [];
		while (this.lastResolvedBar < resolvable) {
			this.lastResolvedBar++;
			if (this.lastResolvedBar === this.responseBar) continue;
			const done =
				this.lastResolvedBar === this.bar && this.completed && !this.failed;
			if (done) continue;
			const hadInput = this.lastResolvedBar === this.bar && !this.failed;
			const broke = this.combo > 0 || (hadInput && this.hits.length > 0);
			if (this.combo > 0) this.combo = 0;
			if (broke) ended.push({ bar: this.lastResolvedBar, broke: true });
		}
		return ended;
	}

	private breakCombo(): boolean {
		const wasActive = !this.failed;
		this.failed = true;
		this.combo = 0;
		return wasActive;
	}
}
