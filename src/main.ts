import Phaser from "phaser";
import { ZOOM } from "./hidpi";
import { C, H, W } from "./palette";
import { PlayScene } from "./scenes/PlayScene";
import { TitleScene } from "./scenes/TitleScene";
import { RANDOM_LABEL, SONGS } from "./songs";

// manifest は中に書くアイコンの URL を固定にしたいので、バンドラを通さず public/ からそのまま配信する。
// HTML に直接書くとバンドラがパスを解決しようとするため、ここで足す
const manifest = document.createElement("link");
manifest.rel = "manifest";
manifest.href = "/manifest.webmanifest";
document.head.append(manifest);

// canvas に描くテキストはフォント読み込み前だと代替フォントで固定されるので、先に読み込む。
// 日本語の Web フォントは使う文字の範囲だけを後から読み込むため、曲名など後から出る文字も渡しておく
const preloadText = [
	...SONGS.flatMap((s) => [s.name, s.mood]),
	RANDOM_LABEL.name,
	RANDOM_LABEL.mood,
].join("");
await Promise.allSettled([
	document.fonts.load('900 20px "Zen Maru Gothic"', preloadText),
	document.fonts.load('700 20px "Zen Maru Gothic"', preloadText),
	document.fonts.load('400 20px "Zen Maru Gothic"', preloadText),
	document.fonts.load('500 20px "DM Mono"'),
]);

new Phaser.Game({
	type: Phaser.AUTO,
	parent: "game",
	width: W * ZOOM,
	height: H * ZOOM,
	backgroundColor: C.bg,
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	input: { activePointers: 4 },
	scene: [TitleScene, PlayScene],
});
