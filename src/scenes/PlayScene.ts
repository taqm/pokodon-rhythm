import Phaser from "phaser";
import { BEAT_SEC, type Conductor } from "../conductor";
import { BeatBar } from "../objects/BeatBar";
import { Blob } from "../objects/Blob";
import {
	C,
	CHANT,
	FONT,
	H,
	hex,
	MONO,
	PAD_COLOR,
	PAD_LABEL,
	PAD_ORDER,
	W,
} from "../palette";
import { BEATS_PER_BAR, FEVER_COMBO, type Judge, type PadId } from "../rhythm";
import { CREW_ROLES } from "../voiceLines";

const CREW_SIZE = CREW_ROLES.length;

const GROUND_Y = 540;
const PAD_Y = 700;
const PAD_R = 58;
const PAD_X: Record<PadId, number> = { don: 75, shaka: 210, poko: 345 };
const KEYS: Record<string, PadId> = { j: "don", k: "shaka", l: "poko" };
const JUDGE_LABEL: Record<Judge, string> = {
	perfect: "PERFECT!",
	good: "GOOD",
	miss: "MISS",
};

interface Pad {
	id: PadId;
	view: Phaser.GameObjects.Container;
	face: Phaser.GameObjects.Graphics;
}

export class PlayScene extends Phaser.Scene {
	private conductor!: Conductor;
	private beatBar!: BeatBar;
	/** 子分。並び順は左から右で、音声の配役 crew0〜 と定位に対応する */
	private crew: { pad: PadId; blob: Blob }[] = [];
	private pads = new Map<PadId, Pad>();
	private bursts = new Map<
		PadId,
		Phaser.GameObjects.Particles.ParticleEmitter
	>();
	private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
	private skyFever!: Phaser.GameObjects.Rectangle;
	private ground!: Phaser.GameObjects.TileSprite;
	private clouds: Phaser.GameObjects.Container[] = [];
	private comboText!: Phaser.GameObjects.Text;
	private gaugeFill!: Phaser.GameObjects.Graphics;
	private gauge = { ratio: 0 };
	private feverText!: Phaser.GameObjects.Text;
	private chantText!: Phaser.GameObjects.Text;
	private judgeText!: Phaser.GameObjects.Text;
	private playerText!: Phaser.GameObjects.Text;
	private frame!: Phaser.GameObjects.Graphics;
	private menu!: Phaser.GameObjects.Container;
	private offsetText!: Phaser.GameObjects.Text;

	private lastBeat = -1;
	private chantBar = -1;
	private responseBar = Number.NaN;
	private shownCombo = 0;
	private wasFever = false;
	/** 聞こえる瞬間に出したい演出。at は曲の時刻（秒） */
	private pending: { at: number; fn: () => void }[] = [];
	private detach: (() => void) | null = null;

	constructor() {
		super("play");
	}

	init(data: { conductor: Conductor }): void {
		this.conductor = data.conductor;
		this.lastBeat = -1;
		this.chantBar = -1;
		this.responseBar = Number.NaN;
		this.shownCombo = 0;
		this.wasFever = false;
		this.pending = [];
		this.crew = [];
		this.pads.clear();
		this.bursts.clear();
		this.clouds = [];
	}

	create(): void {
		this.makeTextures();
		this.makeBackground();
		this.makeHud();
		this.beatBar = new BeatBar(this, 30, 128, W - 60, 56);
		this.makeCrew();
		this.makeTexts();
		this.makePads();
		this.makeEffects();
		this.makeMenu();
		this.attachInput();
		this.events.once("shutdown", () => {
			this.detach?.();
			this.conductor.stop();
		});
	}

	// ---------- 構築 ----------

	private makeTextures(): void {
		if (this.textures.exists("dot")) return;
		const g = this.make.graphics({}, false);
		g.fillStyle(0xffffff, 1);
		g.fillCircle(8, 8, 8);
		g.generateTexture("dot", 16, 16);
		g.clear();

		const pts: Phaser.Math.Vector2[] = [];
		for (let i = 0; i < 10; i++) {
			const r = i % 2 === 0 ? 11 : 5;
			const a = (Math.PI / 5) * i - Math.PI / 2;
			pts.push(
				new Phaser.Math.Vector2(12 + Math.cos(a) * r, 12 + Math.sin(a) * r),
			);
		}
		g.fillStyle(0xffffff, 1);
		g.fillPoints(pts, true);
		g.generateTexture("star", 24, 24);
		g.clear();

		g.fillStyle(0xffffff, 1);
		g.fillRect(0, 0, 8, 14);
		g.generateTexture("chip", 8, 14);
		g.clear();

		g.fillStyle(C.ground, 1);
		g.fillRect(0, 0, 80, 40);
		g.fillStyle(C.groundLine, 1);
		g.fillRect(0, 0, 80, 4);
		g.fillRoundedRect(20, 18, 24, 6, 3);
		g.generateTexture("ground", 80, 40);
		g.destroy();
	}

	private makeBackground(): void {
		this.cameras.main.setBackgroundColor(C.bg);
		this.add.rectangle(0, 0, W, GROUND_Y, C.sky).setOrigin(0);
		this.skyFever = this.add
			.rectangle(0, 0, W, GROUND_Y, C.skyFever)
			.setOrigin(0)
			.setAlpha(0);

		for (let i = 0; i < 3; i++) {
			const cloud = this.add.container(80 + i * 150, 230 + (i % 2) * 50);
			cloud.add([
				this.add.ellipse(0, 0, 70, 34, 0xffffff),
				this.add.ellipse(26, -10, 50, 36, 0xffffff),
				this.add.ellipse(-24, 4, 44, 26, 0xffffff),
			]);
			cloud.setAlpha(0.9);
			this.clouds.push(cloud);
		}

		this.add.ellipse(80, GROUND_Y + 10, 380, 150, C.hillBack);
		this.add.ellipse(380, GROUND_Y + 20, 360, 130, C.hillFront);
		this.ground = this.add
			.tileSprite(0, GROUND_Y, W, 40, "ground")
			.setOrigin(0, 0);
		this.add
			.rectangle(0, GROUND_Y + 40, W, H - GROUND_Y - 40, C.bg)
			.setOrigin(0);
	}

	private makeHud(): void {
		const card = this.add.graphics();
		card.fillStyle(C.card, 1);
		card.fillRoundedRect(16, 20, W - 32, 60, 30);

		this.comboText = this.add
			.text(48, 50, "0", {
				fontFamily: MONO,
				fontSize: "30px",
				fontStyle: "500",
				color: hex(C.text),
			})
			.setOrigin(0.5);
		this.add
			.text(70, 52, "COMBO", {
				fontFamily: MONO,
				fontSize: "12px",
				color: hex(C.textMid),
			})
			.setOrigin(0, 0.5);

		const gx = 130;
		const gw = W - 32 - gx - 52;
		const track = this.add.graphics();
		track.fillStyle(C.bg, 1);
		track.fillRoundedRect(gx, 43, gw, 14, 7);
		this.gaugeFill = this.add.graphics({ x: gx, y: 43 });
		this.gaugeFill.setData("max", gw);
		this.drawGauge();

		const menuBtn = this.add.container(W - 44, 50);
		const mb = this.add.circle(0, 0, 22, C.bg);
		const dots = this.add.graphics();
		dots.fillStyle(C.textMid, 1);
		for (const dx of [-8, 0, 8]) dots.fillCircle(dx, 0, 3);
		menuBtn.add([mb, dots]);
		mb.setInteractive({ useHandCursor: true });
		mb.on("pointerup", () => this.openMenu(true));
	}

	private makeCrew(): void {
		const sizes: Record<PadId, [number, number]> = {
			don: [64, 56],
			shaka: [56, 66],
			poko: [54, 50],
		};
		// 6 人を前後 2 列に互い違いで並べる。後列は少し小さく奥に置く
		for (let i = 0; i < CREW_SIZE; i++) {
			const pad = PAD_ORDER[i % PAD_ORDER.length] ?? "don";
			const back = i % 2 === 1;
			const [w, h] = sizes[pad];
			const k = back ? 0.82 : 1;
			const blob = new Blob(
				this,
				W / 2 + (i - (CREW_SIZE - 1) / 2) * 58,
				GROUND_Y + (back ? -10 : 8),
				PAD_COLOR[pad].base,
				w * k,
				h * k,
			);
			blob.setDepth(back ? 1 : 2);
			this.crew.push({ pad, blob });
		}
	}

	private makeTexts(): void {
		this.feverText = this.add
			.text(W / 2, 236, "FEVER!", {
				fontFamily: MONO,
				fontSize: "30px",
				fontStyle: "500",
				color: hex(PAD_COLOR.poko.strong),
				stroke: "#ffffff",
				strokeThickness: 6,
			})
			.setOrigin(0.5)
			.setAlpha(0);

		this.chantText = this.add
			.text(W / 2, 300, "", {
				fontFamily: FONT,
				fontSize: "24px",
				fontStyle: "900",
				color: hex(C.text),
				stroke: "#ffffff",
				strokeThickness: 6,
				align: "center",
				wordWrap: { width: W - 40, useAdvancedWrap: true },
				lineSpacing: 4,
			})
			.setOrigin(0.5);

		this.playerText = this.add
			.text(W / 2, 182, "", {
				fontFamily: FONT,
				fontSize: "16px",
				fontStyle: "700",
				color: hex(C.textMid),
			})
			.setOrigin(0.5);

		this.judgeText = this.add
			.text(W / 2, 400, "", {
				fontFamily: MONO,
				fontSize: "20px",
				fontStyle: "500",
				stroke: "#ffffff",
				strokeThickness: 5,
			})
			.setOrigin(0.5);

		this.frame = this.add.graphics().setAlpha(0);
	}

	private makePads(): void {
		for (const id of PAD_ORDER) {
			const view = this.add.container(PAD_X[id], PAD_Y);
			const shadow = this.add.circle(0, 6, PAD_R, C.text, 0.15);
			const face = this.add.graphics();
			this.drawPad(face, id, false);
			const label = this.add
				.text(0, -4, PAD_LABEL[id], {
					fontFamily: FONT,
					fontSize: "20px",
					fontStyle: "900",
					color: "#ffffff",
				})
				.setOrigin(0.5);
			const key = Object.entries(KEYS).find(([, p]) => p === id)?.[0] ?? "";
			const hint = this.add
				.text(0, 22, key.toUpperCase(), {
					fontFamily: MONO,
					fontSize: "12px",
					color: "#ffffff",
				})
				.setOrigin(0.5)
				.setAlpha(0.8);
			if (!this.sys.game.device.input.touch) hint.setVisible(true);
			else hint.setVisible(false);
			view.add([shadow, face, label, hint]);
			this.pads.set(id, { id, view, face });
		}
	}

	private drawPad(
		g: Phaser.GameObjects.Graphics,
		id: PadId,
		down: boolean,
	): void {
		g.clear();
		g.fillStyle(down ? PAD_COLOR[id].strong : PAD_COLOR[id].base, 1);
		g.fillCircle(0, down ? 4 : 0, PAD_R);
		g.fillStyle(0xffffff, down ? 0.1 : 0.25);
		g.fillEllipse(
			-PAD_R * 0.3,
			-PAD_R * 0.45 + (down ? 4 : 0),
			PAD_R * 0.7,
			PAD_R * 0.3,
		);
	}

	private makeEffects(): void {
		for (const id of PAD_ORDER) {
			const emitter = this.add.particles(0, 0, "dot", {
				speed: { min: 120, max: 320 },
				angle: { min: 0, max: 360 },
				scale: { start: 0.9, end: 0 },
				lifespan: 500,
				gravityY: 400,
				tint: PAD_COLOR[id].base,
				emitting: false,
			});
			emitter.setDepth(5);
			this.bursts.set(id, emitter);
		}
		this.confetti = this.add.particles(0, -20, "chip", {
			x: { min: 0, max: W },
			speedY: { min: 120, max: 220 },
			speedX: { min: -40, max: 40 },
			rotate: { start: 0, end: 540 },
			lifespan: 4000,
			frequency: 70,
			tint: [
				PAD_COLOR.don.base,
				PAD_COLOR.shaka.base,
				PAD_COLOR.poko.base,
				C.fever,
			],
			emitting: false,
		});
		this.confetti.setDepth(4);
	}

	private makeMenu(): void {
		this.menu = this.add.container(0, 0).setDepth(100).setVisible(false);
		const dim = this.add.rectangle(0, 0, W, H, C.text, 0.4).setOrigin(0);
		dim.setInteractive();
		const card = this.add.graphics();
		card.fillStyle(C.card, 1);
		card.fillRoundedRect(30, 250, W - 60, 300, 24);
		const title = this.add
			.text(W / 2, 290, "タイミング調整", {
				fontFamily: FONT,
				fontSize: "16px",
				fontStyle: "700",
				color: hex(C.text),
			})
			.setOrigin(0.5);
		const note = this.add
			.text(W / 2, 325, "早押しでミスになるならマイナス側へ", {
				fontFamily: FONT,
				fontSize: "12px",
				color: hex(C.textMid),
			})
			.setOrigin(0.5);
		this.offsetText = this.add
			.text(W / 2, 390, "", {
				fontFamily: MONO,
				fontSize: "20px",
				color: hex(C.text),
			})
			.setOrigin(0.5);
		this.menu.add([
			dim,
			card,
			title,
			note,
			this.offsetText,
			this.button(100, 390, 80, "-10", C.bg, hex(C.textMid), () =>
				this.shiftOffset(-10),
			),
			this.button(W - 100, 390, 80, "+10", C.bg, hex(C.textMid), () =>
				this.shiftOffset(10),
			),
			this.button(125, 490, 140, "タイトルへ", C.bg, hex(C.textMid), () =>
				this.scene.start("title"),
			),
			this.button(
				W - 125,
				490,
				140,
				"とじる",
				PAD_COLOR.don.base,
				"#ffffff",
				() => this.openMenu(false),
			),
		]);
	}

	private button(
		x: number,
		y: number,
		w: number,
		label: string,
		bg: number,
		color: string,
		onClick: () => void,
	): Phaser.GameObjects.Container {
		const c = this.add.container(x, y);
		const g = this.add.graphics();
		g.fillStyle(bg, 1);
		g.fillRoundedRect(-w / 2, -24, w, 48, 24);
		const t = this.add
			.text(0, 0, label, {
				fontFamily: FONT,
				fontSize: "14px",
				fontStyle: "700",
				color,
			})
			.setOrigin(0.5);
		const hit = this.add
			.rectangle(0, 0, w, 48, 0, 0)
			.setInteractive({ useHandCursor: true });
		hit.on("pointerup", onClick);
		c.add([g, t, hit]);
		return c;
	}

	private openMenu(open: boolean): void {
		this.menu.setVisible(open);
		this.renderOffset();
	}

	private shiftOffset(ms: number): void {
		this.conductor.addOffset(ms);
		this.renderOffset();
	}

	private renderOffset(): void {
		const v = this.conductor.offsetMs;
		this.offsetText.setText(`${v > 0 ? "+" : ""}${v} ms`);
	}

	/**
	 * パッドは遅延を減らすため Phaser の入力キューを通さず、ネイティブイベントで直接受ける。
	 * マルチタッチも pointerdown が指ごとに来るのでそのまま扱える。
	 */
	private attachInput(): void {
		const canvas = this.game.canvas;
		const scale = this.scale;
		const down = (ev: PointerEvent) => {
			if (this.menu.visible) return;
			const x = scale.transformX(ev.pageX);
			const y = scale.transformY(ev.pageY);
			for (const id of PAD_ORDER) {
				if (Phaser.Math.Distance.Between(x, y, PAD_X[id], PAD_Y) <= PAD_R + 8) {
					ev.preventDefault();
					this.press(id, ev.timeStamp);
					return;
				}
			}
		};
		const key = (ev: KeyboardEvent) => {
			const id = KEYS[ev.key.toLowerCase()];
			if (!id || ev.repeat || this.menu.visible) return;
			this.press(id, ev.timeStamp);
		};
		canvas.addEventListener("pointerdown", down);
		window.addEventListener("keydown", key);
		this.detach = () => {
			canvas.removeEventListener("pointerdown", down);
			window.removeEventListener("keydown", key);
		};
	}

	// ---------- プレイ ----------

	private press(pad: PadId, timeStamp: number): void {
		const { synth, rhythm } = this.conductor;
		const res = rhythm.tap(pad, this.conductor.judgeTime(timeStamp));
		// 入力小節の 3 拍目は語尾が上がる掛け声にする
		synth.playerChant(pad, synth.ctx.currentTime, BEAT_SEC, res.beat === 2);

		this.animatePad(pad);
		this.bursts
			.get(pad)
			?.explode(res.judge === "perfect" ? 14 : 8, PAD_X[pad], PAD_Y - 20);
		this.showJudge(res.judge);
		if (res.interrupt) {
			if (res.broke) this.setPlayerLine("みんなの番だよ！");
		} else {
			this.beatBar.mark(
				res.beat,
				PAD_COLOR[pad].base,
				res.broke ? "miss" : res.judge,
			);
		}

		if (res.judge !== "miss" && !res.broke) {
			if (this.chantBar !== res.bar) {
				this.chantBar = res.bar;
				this.setPlayerLine("");
				this.setChant("");
			}
			const cur = this.playerText.text;
			const word = res.complete ? CHANT[pad].finish : CHANT[pad].hit;
			this.setPlayerLine(`${cur}${cur ? " " : ""}${word}`);
			if (res.complete) this.scheduleResponse(res.bar, res.complete);
		}
		if (res.broke) this.onBroke();
	}

	/**
	 * 入力がそろった小節の休符拍でプレイヤー側のキメを鳴らし、
	 * 次の小節で子分たちに同じリズムを歌い返させる。音は先に予約し、演出は聞こえる瞬間に出す。
	 */
	private scheduleResponse(bar: number, pads: PadId[]): void {
		const { synth, rhythm } = this.conductor;
		const fever = rhythm.fever;
		const last = pads[pads.length - 1] ?? "don";
		const unison = pads.every((p) => p === last);
		const beatAt = (b: number, beat: number) =>
			(b * BEATS_PER_BAR + beat) * BEAT_SEC;

		synth.playerFinish(last, this.conductor.audioTimeAt(beatAt(bar, 3)));
		this.responseBar = bar + 1;

		pads.forEach((p, i) => {
			const at = beatAt(bar + 1, i);
			const audioAt = this.conductor.audioTimeAt(at);
			synth.padPhrase(p, audioAt, BEAT_SEC);
			synth.crewChant(p, audioAt, BEAT_SEC, i === pads.length - 1);
			this.pending.push({ at, fn: () => this.onCrewBeat(p, i) });
		});
		const finishAt = beatAt(bar + 1, 3);
		const audioFinish = this.conductor.audioTimeAt(finishAt);
		synth.finisher(last, audioFinish, fever);
		synth.crewFinish(last, audioFinish, BEAT_SEC, fever);
		this.pending.push({
			at: finishAt,
			fn: () => this.onFinish(last, unison),
		});
	}

	private onCrewBeat(pad: PadId, beat: number): void {
		for (const c of this.crew) {
			if (c.pad !== pad) continue;
			c.blob.shout();
			c.blob.hop();
		}
		this.beatBar.mark(beat, PAD_COLOR[pad].base, "perfect");
		const cur = beat === 0 ? "" : this.chantText.text;
		this.setChant(`${cur}${cur ? " " : ""}${CHANT[pad].hit}`);
	}

	private onFinish(pad: PadId, unison: boolean): void {
		this.setChant(`${this.chantText.text} ${CHANT[pad].finish}`, true);
		this.beatBar.celebrate(PAD_COLOR[pad].base);
		const fever = this.conductor.rhythm.fever;
		for (const { pad: id, blob } of this.crew) {
			blob.shout();
			blob.hop();
			this.bursts.get(id)?.explode(fever ? 10 : 5, blob.x, blob.y - 40);
		}
		this.cameras.main.shake(120, fever ? 0.008 : 0.004);
		if (unison) {
			this.cameras.main.flash(160, 255, 228, 239);
		}
	}

	private setPlayerLine(text: string): void {
		this.playerText.setText(text);
		if (!text) return;
		this.tweens.killTweensOf(this.playerText);
		this.playerText.setScale(1.1);
		this.tweens.add({
			targets: this.playerText,
			scale: 1,
			duration: 160,
			ease: "Back.Out",
		});
	}

	private onBroke(): void {
		this.setChant("");
		this.responseBar = Number.NaN;
		for (const { blob } of this.crew) blob.droop();
		this.tweens.add({
			targets: this.chantText,
			x: { from: W / 2 - 8, to: W / 2 },
			duration: 240,
			ease: "Elastic.Out",
		});
	}

	private setChant(text: string, finish = false): void {
		this.chantText.setText(text);
		if (!text) return;
		this.tweens.killTweensOf(this.chantText);
		this.chantText.setScale(finish ? 1.25 : 1.08);
		this.chantText.setColor(finish ? hex(PAD_COLOR.don.strong) : hex(C.text));
		this.tweens.add({
			targets: this.chantText,
			scale: 1,
			duration: finish ? 380 : 180,
			ease: "Back.Out",
		});
	}

	private animatePad(pad: PadId): void {
		const p = this.pads.get(pad);
		if (!p) return;
		this.drawPad(p.face, pad, true);
		this.tweens.killTweensOf(p.view);
		p.view.setScale(0.92);
		this.tweens.add({
			targets: p.view,
			scale: 1,
			duration: 160,
			ease: "Back.Out",
			onComplete: () => this.drawPad(p.face, pad, false),
		});
	}

	private showJudge(judge: Judge): void {
		const t = this.judgeText;
		const color =
			judge === "perfect"
				? PAD_COLOR.don.strong
				: judge === "good"
					? PAD_COLOR.shaka.strong
					: C.textDim;
		t.setText(JUDGE_LABEL[judge]).setColor(hex(color));
		this.tweens.killTweensOf(t);
		t.setAlpha(1).setScale(1.4).setY(410);
		this.tweens.add({
			targets: t,
			scale: 1,
			y: 395,
			duration: 160,
			ease: "Back.Out",
		});
		this.tweens.add({ targets: t, alpha: 0, delay: 300, duration: 250 });
	}

	private onBeat(beatIndex: number): void {
		const beat = beatIndex % BEATS_PER_BAR;
		const fever = this.conductor.rhythm.fever;
		this.beatBar.pulse(beat);
		for (const { blob } of this.crew) blob.bounce(fever);

		const g = this.frame;
		g.clear();
		g.lineStyle(beat === 0 ? 14 : 8, fever ? C.fever : PAD_COLOR.don.base, 1);
		g.strokeRect(0, 0, W, H);
		this.tweens.killTweensOf(g);
		g.setAlpha(beat === BEATS_PER_BAR - 1 ? 0.25 : 0.6);
		this.tweens.add({ targets: g, alpha: 0, duration: 260 });

		if (fever) {
			this.tweens.add({
				targets: this.feverText,
				scale: { from: 1.2, to: 1 },
				duration: 200,
			});
		}
	}

	/** 角丸のゲージ。WebGL ではマスクが使えないので幅を変えて描き直す */
	private drawGauge(): void {
		const g = this.gaugeFill;
		const w = (g.getData("max") as number) * this.gauge.ratio;
		g.clear();
		if (w < 1) return;
		g.fillStyle(this.wasFever ? C.fever : PAD_COLOR.don.base, 1);
		g.fillRoundedRect(0, 0, Math.max(w, 14), 14, 7);
	}

	private renderCombo(): void {
		const { rhythm } = this.conductor;
		const fever = rhythm.fever;
		if (rhythm.combo !== this.shownCombo) {
			const up = rhythm.combo > this.shownCombo;
			this.shownCombo = rhythm.combo;
			this.comboText.setText(String(rhythm.combo));
			this.conductor.combo = rhythm.combo;
			if (up) {
				this.tweens.add({
					targets: this.comboText,
					scale: { from: 1.5, to: 1 },
					duration: 250,
					ease: "Back.Out",
				});
			}
			const ratio = Math.min(rhythm.combo / FEVER_COMBO, 1);
			this.tweens.add({
				targets: this.gauge,
				ratio,
				duration: 250,
				ease: "Quad.Out",
				onUpdate: () => this.drawGauge(),
			});
		}
		if (fever !== this.wasFever) {
			this.wasFever = fever;
			this.drawGauge();
			this.tweens.add({
				targets: this.skyFever,
				alpha: fever ? 1 : 0,
				duration: 400,
			});
			if (fever) {
				this.confetti.start();
				this.feverText.setAlpha(1).setScale(0);
				this.tweens.add({
					targets: this.feverText,
					scale: 1,
					duration: 400,
					ease: "Back.Out",
				});
			} else {
				this.confetti.stop();
				this.tweens.add({ targets: this.feverText, alpha: 0, duration: 200 });
			}
		}
	}

	override update(_time: number, delta: number): void {
		const now = performance.now();
		const t = this.conductor.songTime(now);
		const beats = t / BEAT_SEC;
		const fever = this.conductor.rhythm.fever;
		this.beatBar.setTime(beats, fever);
		const phaseBar = Math.floor((beats + 0.5) / BEATS_PER_BAR);
		this.beatBar.setTurn(phaseBar === this.responseBar ? "crew" : "player");

		const beatIndex = Math.floor(beats);
		if (beatIndex > this.lastBeat && beatIndex >= 0) {
			this.lastBeat = beatIndex;
			this.onBeat(beatIndex);
		}

		this.pending = this.pending.filter((e) => {
			if (t < e.at) return true;
			e.fn();
			return false;
		});

		for (const end of this.conductor.rhythm.tick(
			this.conductor.judgeTime(now),
		)) {
			if (end.broke) this.onBroke();
		}
		this.renderCombo();

		// コンボ中は行進しているように地面と雲を流す
		const speed = this.conductor.rhythm.combo > 0 ? (fever ? 0.18 : 0.1) : 0.02;
		this.ground.tilePositionX += speed * delta;
		for (const c of this.clouds) {
			c.x -= speed * delta * 0.3;
			if (c.x < -60) c.x = W + 60;
		}
	}
}
