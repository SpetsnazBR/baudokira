/**
 * Utilidades compartilhadas do site.
 * Centraliza o "base path" (import.meta.env.BASE_URL) usado em todos os
 * componentes/páginas — com deploy em subpath (/baudokira/), alterar aqui
 * reflete em tudo.
 */
export const base = import.meta.env.BASE_URL;

/** Formata uma data no locale padrão do navegador (ex.: 2/9/2026). */
export function formatDate(date: Date): string {
	return date.toLocaleDateString();
}
