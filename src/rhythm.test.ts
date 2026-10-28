import { describe, expect, test } from "bun:test";
import { FEVER_COMBO, GOOD_WINDOW, RhythmState } from "./rhythm";

const BEAT = 0.5;
const at = (bar: number, beat: number, offset = 0) =>
	(bar * 4 + beat) * BEAT + offset;

describe("RhythmState", () => {
	test("同じパッド 3 拍でそろうとコンボが増える", () => {
		const r = new RhythmState(BEAT);
		expect(r.tap("don", at(0, 0)).complete).toBeNull();
		expect(r.tap("don", at(0, 1, 0.03)).judge).toBe("perfect");
		const last = r.tap("don", at(0, 2, -0.1));
		expect(last.judge).toBe("good");
		expect(last.complete).toEqual(["don", "don", "don"]);
		expect(r.combo).toBe(1);
	});

	test("異なるパッドの組み合わせでもそろえば成立する", () => {
		const r = new RhythmState(BEAT);
		r.tap("don", at(0, 0));
		r.tap("shaka", at(0, 1));
		expect(r.tap("shaka", at(0, 2)).complete).toEqual([
			"don",
			"shaka",
			"shaka",
		]);
	});

	test("休符の拍で押すとミスになりコンボが切れる", () => {
		const r = new RhythmState(BEAT);
		for (const b of [0, 1, 2]) r.tap("poko", at(0, b));
		const rest = r.tap("poko", at(0, 3));
		expect(rest.judge).toBe("miss");
		expect(rest.broke).toBe(true);
		expect(r.combo).toBe(0);
	});

	test("タイミングが外れるとミス", () => {
		const r = new RhythmState(BEAT);
		const res = r.tap("don", at(0, 0, 0.2));
		expect(res.judge).toBe("miss");
		expect(res.broke).toBe(true);
	});

	test("同じ拍での二度押しはミス", () => {
		const r = new RhythmState(BEAT);
		r.tap("don", at(0, 0));
		const res = r.tap("don", at(0, 0, 0.05));
		expect(res.judge).toBe("miss");
		expect(res.broke).toBe(true);
	});

	test("0 拍目を休んで 1・2 拍目でもそろう", () => {
		const r = new RhythmState(BEAT);
		r.tap("don", at(0, 1));
		const res = r.tap("shaka", at(0, 2));
		expect(res.broke).toBe(false);
		expect(res.complete).toEqual([null, "don", "shaka"]);
		expect(r.combo).toBe(1);
	});

	test("1 拍目を休んで 0・2 拍目でもそろう", () => {
		const r = new RhythmState(BEAT);
		r.tap("poko", at(0, 0));
		const res = r.tap("poko", at(0, 2));
		expect(res.broke).toBe(false);
		expect(res.complete).toEqual(["poko", null, "poko"]);
		expect(r.combo).toBe(1);
	});

	test("2 拍目だけではそろわずコンボが切れる", () => {
		const r = new RhythmState(BEAT);
		for (const b of [0, 1, 2]) r.tap("don", at(0, b));
		r.tick(at(1, 3.6));
		const res = r.tap("don", at(2, 2));
		expect(res.broke).toBe(true);
		expect(res.complete).toBeNull();
		expect(r.combo).toBe(0);
	});

	test("2 拍目を休んで 0・1 拍目でも、2 拍目の判定幅を過ぎるとそろう", () => {
		const r = new RhythmState(BEAT);
		r.tap("don", at(0, 0));
		r.tap("shaka", at(0, 1));
		// 2 拍目を叩く可能性が残っているうちはまだ成立させない
		expect(r.settle(at(0, 2, GOOD_WINDOW))).toBeNull();
		expect(r.settle(at(0, 2, GOOD_WINDOW + 0.01))).toEqual({
			bar: 0,
			pads: ["don", "shaka", null],
		});
		expect(r.combo).toBe(1);
		// 成立は 1 回だけで、小節の終わりにコンボは切れない
		expect(r.settle(at(0, 3))).toBeNull();
		expect(r.tick(at(0, 3.6))).toEqual([]);
		expect(r.combo).toBe(1);
	});

	test("成立したあとに 2 拍目を遅れて叩くと二度押し扱いでミス", () => {
		const r = new RhythmState(BEAT);
		r.tap("don", at(0, 0));
		r.tap("don", at(0, 1));
		r.settle(at(0, 2, GOOD_WINDOW + 0.01));
		const late = r.tap("don", at(0, 2, 0.2));
		expect(late.judge).toBe("miss");
		expect(late.broke).toBe(true);
		expect(r.combo).toBe(0);
	});

	test("1 打だけではそろわず、小節の終わりでコンボが切れる", () => {
		const r = new RhythmState(BEAT);
		for (const b of [0, 1, 2]) r.tap("don", at(0, b));
		r.tick(at(1, 3.6));
		expect(r.tap("don", at(2, 0)).broke).toBe(false);
		expect(r.settle(at(2, 3))).toBeNull();
		expect(r.tick(at(2, 3.6))).toEqual([{ bar: 2, broke: true }]);
		expect(r.combo).toBe(0);
	});

	test("そろった次の小節は子分の番なので、叩かなくてもコンボは続く", () => {
		const r = new RhythmState(BEAT);
		for (const b of [0, 1, 2]) r.tap("don", at(0, b));
		expect(r.tick(at(1, 3.6))).toEqual([]);
		expect(r.combo).toBe(1);
	});

	test("子分の番のあとに叩かないとコンボが切れる", () => {
		const r = new RhythmState(BEAT);
		for (const b of [0, 1, 2]) r.tap("don", at(0, b));
		r.tick(at(1, 3.6));
		expect(r.tick(at(2, 3.4))).toEqual([]);
		expect(r.tick(at(2, 3.6))).toEqual([{ bar: 2, broke: true }]);
		expect(r.combo).toBe(0);
	});

	test("子分の番に叩くとミスでコンボが切れる", () => {
		const r = new RhythmState(BEAT);
		for (const b of [0, 1, 2]) r.tap("don", at(0, b));
		const res = r.tap("don", at(1, 0));
		expect(res.judge).toBe("miss");
		expect(res.interrupt).toBe(true);
		expect(res.broke).toBe(true);
		expect(r.tap("don", at(1, 1)).broke).toBe(false);
		expect(r.combo).toBe(0);
	});

	test("連続でそろえ続けるとフィーバーになる", () => {
		const r = new RhythmState(BEAT);
		for (let set = 0; set < FEVER_COMBO; set++) {
			const bar = set * 2;
			for (const b of [0, 1, 2]) r.tap("shaka", at(bar, b));
			r.tick(at(bar + 1, 3.6));
		}
		expect(r.fever).toBe(true);
	});

	test("次のセットの頭を少し早く押しても次の小節として扱う", () => {
		const r = new RhythmState(BEAT);
		for (const b of [0, 1, 2]) r.tap("don", at(0, b));
		r.tick(at(1, 3.4));
		const early = r.tap("don", at(2, 0, -0.05));
		expect(early.bar).toBe(2);
		expect(early.beat).toBe(0);
		expect(early.broke).toBe(false);
	});
});
