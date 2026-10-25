import Phaser from "phaser";
import { C, H, W } from "./palette";
import { PlayScene } from "./scenes/PlayScene";
import { TitleScene } from "./scenes/TitleScene";

// canvas に描くテキストはフォント読み込み前だと代替フォントで固定されるので、先に読み込む
await Promise.allSettled([
	document.fonts.load('900 20px "Zen Maru Gothic"'),
	document.fonts.load('700 20px "Zen Maru Gothic"'),
	document.fonts.load('500 20px "DM Mono"'),
]);

new Phaser.Game({
	type: Phaser.AUTO,
	parent: "game",
	width: W,
	height: H,
	backgroundColor: C.bg,
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	input: { activePointers: 4 },
	scene: [TitleScene, PlayScene],
});
