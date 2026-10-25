import Phaser from "phaser";
import { C } from "../palette";

/** 足元を原点にした丸いキャラ。原点が足元なので拡縮すると地面でつぶれて見える */
export class Blob extends Phaser.GameObjects.Container {
	private readonly shape: Phaser.GameObjects.Graphics;
	private readonly mouth: Phaser.GameObjects.Graphics;
	private readonly h: number;
	private readonly baseY: number;

	constructor(
		scene: Phaser.Scene,
		x: number,
		y: number,
		color: number,
		w: number,
		h: number,
	) {
		super(scene, x, y);
		this.h = h;
		this.baseY = y;

		const shadow = scene.add.ellipse(0, 2, w * 0.9, 10, C.text, 0.12);
		this.shape = scene.add.graphics();
		this.shape.fillStyle(color, 1);
		this.shape.fillEllipse(0, -h / 2, w, h);
		// ハイライト
		this.shape.fillStyle(0xffffff, 0.35);
		this.shape.fillEllipse(-w * 0.2, -h * 0.75, w * 0.22, h * 0.14);

		const eyes = scene.add.graphics();
		eyes.fillStyle(C.text, 1);
		eyes.fillEllipse(-w * 0.17, -h * 0.58, 8, 12);
		eyes.fillEllipse(w * 0.17, -h * 0.58, 8, 12);

		this.mouth = scene.add.graphics();
		this.drawMouth(false);

		this.add([shadow, this.shape, eyes, this.mouth]);
		scene.add.existing(this);
	}

	private drawMouth(open: boolean): void {
		const m = this.mouth;
		m.clear();
		m.fillStyle(C.text, 1);
		if (open) {
			m.fillEllipse(0, -this.h * 0.36, 16, 14);
		} else {
			m.fillRoundedRect(-6, -this.h * 0.4, 12, 4, 2);
		}
	}

	/** 拍ごとの跳ね。フィーバー中は高く跳んで体をひねる */
	bounce(fever: boolean): void {
		this.scene.tweens.killTweensOf(this);
		this.setScale(1.15, 0.82);
		this.y = this.baseY;
		this.angle = 0;
		const height = fever ? 34 : 14;
		this.scene.tweens.add({
			targets: this,
			scaleX: 1,
			scaleY: 1,
			duration: 260,
			ease: "Back.Out",
		});
		this.scene.tweens.add({
			targets: this,
			y: this.baseY - height,
			angle: fever ? Phaser.Math.Between(-12, 12) : 0,
			duration: 140,
			yoyo: true,
			ease: "Quad.Out",
		});
	}

	/** 歌うときの大きなジャンプ */
	hop(): void {
		this.scene.tweens.killTweensOf(this);
		this.setScale(1.2, 0.78);
		this.y = this.baseY;
		this.scene.tweens.add({
			targets: this,
			scaleX: 0.92,
			scaleY: 1.12,
			y: this.baseY - 44,
			duration: 150,
			yoyo: true,
			ease: "Quad.Out",
			onComplete: () => this.setScale(1),
		});
	}

	shout(): void {
		this.drawMouth(true);
		this.scene.time.delayedCall(220, () => this.drawMouth(false));
	}

	/** しょんぼり（コンボが切れたとき） */
	droop(): void {
		this.scene.tweens.add({
			targets: this,
			scaleY: 0.85,
			scaleX: 1.08,
			duration: 120,
			yoyo: true,
		});
	}
}
