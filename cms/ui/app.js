"use strict";

const $ = (id) => document.getElementById(id);
let current = null; // { slug, post }
let pendingCover = null;
// Endereço/base do servidor Astro (usados pelo botão "Preview no blog")
let astroCfg = { url: "http://localhost:3334", base: "/baudokira" };
// Estado do auto-save
let dirty = false; // há alterações ainda não salvas
let autoSaving = false; // um auto-save está em andamento
let publishing = false; // um publish está em andamento (bloqueia auto-save)
let autoError = null; // última falha do auto-save (para exibir)
let lastSaveAt = null; // horário do último salvamento

function token() { return localStorage.getItem("cms_token") || ""; }
function setMsg(text, kind) {
	const m = $("msg");
	m.textContent = text;
	m.className = kind || "info";
	m.style.display = "block";
}

async function api(path, opts = {}) {
	const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
	if (token()) headers.Authorization = "Bearer " + token();
	const res = await fetch(path, Object.assign({}, opts, { headers }));
	if (res.status === 401) {
		const t = prompt("Token de acesso (consulte o valor em cms/.env):");
		if (t) { localStorage.setItem("cms_token", t); return api(path, opts); }
		throw new Error("Acesso negado - informe o token.");
	}
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
	return data;
}

function readImageFile(file, maxDim = 1600) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);
		img.onload = () => {
			const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
			const canvas = document.createElement("canvas");
			canvas.width = Math.round(img.width * scale);
			canvas.height = Math.round(img.height * scale);
			canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
			URL.revokeObjectURL(url);
			resolve(canvas.toDataURL("image/webp", 0.85));
		};
		img.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
		img.src = url;
	});
}

// ---- Lista ----
async function refresh() {
	try {
		const [{ posts }, { tags }, git] = await Promise.all([
			api("/api/posts"), api("/api/tags"), api("/api/status"),
		]);
		if (git.astro) {
			astroCfg.url = git.astro.url || astroCfg.url;
			astroCfg.base = git.astro.base || astroCfg.base;
		}
		updatePreview();
		renderPosts(posts);
		$("tagsHint").textContent = "Sugestoes: " + (tags.length ? tags.join(", ") : "(nenhuma ainda)");
		$("gitStatus").textContent = "branch " + git.branch + " · " + git.commitsAhead + " commit(s) · Astro " + astroCfg.url;
	} catch (e) { setMsg(e.message, "err"); }
}

function escapeHtml(s) {
	return String(s ?? "").replace(/[&<>"']/g, (c) => ({
		"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
	}[c]));
}

function renderPosts(posts) {
	const ul = $("posts");
	ul.innerHTML = "";
	if (!posts.length) {
		const li = document.createElement("li");
		li.textContent = "Nenhuma postagem ainda.";
		li.style.color = "var(--muted)";
		ul.appendChild(li);
		return;
	}
	for (const p of posts) {
		const li = document.createElement("li");
		li.innerHTML =
			'<span class="dot ' + (p.draft ? "draft" : "pub") + '"></span>' +
			"<div><div>" + escapeHtml(p.title) + '</div><div class="slug">/' + escapeHtml(p.slug) + "</div></div>";
		li.onclick = () => openPost(p.slug);
		if (current && current.slug === p.slug) li.classList.add("active");
		ul.appendChild(li);
	}
}

// ---- Formulario ----
function resetForm() {
	current = null; pendingCover = null;
	$("postForm").reset();
	$("f-originalSlug").value = "";
	$("f-date").value = new Date().toISOString().slice(0, 10);
	$("f-time").value = "12:00";
	$("f-draft").checked = true;
	$("coverPreview").style.display = "none";
	$("coverPreview").removeAttribute("src");
	$("deleteBtn").style.display = "none";
	$("publishBtn").style.display = "none";
	$("publishNote").textContent = "";
	$("saveBtn").textContent = "Salvar (gera .md no Astro)";
	$("f-title").focus();
	updatePreview();
	dirty = false;
	autoError = null;
	lastSaveAt = null;
	updateSaveState();
}

async function openPost(slug) {
	try {
		const { post } = await api("/api/posts/" + encodeURIComponent(slug));
		current = { slug, post };
		$("f-originalSlug").value = post.slug;
		$("f-title").value = post.title;
		$("f-description").value = post.description;
		const d = new Date(post.createdAt);
		$("f-date").value = d.toISOString().slice(0, 10);
		$("f-time").value = d.toTimeString().slice(0, 5);
		$("f-slug").value = post.slug;
		$("f-tags").value = (post.tags || []).join(", ");
		$("f-content").value = post.content || "";
		$("f-draft").checked = !!post.draft;
		$("f-updated").checked = false;
		pendingCover = null;
		showCover(post.cover);
		$("deleteBtn").style.display = "";
		$("publishBtn").style.display = "";
		$("saveBtn").textContent = "Salvar alteracoes";
		updatePreview();
		dirty = false;
		autoError = null;
		updateSaveState();
		refresh();
	} catch (e) { setMsg(e.message, "err"); }
}

function showCover(cover) {
	const img = $("coverPreview");
	if (cover && cover.startsWith("../assets/")) {
		img.src = "/api/assets/" + encodeURIComponent(cover.replace("../assets/", ""));
		img.style.display = "block";
	} else { img.style.display = "none"; img.removeAttribute("src"); }
}

// ---- Preview no blog (Astro em execução) ----
function astroPreviewUrl() {
	if (!current || !current.slug) return "";
	const host = (astroCfg.url || "http://localhost:3334").replace(/\/+$/, "");
	const base = (astroCfg.base || "/baudokira").replace(/\/+$/, "");
	return host + base + "/blog/" + encodeURIComponent(current.slug);
}
function updatePreview() {
	const b = $("previewBtn");
	if (current && current.slug) {
		b.disabled = false;
		b.title = "Abrir no blog (Astro): " + astroPreviewUrl();
	} else {
		b.disabled = true;
		b.title = "Crie/salve uma postagem para habilitar o preview.";
	}
}
// Candidatos a URL do preview: a configurada + troca localhost/127.0.0.1
function previewCandidates() {
	const urls = [];
	if (!current || !current.slug) return urls;
	const first = astroPreviewUrl();
	urls.push(first);
	try {
		const p = new URL(first);
		let altHost = null;
		if (p.hostname === "localhost") altHost = "127.0.0.1";
		else if (p.hostname === "127.0.0.1") altHost = "localhost";
		if (altHost) {
			const alt = new URL(first);
			alt.hostname = altHost;
			urls.push(alt.href);
		}
	} catch {
		// URL inválida: fica só com o valor original
	}
	return urls;
}
// Testa se o servidor respondeu (fetch no-cors: só falha se não houver rede)
function astroReachable(url) {
	return fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store" })
		.then(() => true)
		.catch(() => false);
}
async function previewPost() {
	if (!current || !current.slug) {
		setMsg("Salve a postagem primeiro para gerar o preview.", "err");
		return;
	}
	// Salva o que ainda não foi salvo antes de abrir o preview
	if (dirty) {
		setMsg("Salvando as alterações antes de abrir o preview…", "info");
		const ok = await save({ auto: true });
		if (!ok) return;
	}
	if (current.post && current.post.draft) {
		setMsg("Rascunho: visível agora no preview local (dev). Para publicar no site, desmarque 'Rascunho' e salve.", "info");
	}
	for (const url of previewCandidates()) {
		if (await astroReachable(url)) {
			try {
				astroCfg.url = new URL(url).origin;
				updatePreview();
			} catch {
				// mantém a configuração atual
			}
			window.open(url, "_blank", "noopener");
			return;
		}
	}
	setMsg(
		"Servidor Astro não está acessível em " + astroCfg.url +
		". Inicie com ./run-servers.sh (ou npm run dev) e tente de novo.",
		"err",
	);
}

function collectPayload() {
	const date = $("f-date").value;
	if (!date) throw new Error("Informe a data.");
	return {
		title: $("f-title").value,
		slug: $("f-slug").value,
		description: $("f-description").value,
		date: date,
		time: $("f-time").value,
		tags: $("f-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
		draft: $("f-draft").checked,
		touchUpdated: $("f-updated").checked,
		content: $("f-content").value,
		...(pendingCover ? { coverData: pendingCover } : {}),
		...(!pendingCover && current && current.post.cover ? { cover: current.post.cover } : {}),
	};
}


// ---- Auto-save (a cada 10s) e estado de salvamento ----
function autoSavable() {
	return $("f-title").value.trim() !== "" &&
		$("f-description").value.trim() !== "" &&
		$("f-date").value !== "" &&
		$("f-content").value.trim() !== "";
}
function markDirty() {
	dirty = true;
	autoError = null;
	updateSaveState();
}
function updateSaveState() {
	const el = $("saveState");
	if (!el) return;
	if (autoSaving) {
		el.textContent = "Salvando…";
		return;
	}
	if (dirty) {
		el.textContent = autoError
			? "⚠️ Auto-save falhou: " + autoError
			: "✏️ Alterações não salvas — auto-save a cada 10s.";
		return;
	}
	el.textContent = lastSaveAt
		? "💾 Salvo às " + lastSaveAt + " · auto-save a cada 10s"
		: "⏱️ Auto-save a cada 10s.";
}
function startAutoSave() {
	setInterval(() => maybeAutoSave(), 10000);
}
async function maybeAutoSave() {
	if (!dirty || autoSaving || publishing) return;
	// Post novo: só auto-cria quando houver dados mínimos (título, descrição, data e conteúdo)
	if (!current && !autoSavable()) return;
	autoSaving = true;
	updateSaveState();
	await save({ auto: true });
	autoSaving = false;
	updateSaveState();
}

async function save(opts = {}) {
	const auto = !!opts.auto;
	try {
		const payload = collectPayload();
		if (!auto) $("saveBtn").disabled = true;
		const { post, addedTags } = current
			? await api("/api/posts/" + encodeURIComponent(current.slug), { method: "PUT", body: JSON.stringify(payload) })
			: await api("/api/posts", { method: "POST", body: JSON.stringify(payload) });
		pendingCover = null;
		current = { slug: post.slug, post };
		updatePreview();
		$("f-originalSlug").value = post.slug;
		$("f-slug").value = post.slug;
		$("publishBtn").style.display = "";
		$("deleteBtn").style.display = "";
		dirty = false;
		autoError = null;
		lastSaveAt = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
		updateSaveState();
		if (!auto) {
			setMsg("Salvo! Arquivo src/content/posts/" + post.slug + ".md gerado" +
				(addedTags && addedTags.length ? " · tags novas: " + addedTags.join(", ") : "") + ".", "ok");
		}
		await refresh();
		return true;
	} catch (e) {
		if (auto) {
			autoError = e.message;
			updateSaveState();
		} else {
			setMsg(e.message, "err");
		}
		dirty = true;
		return false;
	} finally {
		if (!auto) $("saveBtn").disabled = false;
	}
}

async function publish() {
	if (!current) return;
	publishing = true;
	try {
		$("publishBtn").disabled = true;
		$("saveBtn").disabled = true;
		// 1. Se houver auto-save em andamento, espera terminar.
		while (autoSaving) await new Promise((resolve) => setTimeout(resolve, 100));
		// 2. Publica SEMPRE a versão atual do editor: um save pendente é gravado
		//    no .md ANTES do commit. Sem isso, um auto-save posterior (a cada 10s)
		//    reescreveria o arquivo depois do commit e deixaria a working tree suja.
		if (dirty) {
			const ok = await save();
			if (!ok) return; // save falhou: não publica uma versão antiga por engano
		}
		// 3. Commit (e push se CMS_AUTO_PUSH=1).
		const r = await api("/api/posts/" + encodeURIComponent(current.slug) + "/publish", { method: "POST" });
		const msg = r.published.committed
			? (r.published.pushed ? "Commit + push OK - deploy automatico iniciado!" : "Commit local OK. Faca o push quando quiser (CMS_AUTO_PUSH=0).")
			: "Nada novo para commitar (post ja estava publicado).";
		setMsg(msg, "ok");
		dirty = false; // evita auto-save logo após o publish
		await refresh();
	} catch (e) { setMsg(e.message, "err"); } finally { $("publishBtn").disabled = false; $("saveBtn").disabled = false; publishing = false; }
}

async function remove() {
	if (!current) return;
	if (!confirm("Excluir a postagem '" + current.post.title + "'? O arquivo .md sera removido.")) return;
	try {
		await api("/api/posts/" + encodeURIComponent(current.slug), { method: "DELETE" });
		resetForm();
		setMsg("Postagem excluida.", "ok");
		await refresh();
	} catch (e) { setMsg(e.message, "err"); }
}

// ---- Conteudo / toolbar / imagens ----
function insertAtCursor(ta, text) {
	markDirty();
	const s = ta.selectionStart, e = ta.selectionEnd;
	ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
	ta.selectionStart = ta.selectionEnd = s + text.length;
	ta.focus();
}
function wrapSelection(ta, before, after) {
	markDirty();
	const s = ta.selectionStart, e = ta.selectionEnd;
	const sel = ta.value.slice(s, e) || "texto";
	ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
	ta.selectionStart = s + before.length;
	ta.selectionEnd = s + before.length + sel.length;
	ta.focus();
}

// ---- Formatação Markdown (toolbar) ----
const mta = () => $("f-content");
function setCursor(t, start, end) {
	t.focus();
	t.selectionStart = start;
	t.selectionEnd = end === undefined ? start : end;
}
function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isHeadingPrefix(marker) {
	return /^#+$/.test(marker);
}
function lineHasPrefix(body, marker) {
	if (isHeadingPrefix(marker)) {
		const m = body.match(/^(#{1,6})(?=\s|$)/);
		return !!m && m[1].length === marker.length;
	}
	return body.startsWith(marker);
}
function stripLinePrefix(body, marker) {
	if (isHeadingPrefix(marker)) {
		return body.replace(/^(#{1,6})[ \t]+/, "");
	}
	return body.replace(new RegExp("^" + escapeRe(marker) + "[ \\t]*"), "");
}
// Aplica (ou remove) um prefixo no início da(s) linha(s) sob o cursor/seleção
function prefixFormat(prefix, marker) {
	markDirty();
	const t = mta();
	const v = t.value;
	const s = t.selectionStart, e = t.selectionEnd;
	const ls = v.lastIndexOf("\n", Math.max(0, s - 1)) + 1;
	let le = v.indexOf("\n", e);
	if (le === -1) le = v.length;
	const raw = v.slice(ls, le);
	const multi = raw.includes("\n");
	const lines = raw.split("\n");
	// Linha em branco: apenas insere o prefixo (ex.: começar um título novo)
	if (lines.length === 1 && lines[0].trim() === "") {
		t.value = v.slice(0, ls) + prefix + v.slice(le);
		setCursor(t, ls + prefix.length);
		return;
	}
	const meaningful = lines.filter((l) => l.trim() !== "");
	const allMarked = meaningful.length > 0 &&
		meaningful.every((l) => lineHasPrefix(l.trimStart(), marker));
	const out = lines.map((l) => {
		const m = l.match(/^\s*/);
		const indent = m ? m[0] : "";
		const body = l.slice(indent.length);
		if (body.trim() === "") return l;
		if (allMarked && lineHasPrefix(body, marker)) return indent + stripLinePrefix(body, marker);
		if (!allMarked) {
			// Títulos: se a linha já é um heading de outro nível, converte para o nível clicado
			if (isHeadingPrefix(marker) && /^(#{1,6})(?=\s|$)/.test(body)) {
				if (lineHasPrefix(body, marker)) return l;
				return indent + prefix + body.replace(/^(#{1,6})[ \t]+/, "");
			}
			if (!lineHasPrefix(body, marker)) return indent + prefix + body;
		}
		return l;
	}).join("\n");
	t.value = v.slice(0, ls) + out + v.slice(le);
	const end = ls + out.length;
	if (multi) {
		setCursor(t, ls, end);
	} else {
		const delta = out.length - raw.length;
		const rel = Math.max(0, s - ls);
		setCursor(t, Math.min(Math.max(ls, ls + rel + delta), end));
	}
}
// Insere um bloco (lista de linhas) em linha própria, com separação
function insertOwnBlock(blockLines, select) {
	markDirty();
	const t = mta();
	const v = t.value;
	const s = t.selectionStart;
	const ls = v.lastIndexOf("\n", Math.max(0, s - 1)) + 1;
	let le = v.indexOf("\n", s);
	if (le === -1) le = v.length;
	const hasText = v.slice(ls, le).trim() !== "";
	const at = hasText ? (le < v.length ? le + 1 : le) : ls;
	const head = v.slice(0, at);
	let lead;
	if (head === "" || head.endsWith("\n\n")) lead = "";
	else if (head.endsWith("\n")) lead = "\n";
	else lead = "\n\n";
	const block = blockLines.join("\n");
	const text = lead + block + "\n";
	t.value = v.slice(0, at) + text + v.slice(at);
	const base = at + lead.length;
	if (select) {
		setCursor(t, base + select.at, base + select.at + select.len);
	} else {
		setCursor(t, base + block.length);
	}
}
function formatLink() {
	markDirty();
	const t = mta();
	const v = t.value;
	const s = t.selectionStart, e = t.selectionEnd;
	const sel = v.slice(s, e).trim();
	let mark, a, b;
	if (sel) {
		mark = "[" + sel + "](https://url)";
		a = s + mark.indexOf("url");
		b = a + 3;
	} else {
		mark = "[texto](https://url)";
		a = s + mark.indexOf("texto");
		b = a + 5;
	}
	t.value = v.slice(0, s) + mark + v.slice(e);
	setCursor(t, a, b);
}
function snippetFormat(kind) {
	markDirty();
	if (kind === "link") return formatLink();
	const t = mta();
	const sel = t.value.slice(t.selectionStart, t.selectionEnd).trim();
	if (kind === "code") {
		if (sel) {
			const s = t.selectionStart, e = t.selectionEnd;
			const wrapped = "```\n" + sel + "\n```";
			t.value = t.value.slice(0, s) + wrapped + t.value.slice(e);
			setCursor(t, s, s + wrapped.length);
			return;
		}
		return insertOwnBlock(["```", "", "```"], { at: 4, len: 0 });
	}
	if (kind === "hr") return insertOwnBlock(["---"]);
	if (kind === "table") {
		const tb = ["| Coluna 1 | Coluna 2 | Coluna 3 |", "| --- | --- | --- |", "|  |  |  |"];
		return insertOwnBlock(tb, { at: tb[0].indexOf("Coluna 1"), len: "Coluna 1".length });
	}
}

document.querySelectorAll(".toolbar [data-prefix]").forEach((b) =>
	b.onclick = () => prefixFormat(b.dataset.prefix, b.dataset.marker));
document.querySelectorAll(".toolbar [data-wrap]").forEach((b) =>
	b.onclick = () => wrapSelection(mta(), b.dataset.wrap, b.dataset.wrap));
document.querySelectorAll(".toolbar [data-snippet]").forEach((b) =>
	b.onclick = () => snippetFormat(b.dataset.snippet));

// ---- Seletor de emojis (facilita a formatação do texto) ----
// Listas separadas por espaço (cada "palavra" é um emoji).
const EMOJI_GROUPS = [
	["Carinhas e gestos", "😀 😄 😁 😆 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😎 🤓 🧐 🤔 🤗 🤭 😴 😪 😮💨 😢 😭 😤 😡 🤯 😱 🥶 🥵 😷 🤒 🤕 🤮 🫡 🤝 👍 👎 👌 ✌️ 🤞 🤟 🤘 👏 🙏 💪 👀 🧠 👋 ✋ 🫶 💅"],
	["Corações e símbolos", "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 💕 💞 💓 💗 💖 💘 💝 ✅ ❌ ❎ ➕ ➖ ➗ ✖️ 🔁 🔂 ▶️ ⏸️ ▶️ 🔃 🔄 ⭐ 🌟 ✨ ⚡ 🔥 💫 💥 💯 💬 💭 🕳️ ♨️ 💦 💨 ☀️ 🌙 ☁️ ⛅ 🌈 ❄️ 🌪️"],
	["Tecnologia, objetos e ferramentas", "💻 🖥️ ⌨️ 🖱️ 🖨️ 📱 💾 📷 📸 🎥 📺 🎙️ 🔊 🔔 ⏰ ⌚ 📅 📆 📁 📂 🗂️ 📋 📝 ✏️ ✒️ 🖊️ 🖋️ 🖌️ 🖍️ 📌 📍 📎 ✂️ 🔑 🔒 🔓 🔗 🧷 🧹 🧽 🛠️ 🔧 🔨 ⚙️ 🧰 🔩 🧲 💡 🔦 🔋 🔌 💳 💰 🧾 🏷️ 📦 🎁 🧊 📚 🔖 🗑️"],
	["Comida, animais, natureza e mais", "🍎 🍊 🍌 🍉 🍓 🍒 🍑 🥭 🍍 🥥 🥑 🍅 🌽 🥕 🥦 🥐 🍞 🧀 🍳 🍔 🍟 🍕 🥪 🌮 🍜 🍣 🍦 🍩 🍪 🎂 🧁 🍫 ☕ 🍵 🍺 🥂 🥤 🐶 🐱 🐭 🐰 🦊 🐻 🐼 🦁 🐯 🐸 🐵 🦄 🐷 🐺 🦉 🦋 🐝 🐢 🐙 🦈 🌍 🌎 🌏 🌱 🌿 🍀 🌻 🌹 🌵 🌲 🌊 ☀️ 🚀 ✈️ 🚗 🚲 ⛵ 🎉 🎊 🎈 🎁 🏆 🎮 🎧 🎵 🎶 🎨 🧩 🔮 ⭐"],
];
function closeEmojiPicker() {
	$("emojiToggle").setAttribute("aria-expanded", "false");
	$("emojiGrid").hidden = true;
}
function insertEmoji(emoji) {
	insertAtCursor(mta(), emoji);
	closeEmojiPicker();
}
function toggleEmojiPicker() {
	const grid = $("emojiGrid");
	grid.hidden = !grid.hidden;
	$("emojiToggle").setAttribute("aria-expanded", String(!grid.hidden));
}
// Fecha o seletor ao clicar fora dele (o seletor só abre ao clicar no botão)
if (document.addEventListener) {
	document.addEventListener("click", (ev) => {
		const grid = $("emojiGrid");
		if (grid.hidden) return;
		const toggle = $("emojiToggle");
		const picker = toggle.closest ? toggle.closest(".emoji-picker") : null;
		if (picker && picker.contains(ev.target)) return;
		closeEmojiPicker();
	});
}
function buildEmojiPicker() {
	const grid = $("emojiGrid");
	if (!grid) return;
	const parts = [];
	for (const [label, list] of EMOJI_GROUPS) {
		parts.push('<div class="emoji-group">' + label + "</div>");
		for (const emoji of list.split(" ")) {
			if (!emoji) continue;
			parts.push(
				'<button type="button" class="emoji-btn" data-emoji="' + emoji +
				'" title="Inserir ' + emoji + '">' + emoji + "</button>",
			);
		}
	}
	grid.innerHTML = parts.join("");
	grid.querySelectorAll(".emoji-btn").forEach((b) => {
		b.onclick = () => insertEmoji(b.dataset.emoji);
	});
}
$("emojiToggle").onclick = toggleEmojiPicker;
buildEmojiPicker();

$("f-coverFile").addEventListener("change", async (e) => {
	const file = e.target.files[0];
	if (!file) return;
	try {
		pendingCover = await readImageFile(file, 1600);
		const img = $("coverPreview");
		img.src = pendingCover;
		img.style.display = "block";
	} catch (err) { setMsg(err.message, "err"); }
	e.target.value = "";
});

$("imgBtn").onclick = () => $("f-imgFile").click();
$("f-imgFile").addEventListener("change", async (e) => {
	const file = e.target.files[0];
	if (!file) return;
	try {
		const dataUrl = await readImageFile(file, 1800);
		const r = await api("/api/images", { method: "POST", body: JSON.stringify({ data: dataUrl, alt: file.name.replace(/\.[^.]+$/, "") }) });
		insertAtCursor($("f-content"), "\n" + r.embed + "\n");
		setMsg("Imagem enviada para assets/ e inserida no conteudo.", "ok");
		refresh();
	} catch (err) { setMsg(err.message, "err"); }
	e.target.value = "";
});

// ---- Eventos globais ----
$("postForm").addEventListener("submit", (e) => { e.preventDefault(); save(); });
$("postForm").addEventListener("input", markDirty);
$("postForm").addEventListener("change", markDirty);
$("publishBtn").onclick = publish;
$("deleteBtn").onclick = remove;
$("previewBtn").onclick = previewPost;
$("newPostBtn").onclick = () => { resetForm(); refresh(); };
$("tokenBtn").onclick = () => {
	const t = prompt("Token de acesso (deixe vazio para remover):", token());
	if (t !== null) { localStorage.setItem("cms_token", t); setMsg(t ? "Token salvo." : "Token removido.", "ok"); }
};
$("f-slug").addEventListener("input", () => { $("f-slug").dataset.manual = "1"; });
$("f-title").addEventListener("input", () => { if (!$("f-slug").dataset.manual) $("f-slug").value = ""; });

startAutoSave();
resetForm();
refresh();
