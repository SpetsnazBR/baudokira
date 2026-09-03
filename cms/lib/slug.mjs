// Geração de slug a partir de títulos (pt-BR + ASCII)
export function slugify(input) {
	return String(input || "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // remove acentos
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-") // não-alfanumérico -> hífen
		.replace(/^-+|-+$/g, "") // remove hífens nas pontas
		.slice(0, 80);
}

// Data/hora local para o frontmatter (formato aceito por z.coerce.date)
// Ex.: 2026-09-02T14:30:00-03:00
export function toIsoLocal(dateStr, timeStr) {
	const date = dateStr || new Date().toISOString().slice(0, 10);
	const time = timeStr || "12:00";
	// monta no fuso local
	const [y, m, d] = date.split("-").map(Number);
	const [hh, mm] = time.split(":").map(Number);
	const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
	if (Number.isNaN(dt.getTime())) {
		throw new Error(`Data/hora inválida: ${date} ${time}`);
	}
	const pad = (n) => String(n).padStart(2, "0");
	const off = -dt.getTimezoneOffset();
	const sign = off >= 0 ? "+" : "-";
	const tz = `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
	return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00${tz}`;
}
