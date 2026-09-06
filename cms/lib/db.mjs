import { DatabaseSync } from "node:sqlite";
import { DB_FILE } from "./config.mjs";

const db = new DatabaseSync(DB_FILE);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS posts (
    slug        TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT,
    tags        TEXT NOT NULL DEFAULT '[]',
    draft       INTEGER NOT NULL DEFAULT 1,
    cover       TEXT,
    content     TEXT NOT NULL DEFAULT '',
    created_on  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function rowToPost(row) {
	if (!row) return null;
	return {
		slug: row.slug,
		title: row.title,
		description: row.description,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		tags: JSON.parse(row.tags),
		draft: Boolean(row.draft),
		cover: row.cover,
		content: row.content,
		createdOn: row.created_on,
	};
}

export function listPosts() {
	return db
		.prepare("SELECT * FROM posts ORDER BY created_at DESC")
		.all()
		.map(rowToPost);
}

export function getPost(slug) {
	return rowToPost(
		db.prepare("SELECT * FROM posts WHERE slug = ?").get(slug),
	);
}

export function slugExists(slug, exceptSlug = null) {
	if (exceptSlug) {
		return Boolean(
			db
				.prepare("SELECT 1 FROM posts WHERE slug = ? AND slug != ?")
				.get(slug, exceptSlug),
		);
	}
	return Boolean(db.prepare("SELECT 1 FROM posts WHERE slug = ?").get(slug));
}

// Colunas de dados de um post (na ordem do schema; slug e separado)
const POST_COLS = ["title", "description", "created_at", "updated_at", "tags", "draft", "cover", "content"];

// Parametros posicionais na ordem de POST_COLS (compartilhado por INSERT/UPDATE)
function postParams(data) {
	return [
		data.title,
		data.description,
		data.createdAt,
		data.updatedAt || null,
		JSON.stringify(data.tags || []),
		data.draft ? 1 : 0,
		data.cover || null,
		data.content || "",
	];
}

export function createPost(data) {
	db.prepare(
		`INSERT INTO posts (slug, ${POST_COLS.join(", ")})
		 VALUES (?, ${POST_COLS.map(() => "?").join(", ")})`,
	).run(data.slug, ...postParams(data));
	return getPost(data.slug);
}

export function updatePost(slug, data) {
	db.prepare(
		`UPDATE posts SET slug = ?, ${POST_COLS.map((c) => `${c} = ?`).join(", ")}
		 WHERE slug = ?`,
	).run(data.slug, ...postParams(data), slug);
	return getPost(data.slug);
}

export function deletePost(slug) {
	db.prepare("DELETE FROM posts WHERE slug = ?").run(slug);
}

// Tags conhecidas: junção das tags usadas nos posts (para o seletor)
export function knownTags() {
	const rows = db.prepare("SELECT tags FROM posts").all();
	const set = new Set();
	for (const row of rows) {
		for (const t of JSON.parse(row.tags)) set.add(t);
	}
	return [...set].sort();
}
