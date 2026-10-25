import Phaser from "phaser";
import { Conductor } from "../conductor";
import { Blob } from "../objects/Blob";
import { C, FONT, H, hex, PAD_COLOR, PAD_ORDER, W } from "../palette";
import { VOICE_CREDITS } from "../voice";

export class TitleScene extends Phaser.Scene {
	constructor() {
		super("title");
	}

	create(): void {
		this.cameras.main.setBackgroundColor(C.sky);
		this.add.rectangle(W / 2, 420, W, 120, C.hillFront).setOrigin(0.5, 0);
		this.add.ellipse(90, 430, 360, 160, C.hillBack);
		this.add.ellipse(360, 440, 320, 140, C.hillFront);
		this.add.rectangle(W / 2, 460, W, H - 460, C.bg).setOrigin(0.5, 0);

		this.add
			.text(W / 2, 110, "ポコドン・リズム", {
				fontFamily: FONT,
				fontSize: "40px",
				fontStyle: "900",
				color: hex(PAD_COLOR.don.strong),
				stroke: "#ffffff",
				strokeThickness: 8,
			})
			.setOrigin(0.5);
		this.add
			.text(W / 2, 172, "リズムよくボタンをおそう！", {
				fontFamily: FONT,
				fontSize: "16px",
				fontStyle: "700",
				color: hex(C.textMid),
			})
			.setOrigin(0.5);

		const crew = PAD_ORDER.map(
			(pad, i) =>
				new Blob(this, 120 + i * 90, 440, PAD_COLOR[pad].base, 70, 62),
		);
		this.time.addEvent({
			delay: 500,
			loop: true,
			callback: () => {
				for (const b of crew) b.bounce(false);
			},
		});

		const btn = this.add.container(W / 2, 600);
		const bg = this.add.graphics();
		bg.fillStyle(PAD_COLOR.don.base, 1);
		bg.fillRoundedRect(-150, -30, 300, 60, 30);
		const label = this.add
			.text(0, 0, "タップしてはじめる", {
				fontFamily: FONT,
				fontSize: "20px",
				fontStyle: "900",
				color: "#ffffff",
			})
			.setOrigin(0.5);
		btn.add([bg, label]);
		this.tweens.add({
			targets: btn,
			scale: 1.05,
			duration: 500,
			yoyo: true,
			repeat: -1,
			ease: "Sine.InOut",
		});

		const creditBounds = this.makeCreditLink();
		const modal = this.makeCreditModal();

		// 音声の再開はユーザ操作の DOM イベント内で行う必要があるため、
		// Phaser の入力ではなく canvas のネイティブイベントで開始する
		const canvas = this.game.canvas;
		const start = () => {
			detach();
			lockPortrait();
			const conductor = new Conductor();
			this.scene.start("play", { conductor });
		};
		const onPointer = (ev: PointerEvent) => {
			const x = this.scale.transformX(ev.pageX);
			const y = this.scale.transformY(ev.pageY);
			if (modal.visible) {
				modal.setVisible(false);
			} else if (creditBounds.contains(x, y)) {
				modal.setVisible(true);
			} else {
				start();
			}
		};
		const onKey = (ev: KeyboardEvent) => {
			if (modal.visible) {
				if (ev.key === "Escape" || ev.key === "Enter") modal.setVisible(false);
				return;
			}
			start();
		};
		const detach = () => {
			canvas.removeEventListener("pointerup", onPointer);
			window.removeEventListener("keydown", onKey);
		};
		canvas.addEventListener("pointerup", onPointer);
		window.addEventListener("keydown", onKey);
		this.events.once("shutdown", detach);
	}

	/** 画面下の小さなクレジットボタン。当たり判定の範囲を返す */
	private makeCreditLink(): Phaser.Geom.Rectangle {
		const w = 120;
		const h = 36;
		const x = W / 2;
		const y = H - 48;
		const g = this.add.graphics();
		g.lineStyle(1, C.border, 1);
		g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
		this.add
			.text(x, y, "クレジット", {
				fontFamily: FONT,
				fontSize: "12px",
				fontStyle: "700",
				color: hex(C.textMid),
			})
			.setOrigin(0.5);
		// 指で押しやすいよう、見た目より少し広く取る
		return new Phaser.Geom.Rectangle(x - w / 2 - 8, y - 26, w + 16, 52);
	}

	private makeCreditModal(): Phaser.GameObjects.Container {
		const modal = this.add.container(0, 0).setDepth(100).setVisible(false);
		const lines = VOICE_CREDITS.length;
		const cardH = 150 + lines * 24;
		const top = H - cardH;
		const card = this.add.graphics();
		card.fillStyle(C.card, 1);
		card.fillRoundedRect(0, top, W, cardH + 24, 24);
		modal.add([
			this.add.rectangle(0, 0, W, H, C.text, 0.4).setOrigin(0),
			card,
			this.add
				.text(W / 2, top + 36, "クレジット", {
					fontFamily: FONT,
					fontSize: "16px",
					fontStyle: "700",
					color: hex(C.text),
				})
				.setOrigin(0.5),
			this.add
				.text(W / 2, top + 66, "音声", {
					fontFamily: FONT,
					fontSize: "12px",
					color: hex(C.textMid),
				})
				.setOrigin(0.5),
			this.add
				.text(W / 2, top + 88, VOICE_CREDITS.join("\n"), {
					fontFamily: FONT,
					fontSize: "14px",
					color: hex(C.text),
					align: "center",
					lineSpacing: 6,
				})
				.setOrigin(0.5, 0),
			this.add
				.text(W / 2, H - 32, "タップでとじる", {
					fontFamily: FONT,
					fontSize: "12px",
					color: hex(C.textDim),
				})
				.setOrigin(0.5),
		]);
		return modal;
	}
}

/**
 * 対応端末（主に Android の全画面表示・ホーム画面から起動したとき）だけ縦向きに固定できる。
 * 非対応の環境では例外になるので、横向き時の案内表示（style.css）で代替する。
 */
function lockPortrait(): void {
	const orientation = screen.orientation as ScreenOrientation & {
		lock?: (o: "portrait") => Promise<void>;
	};
	orientation.lock?.("portrait").catch((err: unknown) => {
		console.info(
			"画面の向きを固定できないため、横向き時は案内表示で代替する",
			err,
		);
	});
}
