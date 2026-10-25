import Phaser from "phaser";
import { C, FONT, hex, PAD_COLOR } from "../palette";
import { BEATS_PER_BAR, type Judge } from "../rhythm";

const SLOT_R = 17;

/**
 * 1 小節ぶんの拍バー。カーソルが左から右へ流れ、拍の瞬間に各スロットの中心を通る。
 * 0〜2 拍目は丸（入力枠）、3 拍目はひし形（休符）。
 */
export class BeatBar extends Phaser.GameObjects.Container {
	private readonly barW: number;
	private readonly seg: number;
	private readonly slots: Phaser.GameObjects.Graphics[] = [];
	private readonly fills: Phaser.GameObjects.Arc[] = [];
	private readonly cursor: Phaser.GameObjects.Rectangle;
	private readonly glow: Phaser.GameObjects.Rectangle;
	private lastPhaseBar = Number.NaN;
	private readonly crewTint: Phaser.GameObjects.Graphics;
	private readonly turnLabel: Phaser.GameObjects.Text;
	private turn: "player" | "crew" | null = null;

	constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
		super(scene, x, y);
		this.barW = w;
		this.seg = w / BEATS_PER_BAR;

		const track = scene.add.graphics();
		track.fillStyle(C.card, 1);
		track.fillRoundedRect(0, -h / 2, w, h, h / 2);
		track.lineStyle(2, C.border, 1);
		track.strokeRoundedRect(0, -h / 2, w, h, h / 2);
		// 入力枠と休符の境目
		track.fillStyle(C.border, 1);
		track.fillRect(this.seg * 3, -h / 2 + 10, 2, h - 20);
		this.add(track);

		// 子分の番の間だけ重ねる色
		this.crewTint = scene.add.graphics();
		this.crewTint.fillStyle(C.crewTurn, 1);
		this.crewTint.fillRoundedRect(2, -h / 2 + 2, w - 4, h - 4, h / 2 - 2);
		this.crewTint.setAlpha(0);
		this.add(this.crewTint);

		this.turnLabel = scene.add
			.text(w / 2, -h / 2 - 2, "", {
				fontFamily: FONT,
				fontSize: "12px",
				fontStyle: "700",
				color: "#ffffff",
				backgroundColor: hex(C.textMid),
				padding: { x: 10, y: 3 },
			})
			.setOrigin(0.5, 0.5);
		this.add(this.turnLabel);

		this.glow = scene.add.rectangle(0, 0, 36, h - 10, C.fever, 0.35);
		this.glow.setVisible(false);
		this.add(this.glow);

		for (let i = 0; i < BEATS_PER_BAR; i++) {
			const cx = this.seg * (i + 0.5);
			const fill = scene.add.circle(cx, 0, SLOT_R - 3, C.text, 1);
			fill.setScale(0);
			const g = scene.add.graphics({ x: cx, y: 0 });
			this.drawSlot(g, i, C.border, 3);
			this.fills.push(fill);
			this.slots.push(g);
			this.add([fill, g]);
		}

		this.cursor = scene.add.rectangle(0, 0, 4, h - 8, C.text, 0.85);
		this.add(this.cursor);
		this.bringToTop(this.turnLabel);
		scene.add.existing(this);
	}

	private drawSlot(
		g: Phaser.GameObjects.Graphics,
		i: number,
		color: number,
		width: number,
	): void {
		g.clear();
		g.lineStyle(width, color, 1);
		if (i === BEATS_PER_BAR - 1) {
			const r = SLOT_R - 4;
			g.strokePoints(
				[
					new Phaser.Math.Vector2(0, -r),
					new Phaser.Math.Vector2(r, 0),
					new Phaser.Math.Vector2(0, r),
					new Phaser.Math.Vector2(-r, 0),
				],
				true,
			);
		} else {
			g.strokeCircle(0, 0, SLOT_R);
		}
	}

	/** 毎フレーム呼ぶ。beats は曲の先頭からの拍数（小数） */
	setTime(beats: number, fever: boolean): void {
		const phase =
			(((beats + 0.5) % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR;
		this.cursor.x = (phase / BEATS_PER_BAR) * this.barW;
		this.glow.setVisible(fever);
		this.glow.x = this.cursor.x;

		// カーソルが右端から左端に戻ったら新しい小節。入力の塗りを消す
		const phaseBar = Math.floor((beats + 0.5) / BEATS_PER_BAR);
		if (phaseBar !== this.lastPhaseBar) {
			this.lastPhaseBar = phaseBar;
			for (const f of this.fills) {
				this.scene.tweens.add({ targets: f, scale: 0, duration: 120 });
			}
		}
	}

	/** 今がプレイヤーの番か子分の番かを表示する */
	setTurn(turn: "player" | "crew"): void {
		if (turn === this.turn) return;
		this.turn = turn;
		const crew = turn === "crew";
		this.turnLabel.setText(crew ? "みんなの番" : "あなたの番");
		this.turnLabel.setBackgroundColor(
			hex(crew ? PAD_COLOR.shaka.strong : PAD_COLOR.don.strong),
		);
		this.scene.tweens.add({
			targets: this.crewTint,
			alpha: crew ? 1 : 0,
			duration: 150,
		});
		this.turnLabel.setScale(1.2);
		this.scene.tweens.add({ targets: this.turnLabel, scale: 1, duration: 200 });
	}

	/** 拍の瞬間にスロットを光らせる */
	pulse(beat: number): void {
		const g = this.slots[beat];
		if (!g) return;
		this.drawSlot(g, beat, C.textMid, 4);
		g.setScale(1.35);
		this.scene.tweens.add({
			targets: g,
			scale: 1,
			duration: 220,
			ease: "Quad.Out",
			onComplete: () => this.drawSlot(g, beat, C.border, 3),
		});
	}

	mark(beat: number, color: number, judge: Judge): void {
		const f = this.fills[beat];
		if (!f) return;
		this.scene.tweens.killTweensOf(f);
		f.setFillStyle(judge === "miss" ? C.textDim : color, 1);
		f.setScale(1.5);
		this.scene.tweens.add({
			targets: f,
			scale: 1,
			duration: 200,
			ease: "Back.Out",
		});
	}

	/** 小節がそろったとき、休符スロットを星のように弾けさせる */
	celebrate(color: number): void {
		const i = BEATS_PER_BAR - 1;
		this.mark(i, color, "perfect");
	}
}
