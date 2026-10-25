import { describe, expect, test } from "bun:test";
import { clampVolume, volumeToGain } from "./volume";

describe("音量", () => {
	test("範囲外や不正な値は 0〜1 に収める", () => {
		expect(clampVolume(-0.5)).toBe(0);
		expect(clampVolume(1.5)).toBe(1);
		expect(clampVolume(Number.NaN)).toBe(1);
	});

	test("スライダーの値は 2 乗のゲインになる（最小で無音、最大で元の音量）", () => {
		expect(volumeToGain(0)).toBe(0);
		expect(volumeToGain(0.5)).toBe(0.25);
		expect(volumeToGain(1)).toBe(1);
	});
});
