import Phaser from "phaser";

/**
 * 論理座標 1 に対して確保する実ピクセル数。
 * キャンバスを W×H のまま CSS で拡大すると Retina では文字や輪郭がぼやけるため、
 * 内部は ZOOM 倍で描き、カメラのズームで論理座標 W×H に戻す。
 * 3 倍を超えても見た目は変わらずメモリだけ増えるので上限を置く
 */
export const ZOOM = Math.min(Math.ceil(window.devicePixelRatio || 1), 3);

/**
 * シーンの create の先頭で呼ぶ。カメラを ZOOM 倍にし、以降に追加される Text も同じ倍率で描く。
 * Text は内部キャンバスへの描画なので、カメラのズームだけでは解像度が上がらない
 */
export function applyHiDpi(scene: Phaser.Scene): void {
	scene.cameras.main.setOrigin(0).setZoom(ZOOM);
	const onAdded = (go: Phaser.GameObjects.GameObject) => {
		if (go instanceof Phaser.GameObjects.Text) go.setResolution(ZOOM);
	};
	scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
	scene.events.once("shutdown", () => {
		scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
	});
}
