import {
	copyFileSync,
	existsSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { ASSETS_DIR, POSTS_DIR, TAGS_JSON } from "./config.mjs";
import { slugify } from "./slug.mjs";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);

export function serializeFrontmatter(post) {
	const lines = ["---"];
	lines.push(`title: ${JSON.stringify(post.title)}`);
	lines.push(`description: ${JSON.stringify(post.description || "")}`);
	lines.push(`createdAt: ${post.createdAt}`);
	if (post.updatedAt) lines.push(`updatedAt: ${post.updatedAt}`);
	lines.push(`tags: ${JSON.stringify(post.tags || [])}`);
	lines.push(`draft: ${post.draft ? "true" : "false"}`);
	if (post.cover) lines.push(`image: ${JSON.stringify(post.cover)}`);
	lines.push("---");
	return lines.join("\n");
}

// Conteúdo final do arquivo .md do post
export function buildPostMarkdown(post) {
	const fm = serializeFrontmatter(post);
	const body = (post.content || "").replace(/^\s+/, "").replace(/\s+$/, "");
	return body ? `${fm}\n\n${body}\n` : `${fm}\n`;
}

// ── Capas ─────────────────────────────────────────────────────────

// Salva capa enviada em base64 para src/content/assets/<slug>-cover.<ext>
export function saveCoverBase64(slug, data) {
	if (!data || typeof data !== "string") return null;
	const match = data.match(/^data:image\/([a-z0-9+.-]+);base64,(.+)$/i);
	if (!match) throw new Error("Imagem de capa inválida (esperado data-URL base64)");
	const ext = "." + match[1].toLowerCase().replace("jpeg", "jpg");
	if (!IMAGE_EXT.has(ext)) throw new Error(`Formato de imagem não suportado: ${ext}`);
	const buf = Buffer.from(match[2], "base64");
	if (!buf.length) throw new Error("Imagem de capa vazia");
	const file = `${slug}-cover${ext}`;
	writeFileSync(join(ASSETS_DIR, file), buf);
	return `../assets/${file}`;
}

// Remove arquivo de capa antigo pertencente a um slug (se existir)
export function deleteCoverFile(slug) {
	if (!slug) return;
	for (const ext of IMAGE_EXT) {
		const f = join(ASSETS_DIR, `${slug}-cover${ext}`);
		if (existsSync(f)) unlinkSync(f);
	}
}

// Renomeia capa ao mudar o slug; retorna o novo caminho relativo (ou null)
export function renameCoverForSlug(oldSlug, newSlug) {
	if (!oldSlug || oldSlug === newSlug) return null;
	for (const ext of IMAGE_EXT) {
		const from = join(ASSETS_DIR, `${oldSlug}-cover${ext}`);
		if (existsSync(from)) {
			const to = join(ASSETS_DIR, `${newSlug}-cover${ext}`);
			renameSync(from, to);
			return `../assets/${newSlug}-cover${ext}`;
		}
	}
	return null;
}

// Valida que uma referência de capa existente aponta para assets/ (anti path-traversal)
export function assertSafeCoverRef(cover) {
	if (!cover) return null;
	const file = basename(cover); // ignora qualquer prefixo de diretório
	if (!/^[a-z0-9][a-z0-9._-]+$/i.test(file)) {
		throw new Error(`Referência de capa inválida: ${cover}`);
	}
	const abs = join(ASSETS_DIR, file);
	if (!existsSync(abs)) {
		throw new Error(`Arquivo de capa não encontrado em assets/: ${file}`);
	}
	return `../assets/${file}`;
}

// ── Tags (sincroniza src/content/tags.json) ───────────────────────

export function readTagsJson() {
	try {
		const raw = JSON.parse(readFileSync(TAGS_JSON, "utf8"));
		return Array.isArray(raw) ? raw : [];
	} catch {
		return [];
	}
}

// Garante que todos os ids usados existam no tags.json (o Astro exige)
export function syncTags(ids) {
	const existing = readTagsJson().map((t) => t?.id).filter(Boolean);
	const set = new Set(existing);
	const added = [];
	for (const id of ids || []) {
		const clean = slugify(id);
		if (clean && !set.has(clean)) {
			set.add(clean);
			added.push(clean);
		}
	}
	if (!added.length) return added;
	const sorted = [...set].sort();
	// estilo do arquivo atual: array de {id} com tabulação
	const body =
		"[\n" +
		sorted.map((id) => `\t{\n\t\t"id": ${JSON.stringify(id)}\n\t}`).join(",\n") +
		"\n]";
	writeFileSync(TAGS_JSON, body + "\n");
	return added;
}

// ── Arquivo .md do post ───────────────────────────────────────────

export function writePostFile(slug, markdown) {
	writeFileSync(join(POSTS_DIR, `${slug}.md`), markdown);
}

export function deletePostFile(slug) {
	const f = join(POSTS_DIR, `${slug}.md`);
	if (existsSync(f)) unlinkSync(f);
}
