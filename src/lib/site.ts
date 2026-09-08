/**
 * Utilidades compartilhadas do site.
 * Centraliza o "base path" (import.meta.env.BASE_URL) usado em todos os
 * componentes/páginas — com deploy em subpath (/baudokira/), alterar aqui
 * reflete em tudo.
 */
export const base = import.meta.env.BASE_URL;

/**
 * Fuso fixo para exibição de datas. O site é em pt-BR e os posts são salvos
 * com o horário local de São Paulo (-03:00). Fixar o timezone evita que o dia
 * mostrado mude conforme o fuso do ambiente de build (ex.: GitHub Actions roda
 * em UTC) ou do navegador.
 */
const DATE_TZ = "America/Sao_Paulo";

/**
 * Formata uma data como dd/mm/aaaa com zero à esquerda, sempre em pt-BR
 * (ex.: 08/09/2026). NÃO usar toLocaleDateString() sem locale: o resultado
 * depende do ambiente (no build do GitHub Actions vira mês/dia en-US, "9/8/2026").
 */
export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: DATE_TZ,
	}).format(date);
}

/** Formata data + hora por extenso em pt-BR (ex.: 08 de setembro de 2026, 13:00). */
export function formatDateTime(date: Date): string {
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: DATE_TZ,
	}).format(date);
}
