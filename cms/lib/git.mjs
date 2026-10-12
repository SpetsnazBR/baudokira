import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { REPO_ROOT } from "./config.mjs";

const execFileP = promisify(execFile);

// Caminhos de conteúdo gerenciados pelo CMS (únicos arquivos que ele commita).
// Fonte da verdade: o servidor escreve posts em src/content/posts/*.md, capas
// em src/content/assets/ e mantém o índice de tags em src/content/tags.json.
export const CONTENT_PATHS = [
	"src/content/posts",
	"src/content/assets",
	"src/content/tags.json",
];

// Tempo limite por operação (ms). O push de um repo grande pode ser mais lento.
// Nada aqui pode travar o servidor para sempre.
const TIMEOUTS = {
	add: 30_000,
	commit: 30_000,
	push: 120_000,
	status: 15_000,
	default: 30_000,
};

function timeoutFor(args) {
	return TIMEOUTS[args[0]] || TIMEOUTS.default;
}

// Converte uma falha do git em Error com mensagem acionável (sem vazar caminhos).
function toGitError(args, err) {
	const stderr = String(err.stderr || "").trim();
	const timedOut = err.killed === true || err.code === "ETIMEDOUT";
	const cmd = `git ${args.join(" ")}`;

	let msg;
	if (timedOut) {
		msg = `${cmd} excedeu o tempo limite (${Math.round(timeoutFor(args) / 1000)}s).`;
	} else if (/could not read (username|password)[^\n]*/i.test(stderr)) {
		msg = "Falha de autenticação do git: credenciais do GitHub não encontradas. Rode `gh auth login` (ou configure o credential helper) e tente de novo.";
	} else if (/authentication failed/i.test(stderr)) {
		msg = "Falha de autenticação do git ao acessar o GitHub. Confira suas credenciais.";
	} else if (/could not resolve host|Could not resolve host/i.test(stderr)) {
		msg = "Sem conexão com o GitHub (host não resolvido). Confira sua rede.";
	} else if (/terminal prompts disabled/i.test(stderr)) {
		msg = "O git precisaria de uma senha interativa, o que é bloqueado no modo automático. Configure as credenciais do GitHub e tente de novo.";
	} else if (/create branch|remote branch/i.test(stderr)) {
		msg = `${cmd} falhou (branch remota ausente?): ${stderr}`;
	} else {
		msg = `${cmd} falhou: ${stderr || err.message || "erro desconhecido do git."}`;
	}

	const e = new Error(msg);
	e.git = { args, stderr, timedOut };
	return e;
}

// Executa um comando git SEM entradas interativas: credencial pendente vira
// erro rápido e claro em vez de travar o servidor esperando um prompt.
async function run(args) {
	try {
		const { stdout } = await execFileP("git", args, {
			cwd: REPO_ROOT,
			encoding: "utf8",
			windowsHide: true,
			timeout: timeoutFor(args),
			// nunca pedir senha/usuario no terminal (fail-fast com erro legivel)
			env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
		});
		return stdout;
	} catch (err) {
		const stderr = String(err.stderr || "").trim();
		// "nothing to commit" não é erro: o estado já está publicado.
		if (
			args[0] === "commit" &&
			/nothing to commit|nothing added to commit/i.test(stderr)
		) {
			return "";
		}
		throw toGitError(args, err);
	}
}

// Conta commits locais ainda não enviados à branch remota da atual.
// Sem branch remota (primeiro push) ou falha, retorna 0 (push será tentado).
async function commitsAhead() {
	try {
		const branch = (await run(["branch", "--show-current"])).trim();
		if (!branch) return 0;
		const count = (await run(["rev-list", "--count", `origin/${branch}..HEAD`])).trim();
		return Number(count) || 0;
	} catch {
		return 0;
	}
}

// Evita duas publicações simultâneas (git ignore daria conflito de index).
let publishing = false;

/**
 * Publica os arquivos de conteúdo gerados pelo CMS: `git add` + `git commit`
 * do que estiver pendente em src/content (posts/assets/tags.json) e, por
 * padrão, `git push` automático (deploy no GitHub Pages).
 *
 * O loop garante o invariante "publicar deixa a working tree limpa": enquanto
 * houver mudanças de conteúdo, elas são adicionadas e commitadas. No máximo 1–2
 * passadas são necessárias, mas o limite de 3 evita laço infinito.
 *
 * O push também acontece quando a árvore já está limpa mas há commits locais
 * pendentes — assim um segundo clique no botão ainda sincroniza o GitHub.
 */
export async function publishPost({ slug, title }, { push = true } = {}) {
	if (publishing) {
		throw new Error("Outra publicação já está em andamento. Aguarde terminar.");
	}
	publishing = true;
	const message = `post: ${slug}${title ? ` — ${String(title).split("\n")[0].slice(0, 80)}` : ""}`;
	try {
		// 1. stage + commit de todo o conteúdo pendente
		let committed = false;
		for (let attempt = 0; attempt < 3; attempt++) {
			const status = await run(["status", "--porcelain", "--", ...CONTENT_PATHS]);
			if (!status.trim()) break;
			await run(["add", ...CONTENT_PATHS]);
			await run(["commit", "-m", message]);
			committed = true;
		}

		// 2. push (deploy automático). Também sincroniza commits pendentes.
		let pushed = false;
		if (push) {
			if (committed || (await commitsAhead()) > 0) {
				await run(["push", "origin", "HEAD"]);
				pushed = true;
			}
		}

		return { committed, pushed };
	} finally {
		publishing = false;
	}
}

export async function statusInfo() {
	try {
		const branch = (await run(["branch", "--show-current"])).trim();
		let commitsAheadCount = 0;
		if (branch) {
			try {
				const count = (await run(["rev-list", "--count", `origin/${branch}..HEAD`])).trim();
				commitsAheadCount = Number(count) || 0;
			} catch {
				commitsAheadCount = 0; // sem branch remota ainda
			}
		}
		return { branch: branch || "?", commitsAhead: commitsAheadCount };
	} catch {
		return { branch: "?", commitsAhead: 0 };
	}
}
