import Phaser from "phaser";
import { Conductor } from "../conductor";
import { Blob } from "../objects/Blob";
import {
	C,
	CHANT,
	FONT,
	H,
	hex,
	PAD_COLOR,
	PAD_LABEL,
	PAD_ORDER,
	W,
} from "../palette";
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
			.text(W / 2, 168, "伴奏に合わせて、はじめの 3 拍をたたこう", {
				fontFamily: FONT,
				fontSize: "14px",
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

		PAD_ORDER.forEach((pad, i) => {
			const y = 510 + i * 44;
			this.add.circle(52, y, 16, PAD_COLOR[pad].base);
			this.add
				.text(
					80,
					y,
					`${PAD_LABEL[pad]}  ${CHANT[pad].hit} ×2 → ${CHANT[pad].finish}`,
					{
						fontFamily: FONT,
						fontSize: "14px",
						fontStyle: "700",
						color: hex(C.text),
					},
				)
				.setOrigin(0, 0.5);
		});
		this.add
			.text(
				W / 2,
				650,
				"たたいた次の小節で、こぶんたちが歌い返すよ。\n組み合わせは自由。3 セットつづけるとフィーバー！",
				{
					fontFamily: FONT,
					fontSize: "12px",
					color: hex(C.textMid),
					align: "center",
					lineSpacing: 6,
				},
			)
			.setOrigin(0.5);

		const btn = this.add.container(W / 2, 730);
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

		this.add
			.text(W / 2, H - 36, `音声: ${VOICE_CREDITS.join("、")}`, {
				fontFamily: FONT,
				fontSize: "12px",
				color: hex(C.textMid),
				align: "center",
				wordWrap: { width: W - 40, useAdvancedWrap: true },
				lineSpacing: 4,
			})
			.setOrigin(0.5);

		// 音声の再開はユーザ操作の DOM イベント内で行う必要があるため、
		// Phaser の入力ではなく canvas のネイティブイベントで開始する
		const canvas = this.game.canvas;
		const onStart = () => {
			canvas.removeEventListener("pointerup", onStart);
			window.removeEventListener("keydown", onStart);
			const conductor = new Conductor();
			this.scene.start("play", { conductor });
		};
		canvas.addEventListener("pointerup", onStart);
		window.addEventListener("keydown", onStart);
		this.events.once("shutdown", () => {
			canvas.removeEventListener("pointerup", onStart);
			window.removeEventListener("keydown", onStart);
		});
	}
}
