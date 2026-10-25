// scripts/gen-voice.ts が生成する。手で編集しない
import type { VoiceManifest } from "../voiceLines";
import v11 from "./crew0-don-finish.wav";
import v9 from "./crew0-don-hit.wav";
import v10 from "./crew0-don-rise.wav";
import v17 from "./crew0-poko-finish.wav";
import v15 from "./crew0-poko-hit.wav";
import v16 from "./crew0-poko-rise.wav";
import v14 from "./crew0-shaka-finish.wav";
import v12 from "./crew0-shaka-hit.wav";
import v13 from "./crew0-shaka-rise.wav";
import v20 from "./crew1-don-finish.wav";
import v18 from "./crew1-don-hit.wav";
import v19 from "./crew1-don-rise.wav";
import v26 from "./crew1-poko-finish.wav";
import v24 from "./crew1-poko-hit.wav";
import v25 from "./crew1-poko-rise.wav";
import v23 from "./crew1-shaka-finish.wav";
import v21 from "./crew1-shaka-hit.wav";
import v22 from "./crew1-shaka-rise.wav";
import v29 from "./crew2-don-finish.wav";
import v27 from "./crew2-don-hit.wav";
import v28 from "./crew2-don-rise.wav";
import v35 from "./crew2-poko-finish.wav";
import v33 from "./crew2-poko-hit.wav";
import v34 from "./crew2-poko-rise.wav";
import v32 from "./crew2-shaka-finish.wav";
import v30 from "./crew2-shaka-hit.wav";
import v31 from "./crew2-shaka-rise.wav";
import v38 from "./crew3-don-finish.wav";
import v36 from "./crew3-don-hit.wav";
import v37 from "./crew3-don-rise.wav";
import v44 from "./crew3-poko-finish.wav";
import v42 from "./crew3-poko-hit.wav";
import v43 from "./crew3-poko-rise.wav";
import v41 from "./crew3-shaka-finish.wav";
import v39 from "./crew3-shaka-hit.wav";
import v40 from "./crew3-shaka-rise.wav";
import v47 from "./crew4-don-finish.wav";
import v45 from "./crew4-don-hit.wav";
import v46 from "./crew4-don-rise.wav";
import v53 from "./crew4-poko-finish.wav";
import v51 from "./crew4-poko-hit.wav";
import v52 from "./crew4-poko-rise.wav";
import v50 from "./crew4-shaka-finish.wav";
import v48 from "./crew4-shaka-hit.wav";
import v49 from "./crew4-shaka-rise.wav";
import v56 from "./crew5-don-finish.wav";
import v54 from "./crew5-don-hit.wav";
import v55 from "./crew5-don-rise.wav";
import v62 from "./crew5-poko-finish.wav";
import v60 from "./crew5-poko-hit.wav";
import v61 from "./crew5-poko-rise.wav";
import v59 from "./crew5-shaka-finish.wav";
import v57 from "./crew5-shaka-hit.wav";
import v58 from "./crew5-shaka-rise.wav";
import manifest from "./manifest.json";
import v2 from "./player-don-finish.wav";
import v0 from "./player-don-hit.wav";
import v1 from "./player-don-rise.wav";
import v8 from "./player-poko-finish.wav";
import v6 from "./player-poko-hit.wav";
import v7 from "./player-poko-rise.wav";
import v5 from "./player-shaka-finish.wav";
import v3 from "./player-shaka-hit.wav";
import v4 from "./player-shaka-rise.wav";

export const VOICE_URLS: Record<string, string> = {
	"player-don-hit": v0,
	"player-don-rise": v1,
	"player-don-finish": v2,
	"player-shaka-hit": v3,
	"player-shaka-rise": v4,
	"player-shaka-finish": v5,
	"player-poko-hit": v6,
	"player-poko-rise": v7,
	"player-poko-finish": v8,
	"crew0-don-hit": v9,
	"crew0-don-rise": v10,
	"crew0-don-finish": v11,
	"crew0-shaka-hit": v12,
	"crew0-shaka-rise": v13,
	"crew0-shaka-finish": v14,
	"crew0-poko-hit": v15,
	"crew0-poko-rise": v16,
	"crew0-poko-finish": v17,
	"crew1-don-hit": v18,
	"crew1-don-rise": v19,
	"crew1-don-finish": v20,
	"crew1-shaka-hit": v21,
	"crew1-shaka-rise": v22,
	"crew1-shaka-finish": v23,
	"crew1-poko-hit": v24,
	"crew1-poko-rise": v25,
	"crew1-poko-finish": v26,
	"crew2-don-hit": v27,
	"crew2-don-rise": v28,
	"crew2-don-finish": v29,
	"crew2-shaka-hit": v30,
	"crew2-shaka-rise": v31,
	"crew2-shaka-finish": v32,
	"crew2-poko-hit": v33,
	"crew2-poko-rise": v34,
	"crew2-poko-finish": v35,
	"crew3-don-hit": v36,
	"crew3-don-rise": v37,
	"crew3-don-finish": v38,
	"crew3-shaka-hit": v39,
	"crew3-shaka-rise": v40,
	"crew3-shaka-finish": v41,
	"crew3-poko-hit": v42,
	"crew3-poko-rise": v43,
	"crew3-poko-finish": v44,
	"crew4-don-hit": v45,
	"crew4-don-rise": v46,
	"crew4-don-finish": v47,
	"crew4-shaka-hit": v48,
	"crew4-shaka-rise": v49,
	"crew4-shaka-finish": v50,
	"crew4-poko-hit": v51,
	"crew4-poko-rise": v52,
	"crew4-poko-finish": v53,
	"crew5-don-hit": v54,
	"crew5-don-rise": v55,
	"crew5-don-finish": v56,
	"crew5-shaka-hit": v57,
	"crew5-shaka-rise": v58,
	"crew5-shaka-finish": v59,
	"crew5-poko-hit": v60,
	"crew5-poko-rise": v61,
	"crew5-poko-finish": v62,
};

export const VOICE_MANIFEST: VoiceManifest = manifest;

export const VOICE_CREDITS: string[] = [
	"VOICEVOX:ずんだもん",
	"VOICEVOX:白上虎太郎",
	"VOICEVOX:櫻歌ミコ",
	"VOICEVOX:猫使アル",
	"VOICEVOX:春日部つむぎ",
	"VOICEVOX:猫使ビィ",
	"VOICEVOX:満別花丸",
];
