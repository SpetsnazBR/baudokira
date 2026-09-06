import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Caminhos: config.mjs fica em cms/lib → cms/ → raiz do repositório
const HERE = dirname(fileURLToPath(import.meta.url));
export const CMS_DIR = join(HERE, "..");
export const REPO_ROOT = dirname(CMS_DIR);

export const CONTENT_DIR = join(REPO_ROOT, "src", "content");
export const POSTS_DIR = join(CONTENT_DIR, "posts");
export const ASSETS_DIR = join(CONTENT_DIR, "assets");
export const TAGS_JSON = join(CONTENT_DIR, "tags.json");

export const DATA_DIR = join(CMS_DIR, "data");
export const DB_FILE = join(DATA_DIR, "cms.db");
export const UPLOADS_DIR = join(DATA_DIR, "uploads");

export const ENV_FILE = join(CMS_DIR, ".env");

// ── Carregar cms/.env manualmente (sem dependências) ──────────────
function loadEnv() {
	let raw;
	try {
		raw = readFileSync(ENV_FILE, "utf8");
	} catch {
		return; // .env ainda não existe
	}
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (!(key in process.env)) process.env[key] = value;
	}
}
loadEnv();

// ── Segurança: token SEMPRE presente (secure by default) ──────────
// Se o usuário não definir CMS_TOKEN, geramos um aleatório e o
// persistimos em cms/.env (arquivo ignorado pelo git). Sem token
// definido, a API NUNCA fica aberta.
function ensureToken() {
	if (process.env.CMS_TOKEN && process.env.CMS_TOKEN.trim() !== "") return;
	const generated = `CMS_TOKEN=${randomBytes(24).toString("hex")}`;
	appendFileSync(ENV_FILE, `\n${generated}\n`, { flag: "a" });
	process.env.CMS_TOKEN = generated.split("=")[1];
}
ensureToken();

export const env = {
	host: process.env.CMS_HOST || "127.0.0.1",
	port: Number(process.env.CMS_PORT || 4444),
	token: process.env.CMS_TOKEN,
	autoPush: process.env.CMS_AUTO_PUSH === "1",
};

// Garante a existência das pastas de runtime
for (const dir of [DATA_DIR, UPLOADS_DIR, POSTS_DIR, ASSETS_DIR]) {
	mkdirSync(dir, { recursive: true });
}

