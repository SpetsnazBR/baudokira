import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { ASSETS_DIR, CMS_DIR, DATA_DIR, env } from "./lib/config.mjs";
import * as db from "./lib/db.mjs";
import * as content from "./lib/content.mjs";
import * as git from "./lib/git.mjs";
import { slugify, toIsoLocal } from "./lib/slug.mjs";

const MIME = {
	".html": "text/html; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif",
	".avif": "image/avif",
};

const MAX_BODY = 20 * 1024 * 1024; // 20 MB

// ---- Helpers HTTP ----
function send(res, status, body, type = "application/json; charset=utf-8") {
	const payload = typeof body === "string" ? body : JSON.stringify(body);
	res.writeHead(status, {
"Content-Type": type,
"Content-Length": Buffer.byteLength(payload),
"Cache-Control": "no-store",
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

function authOk(req) {
	if (!env.token) return true;
	return req.headers.authorization === `Bearer ${env.token}`;
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

	const tags = Array.isArray(body.tags)
		? [...new Set(body.tags.map((t) => slugify(String(t))).filter(Boolean))]
		: [];

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
	// Health
	if (url.pathname === "/api/health") {
		return send(res, 200, { ok: true, version: "0.1.0" });
	}

	// Demais rotas /api exigem token (se configurado)
	if (url.pathname.startsWith("/api/") && !authOk(req)) {
		return sendError(res, 401, "Token de acesso invalido ou ausente.");
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
		const raw = JSON.parse((await readBody(req)).toString("utf8") || "{}");
		const data = parsePostPayload(raw, { isNew: true });
		const addedTags = content.syncTags(data.tags);
		content.writePostFile(data.slug, content.buildPostMarkdown(data));
		const post = db.createPost(data);
		return send(res, 201, { post, addedTags });
	}

	// POST /api/images (upload para assets, retorna trecho markdown)
	if (req.method === "POST" && url.pathname === "/api/images") {
		const raw = JSON.parse((await readBody(req)).toString("utf8") || "{}");
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
	const raw = JSON.parse((await readBody(req)).toString("utf8") || "{}");
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

// GET /api/assets/<arquivo> (preview)
if (req.method === "GET" && url.pathname.startsWith("/api/assets/")) {
const name = decodeURIComponent(url.pathname.slice("/api/assets/".length));
const safe = basename(name);
if (!/^[a-z0-9][a-z0-9._-]+$/i.test(safe)) {
return sendError(res, 400, "Nome de arquivo invalido.");
}
try {
const buf = readFileSync(join(ASSETS_DIR, safe));
res.writeHead(200, { "Content-Type": MIME[extname(safe)] || "application/octet-stream" });
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
		console.error("[cms]", err);
		sendError(res, status, msg);
	}
});

server.listen(env.port, env.host, () => {
	console.log("");
	console.log("  =============================================");
	console.log("  📝  CMS do Baú do Kira (local)");
	console.log("  ---------------------------------------------");
	console.log(`  Painel   : http://${env.host}:${env.port}/`);
	console.log(`  Banco    : SQLite (${DATA_DIR})`);
	console.log(`  Token    : ${env.token ? "exigido (Authorization: Bearer)" : "desativado"}`);
	console.log(`  AutoPush : ${env.autoPush ? "LIGADO (faz git push)" : "desligado (só commit local)"}`);
	console.log(`  Conteúdo : src/content/ (posts/ + assets/ + tags.json)`);
	console.log("  =============================================");
});
