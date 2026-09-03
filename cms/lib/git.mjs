import { execFileSync } from "node:child_process";
import { REPO_ROOT, env } from "./config.mjs";

function run(args) {
	return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

/**
 * Faz commit dos arquivos de conteúdo gerados pelo CMS.
 * Se CMS_AUTO_PUSH=1, também executa git push (deploy automático).
 */
export function publishPost({ slug, title }) {
	const message = `post: ${slug}${title ? ` — ${String(title).split("\n")[0].slice(0, 80)}` : ""}`;

	// 1. stage do conteúdo gerado
	run(["add", "src/content/posts", "src/content/assets", "src/content/tags.json"]);

	// 2. commit (pode não haver nada para commitar se nada mudou)
	let committed = true;
	try {
		run(["commit", "-m", message]);
	} catch {
		committed = false; // nothing to commit
	}

	// 3. push opcional
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
