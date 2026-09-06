import { createServer } from "node:http";
import { readFileSync, realpathSync } from "node:fs";
import { basename, extname, join, sep } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { ASSETS_DIR, CMS_DIR, DATA_DIR, env } from "./lib/config.mjs";
import * as db from "./lib/db.mjs";
import * as content from "./lib/content.mjs";
import * as git from "./lib/git.mjs";
import { normalizeTags, slugify, toIsoLocal } from "./lib/slug.mjs";

// Usado apenas em /api/assets (imagens de src/content/assets/)
const MIME = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif",
	".avif": "image/avif",
};

const MAX_BODY = 20 * 1024 * 1024; // 20 MB

// ---- Helpers HTTP ----
const SECURITY_HEADERS = {
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "no-referrer",
}

function send(res, status, body, type = "application/json; charset=utf-8") {
	const payload = typeof body === "string" ? body : JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": type,
		"Content-Length": Buffer.byteLength(payload),
		"Cache-Control": "no-store",
		...SECURITY_HEADERS,
	});
	res.end(payload);
}

function sendError(res, status, message) {
	send(res, status, { error: message });
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		req.on("data", (c) => {
			size += c.length;
			if (size > MAX_BODY) {
				reject(new Error("Corpo da requisicao muito grande (>20MB)"));
				req.destroy();
				return;
			}
			chunks.push(c);
		});
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});
}


// Le e faz parse do corpo JSON (com limite de tamanho)
async function readJson(req) {
	return JSON.parse((await readBody(req)).toString("utf8") || "{}");
}

// ---- Controle de acesso / proteções ─────────────────────────────

// Comparação de token com timing constante (evita side-channel)
function safeEqual(a, b) {
	if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
		return false;
	}
	return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function authOk(req) {
	// env.token é SEMPRE gerado em config.mjs (secure by default)
	return safeEqual(req.headers.authorization || "", `Bearer ${env.token}`);
}

// DNS rebinding / CSRF via browser: aceita SOMENTE origem local na MESMA porta
const ALLOWED_ORIGIN_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
function originAllowed(req) {
	const origin = req.headers.origin;
	if (!origin) return true; // chamadas não-browser (curl, scripts) não têm Origin
	try {
		const u = new URL(origin);
		if (!ALLOWED_ORIGIN_HOSTS.has(u.hostname)) return false;
		// exige porta explícita igual à do servidor (defaults 80/443 NÃO passam)
		if (!u.port || u.port !== String(env.port)) return false;
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}

// Exige application/json em mutações (bloqueia CSRF por formulário/no-cors)
function isJsonRequest(req) {
	return (req.headers["content-type"] || "").toLowerCase().startsWith("application/json");
}

// Rate limit simples por IP (janela deslizante em memória)
const RL_WINDOW = 60_000; // 60s
const RL_GENERAL = 300; // 300 req/min por IP
const RL_WRITE = 60; // 60 mutações/min por IP
const rlHits = new Map();

function limited(ip, isWrite) {
	const now = Date.now();
	if (rlHits.size > 20_000) rlHits.clear(); // limpeza preventiva
	let arr = rlHits.get(ip);
	if (!arr) {
		arr = [];
		rlHits.set(ip, arr);
	}
	while (arr.length && now - arr[0] > RL_WINDOW) arr.shift();
	const limit = isWrite ? RL_WRITE : RL_GENERAL;
	if (arr.length >= limit) return true;
	arr.push(now);
	return false;
}

// ---- Validacao de post ----
function parsePostPayload(body, { isNew, currentSlug = null }) {
	const title = String(body.title ?? "").trim();
	if (!title) throw new Error("O campo 'titulo' e obrigatorio.");
	if (title.length > 200) throw new Error("Titulo muito longo (max. 200).");

	const description = String(body.description ?? "").trim().slice(0, 400);

	let slug = String(body.slug ?? "").trim();
	slug = slugify(slug || title);
	if (!slug) throw new Error("Nao foi possivel gerar um slug valido.");

	const tags = normalizeTags(body.tags);

	const draft = body.draft !== false;

	let createdAt;
	if (body.date) createdAt = toIsoLocal(body.date, body.time);
	else if (body.createdAt) {
		const d = new Date(body.createdAt);
		if (Number.isNaN(d.getTime())) throw new Error("createdAt invalido.");
		createdAt = d.toISOString();
	} else {
		createdAt = toIsoLocal();
	}

	let updatedAt = null;
	if (body.updatedAt) {
		const d = new Date(body.updatedAt);
		if (Number.isNaN(d.getTime())) throw new Error("updatedAt invalido.");
		updatedAt = d.toISOString();
	} else if (!isNew && body.touchUpdated) {
		const now = new Date();
		updatedAt = toIsoLocal(
`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
);
	}

	let cover = null;
	if (typeof body.coverData === "string" && body.coverData.length > 0) {
		cover = content.saveCoverBase64(slug, body.coverData);
	} else if (body.cover) {
		cover = content.assertSafeCoverRef(String(body.cover));
	}

	if (isNew && db.slugExists(slug)) {
		throw new Error(`Ja existe um post com o slug "${slug}".`);
	}
	if (!isNew && currentSlug && slug !== currentSlug && db.slugExists(slug)) {
		throw new Error(`Ja existe um post com o slug "${slug}".`);
	}

	return {
		slug,
		title,
		description,
		createdAt,
		updatedAt,
		tags,
		draft,
		cover,
		content: typeof body.content === "string" ? body.content : "",
	};
}

// ---- Rotas ----
async function handle(req, res, url) {
	// Métodos não suportados (inclusive TRACE/OPTIONS) são rejeitados
	const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);
	if (url.pathname.startsWith("/api/") && !ALLOWED_METHODS.has(req.method)) {
		return sendError(res, 405, "Metodo nao permitido.");
	}

	// Health (sem dados sensíveis)
	if (url.pathname === "/api/health") {
		return send(res, 200, { ok: true });
	}

	// Portão de segurança para todas as demais rotas /api
	if (url.pathname.startsWith("/api/")) {
		const ip = req.socket.remoteAddress || "desconhecido";
		// 1. DNS rebinding / CSRF via browser
		if (!originAllowed(req)) {
			return sendError(res, 403, "Origem nao permitida.");
		}
		// 2. Rate limit
		const isWrite = req.method === "POST" || req.method === "PUT" || req.method === "DELETE";
		if (limited(ip, isWrite)) {
			return sendError(res, 429, "Muitas requisicoes. Tente novamente em instantes.");
		}
		// 3. Autenticação (token sempre exigido)
		if (!authOk(req)) {
			return sendError(res, 401, "Token de acesso invalido ou ausente.");
		}
		// 4. Mutações exigem JSON (bloqueia CSRF por form/no-cors)
		if ((req.method === "POST" || req.method === "PUT") && !isJsonRequest(req)) {
			return sendError(res, 415, "Content-Type deve ser application/json.");
		}
	}

	// GET /api/posts
	if (req.method === "GET" && url.pathname === "/api/posts") {
		const posts = db.listPosts().map((p) => ({ ...p, content: undefined }));
		return send(res, 200, { posts });
	}

	// GET /api/tags
	if (req.method === "GET" && url.pathname === "/api/tags") {
		const jsonTags = content.readTagsJson().map((t) => t.id);
		const merged = [...new Set([...jsonTags, ...db.knownTags()])].sort();
		return send(res, 200, { tags: merged });
	}

	// GET /api/status (git)
	if (req.method === "GET" && url.pathname === "/api/status") {
		return send(res, 200, git.statusInfo());
	}

	// POST /api/posts (criar)
	if (req.method === "POST" && url.pathname === "/api/posts") {
		const raw = await readJson(req);
		const data = parsePostPayload(raw, { isNew: true });
		const addedTags = content.syncTags(data.tags);
		content.writePostFile(data.slug, content.buildPostMarkdown(data));
		const post = db.createPost(data);
		return send(res, 201, { post, addedTags });
	}

	// POST /api/images (upload para assets, retorna trecho markdown)
	if (req.method === "POST" && url.pathname === "/api/images") {
		const raw = await readJson(req);
		if (!raw.data || typeof raw.data !== "string") {
			return sendError(res, 400, "Envie { data: '<data-url base64>', alt: 'texto' }.");
		}
		const rel = content.saveCoverBase64("imagem-" + Date.now(), raw.data);
		const file = rel.replace("../assets/", "");
		const alt = String(raw.alt || "Imagem").replace(/"/g, "");
return send(res, 201, {
relative: rel,
embed: `![${alt}](${rel})`,
file,
preview: `/api/assets/${encodeURIComponent(file)}`,
});
}

// POST /api/posts/:slug/publish
const pubMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/publish$/);
if (req.method === "POST" && pubMatch) {
const slug = decodeURIComponent(pubMatch[1]);
const post = db.getPost(slug);
if (!post) return sendError(res, 404, "Post nao encontrado.");
const result = git.publishPost(post);
return send(res, 200, { published: result, git: git.statusInfo() });
}

// /api/posts/:slug (GET/PUT/DELETE)
const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
if (postMatch) {
const slug = decodeURIComponent(postMatch[1]);

if (req.method === "GET") {
const post = db.getPost(slug);
if (!post) return sendError(res, 404, "Post nao encontrado.");
return send(res, 200, { post });
}

if (req.method === "PUT") {
	const existing = db.getPost(slug);
	if (!existing) return sendError(res, 404, "Post nao encontrado.");
	const raw = await readJson(req);
	const data = parsePostPayload(raw, { isNew: false, currentSlug: slug });
	const replacedCover = typeof raw.coverData === "string" && raw.coverData.length > 0;

	if (data.slug !== slug) {
		// Slug alterado: move a capa antiga para o nome novo
		if (!replacedCover && existing.cover) {
			data.cover = content.renameCoverForSlug(slug, data.slug) || existing.cover;
		} else {
			content.renameCoverForSlug(slug, data.slug);
		}
		if (replacedCover) content.deleteCoverFile(slug);
		content.deletePostFile(slug);
	} else if (replacedCover && existing.cover) {
		// Nova capa sem troca de slug: remove a capa antiga
		content.deleteCoverFile(slug);
	}

	const addedTags = content.syncTags(data.tags);
	content.writePostFile(data.slug, content.buildPostMarkdown(data));
	const post = db.updatePost(slug, data);
	return send(res, 200, { post, addedTags });
}

if (req.method === "DELETE") {
db.deletePost(slug);
content.deletePostFile(slug);
content.deleteCoverFile(slug);
return send(res, 200, { deleted: slug });
}
}

// GET /api/assets/<arquivo> (preview) - contencao real de caminho
	if (req.method === "GET" && url.pathname.startsWith("/api/assets/")) {
		const name = decodeURIComponent(url.pathname.slice("/api/assets/".length));
		const safe = basename(name);
		if (!/^[a-z0-9][a-z0-9._-]+$/i.test(safe)) {
			return sendError(res, 400, "Nome de arquivo invalido.");
		}
		try {
			const assetsReal = realpathSync(ASSETS_DIR);
			const target = realpathSync(join(ASSETS_DIR, safe));
			if (!target.startsWith(assetsReal + sep)) {
				return sendError(res, 400, "Caminho fora de assets nao permitido.");
			}
			const buf = readFileSync(target);
			res.writeHead(200, {
				"Content-Type": MIME[extname(safe)] || "application/octet-stream",
				...SECURITY_HEADERS,
			});
			return res.end(buf);
		} catch {
			return sendError(res, 404, "Arquivo nao encontrado.");
		}
	}

return sendError(res, 404, "Rota nao encontrada.");
}

// ---- Servidor ----
const UI_PATH = join(CMS_DIR, "ui", "index.html");
let uiCache = null;

const server = createServer(async (req, res) => {
	const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
	try {
		// Painel web
		if (url.pathname === "/" || url.pathname === "/index.html") {
			if (uiCache === null) uiCache = readFileSync(UI_PATH, "utf8");
			return send(res, 200, uiCache, "text/html; charset=utf-8");
		}
		await handle(req, res, url);
	} catch (err) {
		const msg = String(err.message || "Erro interno.");
		const status = /invalido|obrigatorio|encontrado|suportado|grande/.test(msg) ? 400 : 500;
		console.error("[cms]", err); // detalhes completos apenas no log local
		// Não vaza caminhos/stack internos para o cliente
		sendError(res, status, status >= 500 ? "Erro interno." : msg);
	}
});

server.listen(env.port, env.host, () => {
	console.log("");
	console.log("  =============================================");
	console.log("  📝  CMS do Baú do Kira (local)");
	console.log("  ---------------------------------------------");
	console.log(`  Painel   : http://${env.host}:${env.port}/`);
	console.log(`  Banco    : SQLite (${DATA_DIR})`);
	console.log(`  Token    : OBRIGATÓRIO — valor em cms/.env (CMS_TOKEN)`);
	console.log(`  RateLimit: ${RL_GENERAL} req/min e ${RL_WRITE} mutações/min por IP`);
	console.log(`  AutoPush : ${env.autoPush ? "LIGADO (faz git push)" : "desligado (só commit local)"}`);
	console.log(`  Conteúdo : src/content/ (posts/ + assets/ + tags.json)`);
	console.log("  =============================================");
});
