import { execFileSync } from "node:child_process";
import { REPO_ROOT, env } from "./config.mjs";

// Caminhos de conteúdo gerenciados pelo CMS (únicos arquivos que ele commita).
// Fonte da verdade: o servidor escreve posts em src/content/posts/*.md, capas
// em src/content/assets/ e mantém o índice de tags em src/content/tags.json.
export const CONTENT_PATHS = [
	"src/content/posts",
	"src/content/assets",
	"src/content/tags.json",
];

function run(args) {
	return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

/**
 * Faz commit dos arquivos de conteúdo gerados pelo CMS.
 * Se CMS_AUTO_PUSH=1, também executa git push (deploy automático).
 *
 * O loop garante o invariante "publicar deixa a working tree limpa":
 * enquanto houver mudanças não commitadas em conteúdo (posts/assets/tags),
 * elas são adicionadas e commitadas. Como este servidor é single-thread e o
 * git roda de forma síncrona, no máximo são necessárias 1–2 passadas.
 */
export function publishPost({ slug, title }) {
	const message = `post: ${slug}${title ? ` — ${String(title).split("\n")[0].slice(0, 80)}` : ""}`;

	const contentDirty = () =>
		run(["status", "--porcelain", "--", ...CONTENT_PATHS]).trim().length > 0;

	// 1. stage + commit de todo o conteúdo, até não sobrar nada
	let committed = false;
	for (let attempt = 0; attempt < 3; attempt++) {
		if (!contentDirty()) break;
		run(["add", ...CONTENT_PATHS]);
		try {
			run(["commit", "-m", message]);
			committed = true;
		} catch {
			// nada para commitar nesta passada (ex.: mudança revertida entre add e commit)
		}
	}

	// 2. push opcional
	let pushed = false;
	if (env.autoPush && committed) {
		run(["push", "origin", "HEAD"]);
		pushed = true;
	}

	return { committed, pushed };
}

export function statusInfo() {
	try {
		const branch = run(["branch", "--show-current"]).trim();
		const ahead = run(["rev-list", "--count", `origin/${branch}..HEAD`]).trim();
		return { branch, commitsAhead: Number(ahead) };
	} catch {
		return { branch: "?", commitsAhead: 0 };
	}
}
