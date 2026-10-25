import type { PadId } from "./rhythm";

export const W = 420;
export const H = 820;

export const FONT = '"Zen Maru Gothic", "Hiragino Sans", sans-serif';
export const MONO = '"DM Mono", "SF Mono", Menlo, monospace';

export const C = {
	bg: 0xfff5f7,
	card: 0xffffff,
	border: 0xf5d5dc,
	text: 0x3d2040,
	textMid: 0x7a5a7e,
	textDim: 0xb094b4,
	sky: 0xdff3ff,
	skyFever: 0xfff1c9,
	hillBack: 0xc8ecd9,
	hillFront: 0xa6e0c2,
	ground: 0xf6dcb4,
	groundLine: 0xe8c393,
	fever: 0xffd23f,
	crewTurn: 0xe0f8f6,
} as const;

export const PAD_COLOR: Record<PadId, { base: number; strong: number }> = {
	don: { base: 0xff7eb3, strong: 0xe8609a },
	shaka: { base: 0x5cdbd3, strong: 0x33bfb6 },
	poko: { base: 0xffc078, strong: 0xf5a347 },
};

export const PAD_ORDER: PadId[] = ["don", "shaka", "poko"];

export const PAD_LABEL: Record<PadId, string> = {
	don: "ドン",
	shaka: "シャカ",
	poko: "ポコ",
};

export const CHANT: Record<PadId, { hit: string; finish: string }> = {
	don: { hit: "ドンドコ", finish: "ドンドコドーン！" },
	shaka: { hit: "シャンシャカ", finish: "シャンシャカシャーン！" },
	poko: { hit: "ポコポコ", finish: "ポコポコポン！" },
};

export const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
