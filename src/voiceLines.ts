import type { PadId } from "./rhythm";

/**
 * 掛け声（VOICEVOX に読ませるカナ）と、各モーラの長さ（拍単位）。
 * hit は 1 拍に 4 モーラを 16 分音符で並べ、finish は休符拍で伸ばす。
 * 文言を変えたら `bun run voice` で音声を作り直す。
 */
export const VOICE_LINES: Record<
	PadId,
	{ hit: string; hitMoras: number[]; finish: string; finishMoras: number[] }
> = {
	don: {
		hit: "ドンドコ",
		hitMoras: [0.25, 0.25, 0.25, 0.25],
		finish: "ドーン",
		finishMoras: [0.3, 0.3, 0.4],
	},
	shaka: {
		hit: "シャンシャカ",
		hitMoras: [0.25, 0.25, 0.25, 0.25],
		finish: "シャーン",
		finishMoras: [0.3, 0.3, 0.4],
	},
	poko: {
		hit: "ポコポコ",
		hitMoras: [0.25, 0.25, 0.25, 0.25],
		finish: "ポン",
		finishMoras: [0.35, 0.5],
	},
};

/** hit: 1・2 拍目、rise: 語尾が上がる 3 拍目、finish: 休符拍のキメ */
export type VoiceKind = "hit" | "rise" | "finish";

/** player: タッチしたときの声。crewN: 子分の合唱（N は子分の並び順） */
export type VoiceRole = "player" | `crew${number}`;

/**
 * 配役。speaker / style は VOICEVOX の話者名とスタイル名、pitchScale は声の高さの微調整。
 * 変えたら `bun run voice` で作り直す。クレジットは話者名から自動で作られる。
 */
export const VOICE_CAST: {
	role: VoiceRole;
	speaker: string;
	style: string;
	pitchScale: number;
}[] = [
	{
		role: "player",
		speaker: "ずんだもん",
		style: "ノーマル",
		pitchScale: 0.06,
	},
	{ role: "crew0", speaker: "白上虎太郎", style: "わーい", pitchScale: 0.08 },
	{ role: "crew1", speaker: "櫻歌ミコ", style: "ロリ", pitchScale: 0.04 },
	{ role: "crew2", speaker: "猫使アル", style: "うきうき", pitchScale: 0.06 },
	{
		role: "crew3",
		speaker: "春日部つむぎ",
		style: "ノーマル",
		pitchScale: 0.08,
	},
	{ role: "crew4", speaker: "猫使ビィ", style: "ノーマル", pitchScale: 0.05 },
	{ role: "crew5", speaker: "満別花丸", style: "元気", pitchScale: 0.06 },
];

export const CREW_ROLES = VOICE_CAST.map((m) => m.role).filter((r) =>
	r.startsWith("crew"),
);

/** 音声ファイル内で、拍に合わせるべき最初の母音が始まるまでの秒数 */
export type VoiceManifest = Record<string, { lead: number }>;

export const voiceKey = (role: VoiceRole, pad: PadId, kind: VoiceKind) =>
	`${role}-${pad}-${kind}`;
