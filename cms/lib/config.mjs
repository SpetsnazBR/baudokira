import { readFileSync, mkdirSync } from "node:fs";
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

// ── Carregar cms/.env manualmente (sem dependências) ──────────────
// Regras: não sobrescreve variáveis já existentes no ambiente;
// linhas "CHAVE=valor", ignorando comentários (#) e linhas vazias.
function loadEnv() {
	const envFile = join(CMS_DIR, ".env");
	let raw;
	try {
		raw = readFileSync(envFile, "utf8");
	} catch {
		return; // .env opcional
	}
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		// remove aspas simples/duplas
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

export const env = {
	host: process.env.CMS_HOST || "127.0.0.1",
	port: Number(process.env.CMS_PORT || 4444),
	token: process.env.CMS_TOKEN || "",
	autoPush: process.env.CMS_AUTO_PUSH === "1",
};

// Garante a existência das pastas de runtime
for (const dir of [DATA_DIR, UPLOADS_DIR, POSTS_DIR, ASSETS_DIR]) {
	mkdirSync(dir, { recursive: true });
}
