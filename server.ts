import { readdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import index from "./index.html";

/** public/ のファイル（manifest・アプリアイコン）をルート直下で配信する。ビルド時は dist/ にコピーされる */
function publicRoutes(): Record<string, Response> {
	const dir = new URL("./public/", import.meta.url).pathname;
	return Object.fromEntries(
		readdirSync(dir).map((f) => [
			`/${f}`,
			new Response(Bun.file(`${dir}${f}`)),
		]),
	);
}

// PORT を変えれば普段使いのポートと衝突させずに起動できる
const server = Bun.serve({
	port: Number(process.env.PORT) || 3000,
	hostname: "0.0.0.0",
	routes: { "/": index, ...publicRoutes() },
	development: process.env.NODE_ENV !== "production",
});

// 0.0.0.0 は別の端末から開けるアドレスではないので、LAN の IPv4 アドレスで URL を出す
const lan = Object.values(networkInterfaces())
	.flat()
	.filter((n) => n?.family === "IPv4" && !n.internal)
	.map((n) => `http://${n?.address}:${server.port}/`);
console.log(`起動しました: http://localhost:${server.port}/`);
for (const url of lan) console.log(`別の端末から: ${url}`);
