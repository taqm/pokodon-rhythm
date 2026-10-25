import { describe, expect, test } from "bun:test";
import {
	BAR_STEPS,
	chordToMidi,
	noteToMidi,
	pickSong,
	RANDOM_SONG,
	SONGS,
} from "./songs";

describe("曲データ", () => {
	test("音名とコード名を MIDI ノート番号にできる", () => {
		expect(noteToMidi("C4")).toBe(60);
		expect(noteToMidi("A#4")).toBe(70);
		expect(noteToMidi("Bb4")).toBe(70);
		expect(chordToMidi("Am")).toEqual([57, 60, 64]);
		expect(chordToMidi("G7")).toEqual([55, 59, 62, 65]);
		expect(() => chordToMidi("Hm")).toThrow();
	});

	test("全曲が 16 小節の 1 曲として展開できる", () => {
		expect(SONGS.length).toBe(9);
		for (const song of SONGS) {
			expect(song.steps).toBe(BAR_STEPS * 16);
			expect(song.chords.every((c) => c.length > 0)).toBe(true);
		}
	});

	test("ベースはドンの低域と重ならない高さに収まる", () => {
		for (const song of SONGS) {
			for (const [note] of song.bass.values()) {
				expect(note).toBeGreaterThanOrEqual(48);
			}
		}
	});

	test("メロディは掛け声の邪魔をしない高さに収まり、どのフレーズにも音がある", () => {
		for (const song of SONGS) {
			const notes = [...song.melody.values()];
			expect(Math.min(...notes)).toBeGreaterThanOrEqual(noteToMidi("G4"));
			expect(Math.max(...notes)).toBeLessThanOrEqual(noteToMidi("F6"));
			for (let phrase = 0; phrase < song.steps / (BAR_STEPS * 2); phrase++) {
				const from = phrase * BAR_STEPS * 2;
				const has = [...song.melody.keys()].some(
					(s) => s >= from && s < from + BAR_STEPS * 2,
				);
				expect(has).toBe(true);
			}
		}
	});

	test("ランダムを選ぶと、どれかの曲になる", () => {
		const ids = new Set(SONGS.map((s) => s.id));
		for (let i = 0; i < 20; i++) {
			expect(ids.has(pickSong(RANDOM_SONG).id)).toBe(true);
		}
		expect(pickSong("rock").id).toBe("rock");
	});
});
