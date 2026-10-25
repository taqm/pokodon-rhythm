// 伴奏の曲データ。どれも BPM 共通で、A メロ 8 小節 + B メロ 8 小節 = 16 小節で 1 曲として一周する。
// B メロの終わりは A メロの頭へ戻るコードで締め、ループしても曲がつながって聞こえるようにする。
// メロディ・コードはすべてこのゲームのためのオリジナル。

/** メロディを鳴らす楽器 */
export type LeadKind =
	| "marimba"
	| "steel"
	| "chip"
	| "brass"
	| "epiano"
	| "flute"
	| "saw";
/**
 * コンボ 1 以上で入る伴奏の刻み方。
 * stab: 裏拍の和音、arp: 16 分の分散和音、power: 歪んだギターの 8 分刻み、none: 伸びる和音だけ
 */
export type CompKind = "stab" | "arp" | "power" | "none";
/** 打楽器のセット */
export type PercKind =
	| "pop"
	| "tropical"
	| "chip"
	| "funk"
	| "lofi"
	| "march"
	| "matsuri"
	| "rock";
export type BassKind = "pluck" | "chip" | "round";

export interface SongSource {
	id: string;
	name: string;
	/** タイトル画面に出す一言 */
	mood: string;
	lead: LeadKind;
	comp: CompKind;
	perc: PercKind;
	bassKind: BassKind;
	/** 8 分の裏を遅らせる量（16 分音符に対する割合）。0 で跳ねない */
	swing: number;
	/**
	 * 4 小節ぶんのコード。1 小節に 1 つ、"F-G" と書くと 2 拍ずつ。
	 * A は A メロ（2 回くり返す）、B は B メロ（2 回くり返す）。
	 */
	chords: { A: string; B: string };
	/**
	 * 2 小節ぶんのメロディ。"ステップ:音名" をスペース区切りで並べる（ステップは 0〜31 の 16 分音符）。
	 * 曲は A1 A2 A1 A2 B1 B2 B1 B2 の順に並ぶ。
	 */
	phrases: { A1: string; A2: string; B1: string; B2: string };
	/** 1 小節ぶんのベースの刻み。[ステップ, コードのルートからの半音数, 長さ（ステップ数）] */
	bassPattern: [number, number, number][];
}

/** 再生用に展開した曲データ */
export interface Song {
	id: string;
	name: string;
	mood: string;
	lead: LeadKind;
	comp: CompKind;
	perc: PercKind;
	bassKind: BassKind;
	swing: number;
	/** 1 曲の長さ（16 分音符のステップ数） */
	steps: number;
	/** ステップごとのコード構成音（MIDI ノート番号） */
	chords: number[][];
	/** ステップ → メロディの音高 */
	melody: Map<number, number>;
	/** ステップ → [音高, 長さ] */
	bass: Map<number, [number, number]>;
}

export const BAR_STEPS = 16;
const SECTION_BARS = 4;
const ORDER = ["A1", "A2", "A1", "A2", "B1", "B2", "B1", "B2"] as const;

const PITCH_CLASS: Record<string, number> = {
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11,
};

const CHORD_QUALITY: Record<string, number[]> = {
	"": [0, 4, 7],
	m: [0, 3, 7],
	"7": [0, 4, 7, 10],
	m7: [0, 3, 7, 10],
	maj7: [0, 4, 7, 11],
	"5": [0, 7, 12],
};

function pitchClass(letter: string, accidental: string): number {
	const base = PITCH_CLASS[letter];
	if (base === undefined) throw new Error(`音名が不正: ${letter}`);
	const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
	return (base + shift + 12) % 12;
}

/** "C#5" のような音名を MIDI ノート番号にする（C4 = 60） */
export function noteToMidi(name: string): number {
	const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
	if (!m) throw new Error(`音名が不正: ${name}`);
	const [, letter = "", accidental = "", octave = ""] = m;
	const pc = pitchClass(letter, accidental);
	// B#・Cb のようにオクターブをまたぐ表記は使わない前提
	return (Number(octave) + 1) * 12 + pc;
}

/** コード名を、ルートを G3〜F#4 に置いた構成音にする */
export function chordToMidi(name: string): number[] {
	const m = /^([A-G])([#b]?)(.*)$/.exec(name);
	const quality = m ? CHORD_QUALITY[m[3] ?? ""] : undefined;
	if (!m || !quality) throw new Error(`コード名が不正: ${name}`);
	const pc = pitchClass(m[1] ?? "", m[2] ?? "");
	const root = 55 + ((pc - 7 + 12) % 12);
	return quality.map((i) => root + i);
}

/** コードのルート音を、ベース用に C3〜B3 に置く */
function bassRoot(chord: number[]): number {
	const root = chord[0] ?? 48;
	return 48 + (root % 12);
}

function parsePhrase(src: string, where: string): Map<number, number> {
	const notes = new Map<number, number>();
	for (const token of src.trim().split(/\s+/)) {
		const [stepText = "", name = ""] = token.split(":");
		const step = Number(stepText);
		if (!Number.isInteger(step) || step < 0 || step >= BAR_STEPS * 2) {
			throw new Error(`${where} のステップが不正: ${token}`);
		}
		notes.set(step, noteToMidi(name));
	}
	return notes;
}

function parseSection(src: string, where: string): number[][] {
	const bars = src.trim().split(/\s+/);
	if (bars.length !== SECTION_BARS) {
		throw new Error(`${where} のコードは ${SECTION_BARS} 小節ぶん必要: ${src}`);
	}
	const steps: number[][] = [];
	for (const bar of bars) {
		const names = bar.split("-");
		if (names.length > 2)
			throw new Error(`${where} の 1 小節のコードは 2 つまで: ${bar}`);
		const chords = names.map(chordToMidi);
		for (let i = 0; i < BAR_STEPS; i++) {
			const half = names.length === 2 && i >= BAR_STEPS / 2 ? 1 : 0;
			steps.push(chords[half] ?? []);
		}
	}
	return steps;
}

export function compileSong(src: SongSource): Song {
	const sectionChords = {
		A: parseSection(src.chords.A, `${src.id} の A`),
		B: parseSection(src.chords.B, `${src.id} の B`),
	};
	const chords: number[][] = [];
	const melody = new Map<number, number>();
	ORDER.forEach((key, i) => {
		const offset = i * BAR_STEPS * 2;
		// 各フレーズは 2 小節。所属するメロのコード 4 小節のうち、前半か後半かを使う
		const section = sectionChords[key[0] === "A" ? "A" : "B"];
		const half = key.endsWith("1") ? 0 : BAR_STEPS * 2;
		chords.push(...section.slice(half, half + BAR_STEPS * 2));
		for (const [step, note] of parsePhrase(
			src.phrases[key],
			`${src.id} の ${key}`,
		)) {
			melody.set(offset + step, note);
		}
	});

	const bass = new Map<number, [number, number]>();
	for (let bar = 0; bar < chords.length / BAR_STEPS; bar++) {
		for (const [step, interval, len] of src.bassPattern) {
			const at = bar * BAR_STEPS + step;
			const chord = chords[at] ?? [];
			bass.set(at, [bassRoot(chord) + interval, len]);
		}
	}

	return {
		id: src.id,
		name: src.name,
		mood: src.mood,
		lead: src.lead,
		comp: src.comp,
		perc: src.perc,
		bassKind: src.bassKind,
		swing: src.swing,
		steps: chords.length,
		chords,
		melody,
		bass,
	};
}

const SOURCES: SongSource[] = [
	{
		id: "pop",
		name: "ハッピーポップ",
		mood: "明るく跳ねるマリンバ",
		lead: "marimba",
		comp: "stab",
		perc: "pop",
		bassKind: "pluck",
		swing: 0,
		chords: { A: "C G Am F-G", B: "F G Em-Am Dm-G" },
		phrases: {
			A1: "0:E5 2:G5 3:A5 4:G5 6:E5 8:C5 10:D5 11:E5 14:G5 16:B4 18:D5 19:G5 20:F5 22:D5 24:B4 26:D5 28:E5 30:D5",
			A2: "0:C5 2:E5 3:A5 4:G5 6:E5 8:A4 10:C5 11:E5 12:D5 14:C5 16:A4 18:C5 20:F5 22:E5 24:D5 26:B4 28:D5 30:G5",
			B1: "0:A5 2:C6 4:A5 6:F5 8:G5 10:A5 12:G5 14:F5 16:G5 18:B5 20:D6 22:B5 24:A5 26:G5 28:F5 30:D5",
			B2: "0:E5 2:G5 4:B5 6:G5 8:A5 10:C6 12:B5 14:A5 16:F5 18:A5 20:D6 22:C6 24:B5 26:A5 28:G5 30:D5",
		},
		bassPattern: [
			[0, 0, 2],
			[3, 12, 1],
			[6, 7, 2],
			[8, 0, 1],
			[10, 12, 1],
			[11, 7, 2],
			[14, 7, 2],
		],
	},
	{
		id: "tropical",
		name: "トロピカル",
		mood: "南国のスチールドラム",
		lead: "steel",
		comp: "stab",
		perc: "tropical",
		bassKind: "pluck",
		swing: 0,
		chords: { A: "F C Dm Bb-C", B: "Bb C Am-Dm Gm-C" },
		phrases: {
			A1: "0:C5 3:F5 6:A5 8:G5 10:F5 11:G5 14:A5 16:G5 19:E5 22:C5 24:D5 26:E5 27:G5 30:E5",
			A2: "0:D5 3:F5 6:A5 8:C6 10:A5 11:F5 14:A5 16:A#5 18:A5 19:F5 22:D5 24:E5 26:G5 28:C6 30:G5",
			B1: "0:D6 2:C6 3:A#5 6:F5 8:A#5 10:C6 11:D6 14:C6 16:E5 18:G5 19:C6 22:G5 24:A5 26:A#5 28:C6 30:G5",
			B2: "0:C6 2:A5 3:E5 6:A5 8:D6 10:A5 11:F5 14:A5 16:A#5 18:G5 19:D5 22:G5 24:E5 26:G5 27:A#5 30:C6",
		},
		// 3・3・2 で跳ねる
		bassPattern: [
			[0, 0, 2],
			[3, 0, 2],
			[6, 7, 2],
			[8, 0, 2],
			[11, 12, 2],
			[14, 7, 2],
		],
	},
	{
		id: "chip",
		name: "ピコピコ",
		mood: "8bit のゲーム音楽",
		lead: "chip",
		comp: "arp",
		perc: "chip",
		bassKind: "chip",
		swing: 0,
		chords: { A: "Am F C G", B: "F G Em Am-E" },
		phrases: {
			A1: "0:A5 2:E5 4:A5 6:B5 8:C6 10:B5 12:A5 14:E5 16:F5 18:A5 20:C6 22:A5 24:G5 26:F5 28:E5 30:C5",
			A2: "0:E5 2:G5 4:C6 6:G5 8:E5 10:G5 11:A5 12:G5 14:E5 16:D5 18:G5 20:B5 22:D6 24:B5 26:G5 28:D5 30:B4",
			B1: "0:C6 1:A5 2:F5 4:A5 6:C6 8:F6 10:E6 12:C6 14:A5 16:B5 17:G5 18:D5 20:G5 22:B5 24:D6 26:C6 28:B5 30:G5",
			B2: "0:B5 2:G5 4:E5 6:G5 8:B5 10:E6 12:D6 14:B5 16:C6 18:A5 20:E5 22:A5 24:G#5 26:B5 28:E6 30:B5",
		},
		// オクターブを行き来する 8 分
		bassPattern: [
			[0, 0, 2],
			[2, 12, 2],
			[4, 0, 2],
			[6, 12, 2],
			[8, 0, 2],
			[10, 12, 2],
			[12, 0, 2],
			[14, 7, 2],
		],
	},
	{
		id: "funk",
		name: "ファンキー",
		mood: "ノリノリのブラスとベース",
		lead: "brass",
		comp: "stab",
		perc: "funk",
		bassKind: "pluck",
		swing: 0,
		chords: { A: "Dm7 G7 Dm7 G7", B: "Bbmaj7 C7 Am7 Em7-A7" },
		phrases: {
			A1: "0:D5 3:F5 4:D5 6:C5 8:A4 11:C5 14:D5 16:F5 19:G5 20:F5 22:D5 24:B4 27:D5 30:F5",
			A2: "0:A5 3:G5 4:F5 6:D5 8:F5 10:G5 11:A5 14:C6 16:B5 19:A5 20:G5 22:F5 24:D5 27:F5 28:E5 30:D5",
			B1: "0:D6 2:C6 3:A#5 6:A5 8:F5 11:A5 14:A#5 16:C6 18:A#5 19:G5 22:E5 24:G5 27:A#5 30:C6",
			B2: "0:E6 2:C6 3:A5 6:G5 8:E5 11:G5 14:A5 16:G5 18:E5 19:B4 22:D5 24:C#5 26:E5 27:G5 30:A5",
		},
		bassPattern: [
			[0, 0, 1],
			[2, 12, 1],
			[3, 0, 1],
			[6, 7, 1],
			[7, 10, 1],
			[8, 12, 2],
			[11, 0, 1],
			[14, 10, 1],
			[15, 12, 1],
		],
	},
	{
		id: "lofi",
		name: "ゆったりローファイ",
		mood: "まったり揺れるエレピ",
		lead: "epiano",
		comp: "none",
		perc: "lofi",
		bassKind: "round",
		swing: 0.18,
		chords: { A: "Fmaj7 Em7-Am7 Dm7 Gm7-C7", B: "Bbmaj7 Am7 Gm7 C7" },
		phrases: {
			A1: "0:E5 4:F5 6:A5 10:G5 12:F5 16:E5 18:D5 20:E5 24:C5 26:E5 28:G5",
			A2: "0:F5 4:A5 6:C6 10:A5 12:G5 16:F5 18:D5 20:A#4 24:C5 26:E5 28:G5",
			B1: "0:D6 4:C6 6:A5 10:F5 12:A5 16:G5 18:E5 20:C5 24:E5 26:G5 28:A5",
			B2: "0:A#5 4:A5 6:F5 10:D5 12:F5 16:E5 18:G5 20:A#5 24:A5 26:G5 28:E5",
		},
		bassPattern: [
			[0, 0, 4],
			[6, 7, 2],
			[8, 0, 3],
			[14, 7, 2],
		],
	},
	{
		id: "march",
		name: "ごきげんマーチ",
		mood: "笛と小太鼓の行進",
		lead: "flute",
		comp: "stab",
		perc: "march",
		bassKind: "round",
		swing: 0,
		chords: { A: "G D G C-D", B: "C G Am-D G-D" },
		phrases: {
			A1: "0:D5 2:G5 4:B5 6:G5 8:D5 10:E5 11:F#5 12:G5 14:B5 16:A5 18:F#5 20:D5 22:F#5 24:A5 26:B5 27:A5 28:F#5 30:D5",
			A2: "0:B5 2:D6 4:B5 6:G5 8:A5 10:B5 12:G5 14:D5 16:E5 18:G5 20:C6 22:G5 24:F#5 26:A5 28:D6 30:C6",
			B1: "0:E6 2:D6 4:C6 6:G5 8:E5 10:G5 12:C6 14:E6 16:D6 18:B5 20:G5 22:D5 24:G5 26:B5 28:D6 30:B5",
			B2: "0:C6 2:A5 4:E5 6:A5 8:F#5 10:A5 12:D6 14:C6 16:B5 18:D6 20:G5 22:B5 24:A5 26:F#5 28:E5 30:F#5",
		},
		// ブン・チャッの行進
		bassPattern: [
			[0, 0, 2],
			[4, 7, 2],
			[8, 0, 2],
			[12, 7, 2],
		],
	},
	{
		id: "matsuri",
		name: "おまつり",
		mood: "笛と鉦のおまつり",
		lead: "flute",
		comp: "none",
		perc: "matsuri",
		bassKind: "round",
		swing: 0,
		chords: { A: "D5 D5 C5 D5", B: "Bb5 C5 D5 C5-A5" },
		phrases: {
			A1: "0:D5 2:F5 3:G5 4:A5 6:G5 8:F5 10:D5 12:C5 14:D5 16:F5 18:G5 20:A5 22:C6 24:A5 26:G5 28:F5 30:G5",
			A2: "0:C6 2:A5 3:G5 4:F5 6:G5 8:A5 10:G5 12:F5 14:C5 16:D5 18:F5 20:G5 22:F5 24:D5 26:C5 28:D5",
			B1: "0:D6 2:C6 3:A5 4:G5 6:A5 8:C6 10:D6 12:C6 14:A5 16:G5 18:A5 20:C6 22:A5 24:G5 26:F5 28:G5 30:A5",
			B2: "0:F6 2:D6 3:C6 4:A5 6:C6 8:D6 10:C6 12:A5 14:G5 16:A5 18:C6 20:G5 22:F5 24:E5 26:G5 28:A5 30:C6",
		},
		bassPattern: [
			[0, 0, 3],
			[4, 7, 2],
			[8, 0, 3],
			[12, 7, 2],
		],
	},
	{
		id: "rock",
		name: "ロックンロール",
		mood: "歪んだギターでかけぬける",
		lead: "saw",
		comp: "power",
		perc: "rock",
		bassKind: "pluck",
		swing: 0,
		chords: { A: "E5 E5 C5-D5 E5", B: "A5 A5 C5 D5" },
		phrases: {
			A1: "0:E5 2:G5 4:A5 6:B5 8:A5 10:G5 12:E5 14:D5 16:E5 18:E5 20:G5 22:B5 24:D6 26:B5 28:A5 30:G5",
			A2: "0:C6 2:B5 4:G5 6:E5 8:D6 10:C6 12:A5 14:F#5 16:G5 18:E5 20:B5 22:E5 24:G5 26:A5 28:B5 30:D6",
			B1: "0:E6 2:D6 4:C6 6:A5 8:C6 10:D6 12:E6 14:E6 16:D6 18:C6 20:A5 22:E5 24:G5 26:A5 28:C6 30:A5",
			B2: "0:E6 2:C6 4:G5 6:C6 8:E6 10:D6 12:C6 14:G5 16:F#5 18:A5 20:D6 22:A5 24:F#5 26:D5 28:E5 30:F#5",
		},
		// 8 分で刻み続ける
		bassPattern: [
			[0, 0, 2],
			[2, 0, 2],
			[4, 0, 2],
			[6, 0, 2],
			[8, 0, 2],
			[10, 0, 2],
			[12, 0, 2],
			[14, 12, 2],
		],
	},
	{
		id: "neon",
		name: "ネオンナイト",
		mood: "きらめくシンセの夜",
		lead: "saw",
		comp: "arp",
		perc: "pop",
		bassKind: "pluck",
		swing: 0,
		chords: { A: "Cm Ab Eb Bb", B: "Fm Ab Cm G" },
		phrases: {
			A1: "0:G5 3:D#5 4:C5 6:D#5 8:G5 11:A#5 12:G5 14:D#5 16:G#5 19:G5 20:D#5 22:C5 24:D#5 27:F5 28:G5 30:G#5",
			A2: "0:G5 3:A#5 4:G5 6:D#5 8:A#5 11:C6 12:A#5 14:G5 16:F5 19:D5 20:A#4 22:D5 24:F5 27:G5 28:F5 30:D5",
			B1: "0:C6 3:G#5 4:F5 6:G#5 8:C6 11:D#6 12:C6 14:G#5 16:D#6 19:C6 20:G#5 22:D#5 24:G#5 27:C6 28:D#6 30:C6",
			B2: "0:D#6 3:D6 4:C6 6:G5 8:D#5 11:G5 12:C6 14:D#6 16:D6 19:B5 20:G5 22:D5 24:F5 27:G5 28:B5 30:D6",
		},
		// 8 分で脈打つ
		bassPattern: [
			[0, 0, 2],
			[2, 12, 2],
			[4, 0, 2],
			[6, 12, 2],
			[8, 0, 2],
			[10, 12, 2],
			[12, 0, 2],
			[14, 12, 2],
		],
	},
];

export const SONGS: Song[] = SOURCES.map(compileSong);

/** タイトル画面の選択肢。曲 ID のほか、遊ぶたびに曲を選ぶ「ランダム」がある */
export const RANDOM_SONG = "random";

/** タイトル画面でランダムを選んでいるときの表示 */
export const RANDOM_LABEL = {
	name: "ランダム",
	mood: `遊ぶたびに ${SOURCES.length} 曲からえらぶ`,
};

export function findSong(id: string): Song {
	const song = SONGS.find((s) => s.id === id) ?? SONGS[0];
	if (!song) throw new Error("曲データが 1 曲もない");
	return song;
}

/** 選択肢（曲 ID または RANDOM_SONG）から、実際に遊ぶ曲を決める */
export function pickSong(choice: string): Song {
	if (choice !== RANDOM_SONG) return findSong(choice);
	const song = SONGS[Math.floor(Math.random() * SONGS.length)];
	if (!song) throw new Error("曲データが 1 曲もない");
	return song;
}
