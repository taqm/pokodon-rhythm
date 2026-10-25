// VOICEVOX エンジンで配役ごとの掛け声を生成し、src/voice/ に wav・manifest.json・index.ts を書き出す。
// 実行: VOICEVOX エンジンを起動してから `bun run voice`
import { readdir, unlink } from "node:fs/promises";
import { BPM, type PadId } from "../src/rhythm";
import {
	VOICE_CAST,
	VOICE_LINES,
	type VoiceKind,
	type VoiceManifest,
	voiceKey,
} from "../src/voiceLines";

const ENGINE = process.env.VOICEVOX_URL ?? "http://127.0.0.1:50121";
const OUT = new URL("../src/voice/", import.meta.url).pathname;
const BEAT = 60 / BPM;
/** 子音はこの長さまでに詰める。長いと母音（拍の位置）が遅れて聞こえる */
const MAX_CONSONANT = 0.045;
/** 掛け声の種類ごとの音程の動き（null は VOICEVOX の抑揚のまま） */
const PITCH_CONTOUR: Record<VoiceKind, { from: number; step: number } | null> =
	{
		hit: null,
		rise: { from: 0, step: 0.08 },
		finish: { from: 0.3, step: 0.1 },
	};

interface Mora {
	text: string;
	consonant_length: number | null;
	vowel_length: number;
	pitch: number;
}
interface AudioQuery {
	accent_phrases: { moras: Mora[]; pause_mora: Mora | null }[];
	speedScale: number;
	pitchScale: number;
	intonationScale: number;
	volumeScale: number;
	prePhonemeLength: number;
	postPhonemeLength: number;
	outputSamplingRate: number;
}

async function api(path: string, init?: RequestInit): Promise<Response> {
	const res = await fetch(`${ENGINE}${path}`, init);
	if (!res.ok) {
		throw new Error(
			`VOICEVOX ${path} が失敗: ${res.status} ${await res.text()}`,
		);
	}
	return res;
}

const speakers = (await (await api("/speakers")).json()) as {
	name: string;
	styles: { name: string; id: number }[];
}[];

function findStyle(name: string, styleName: string): number {
	const style = speakers
		.find((s) => s.name === name)
		?.styles.find((s) => s.name === styleName);
	if (!style) {
		const names = speakers.map((s) => s.name).join(", ");
		throw new Error(`話者 ${name}/${styleName} が見つからない。候補: ${names}`);
	}
	return style.id;
}

async function synth(
	speaker: number,
	text: string,
	moraBeats: number[],
	kind: VoiceKind,
	pitchScale: number,
): Promise<{ wav: ArrayBuffer; lead: number; pitches: string[] }> {
	const q = (await (
		await api(
			`/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
			{ method: "POST" },
		)
	).json()) as AudioQuery;

	const moras = q.accent_phrases.flatMap((p) => {
		p.pause_mora = null;
		return p.moras;
	});
	if (moras.length !== moraBeats.length) {
		throw new Error(
			`「${text}」のモーラ数 ${moras.length} が指定 ${moraBeats.length} と合わない: ${moras.map((m) => m.text).join("/")}`,
		);
	}
	// 各モーラの「子音 + 母音」の長さを拍に合わせて固定し、リズムどおりに歌わせる
	moras.forEach((m, i) => {
		const total = (moraBeats[i] ?? 0.25) * BEAT;
		const c = Math.min(m.consonant_length ?? 0, MAX_CONSONANT);
		if (m.consonant_length !== null) m.consonant_length = c;
		m.vowel_length = total - c;
	});
	// 3 拍目は語尾に向けて音程を上げ、キメはその続きのさらに高いところから上げる。
	// pitch は対数周波数なので 0.1 でおよそ半音 1.7 個ぶん
	const top = Math.max(...moras.map((m) => m.pitch));
	const contour = PITCH_CONTOUR[kind];
	if (contour) {
		moras.forEach((m, i) => {
			if (m.pitch > 0) m.pitch = top + contour.from + contour.step * i;
		});
	}
	q.speedScale = 1;
	q.pitchScale = pitchScale;
	q.intonationScale = 1.4;
	q.volumeScale = 1.3;
	q.prePhonemeLength = 0;
	q.postPhonemeLength = 0.08;
	q.outputSamplingRate = 24000;

	const wav = await (
		await api(`/synthesis?speaker=${speaker}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(q),
		})
	).arrayBuffer();
	const pitches = moras.map(
		(m) => `${m.text}:${Math.round(Math.exp(m.pitch))}Hz`,
	);
	return { wav, lead: moras[0]?.consonant_length ?? 0, pitches };
}

// 配役を変えたときに古いファイルが残らないよう、先に消す
for (const f of await readdir(OUT)) {
	if (f.endsWith(".wav")) await unlink(`${OUT}${f}`);
}

const manifest: VoiceManifest = {};
for (const member of VOICE_CAST) {
	const speaker = findStyle(member.speaker, member.style);
	console.log(
		`${member.role}: ${member.speaker}/${member.style} (id=${speaker})`,
	);
	for (const [pad, line] of Object.entries(VOICE_LINES) as [
		PadId,
		(typeof VOICE_LINES)[PadId],
	][]) {
		const jobs: [VoiceKind, string, number[]][] = [
			["hit", line.hit, line.hitMoras],
			["rise", line.hit, line.hitMoras],
			["finish", line.finish, line.finishMoras],
		];
		for (const [kind, text, moraBeats] of jobs) {
			const { wav, lead, pitches } = await synth(
				speaker,
				text,
				moraBeats,
				kind,
				member.pitchScale,
			);
			const key = voiceKey(member.role, pad, kind);
			await Bun.write(`${OUT}${key}.wav`, wav);
			manifest[key] = { lead: Number(lead.toFixed(4)) };
			console.log(`  ${key}.wav 「${text}」 ${pitches.join(" ")}`);
		}
	}
}
await Bun.write(
	`${OUT}manifest.json`,
	`${JSON.stringify(manifest, null, 2)}\n`,
);

// ゲームから読む index.ts も生成する（wav を import してバンドラに URL を振らせる）
const keys = Object.keys(manifest);
const credits = [...new Set(VOICE_CAST.map((m) => `VOICEVOX:${m.speaker}`))];
const index = [
	"// scripts/gen-voice.ts が生成する。手で編集しない",
	'import type { VoiceManifest } from "../voiceLines";',
	'import manifest from "./manifest.json";',
	...keys.map((k, i) => `import v${i} from "./${k}.wav";`),
	"",
	"export const VOICE_URLS: Record<string, string> = {",
	...keys.map((k, i) => `\t"${k}": v${i},`),
	"};",
	"",
	"export const VOICE_MANIFEST: VoiceManifest = manifest;",
	"",
	`export const VOICE_CREDITS: string[] = ${JSON.stringify(credits)};`,
	"",
].join("\n");
await Bun.write(`${OUT}index.ts`, index);
console.log(`クレジット: ${credits.join("、")}`);
