// 音量設定。BGM（伴奏・楽器）とキャラの声を別々に 0〜1 で持ち、localStorage に保存する。

export type VolumeKind = "bgm" | "voice";

const KEY: Record<VolumeKind, string> = {
	bgm: "pokodon.volume.bgm",
	voice: "pokodon.volume.voice",
};

export function clampVolume(v: number): number {
	if (!Number.isFinite(v)) return 1;
	return Math.min(1, Math.max(0, v));
}

/**
 * スライダーの値を音量（ゲイン）に変える。耳は音量を対数的に感じるので、
 * そのまま比例させると下半分がほとんど聞こえ方が変わらない。2 乗にして体感を均等に近づける。
 */
export function volumeToGain(v: number): number {
	const c = clampVolume(v);
	return c * c;
}

export function loadVolume(kind: VolumeKind): number {
	try {
		const raw = localStorage.getItem(KEY[kind]);
		return raw === null ? 1 : clampVolume(Number(raw));
	} catch {
		return 1;
	}
}

export function saveVolume(kind: VolumeKind, v: number): void {
	try {
		localStorage.setItem(KEY[kind], String(clampVolume(v)));
	} catch {
		// プライベートブラウズ等で保存できなくても、その場の音量は変えられる
	}
}
