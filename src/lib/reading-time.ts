/**
 * Estima o tempo de leitura de um post em minutos.
 * Considera palavras, imagens e blocos de código.
 */
export function timeToRead(content: string): number {
	const numWords = (content || "")
		.replace(/.*\[(.*?)\].*/gm, "$1")
		.replace(/```.*?```/gms, "")
		.split(/\s+/).length;

	const numImages = content?.match(/!\[/g)?.length || 0;
	const numCodeblocks = content?.match(/```/g)?.length || 0;

	return (
		Math.ceil(numWords / 200) +
		Math.ceil(numImages / 6) +
		Math.ceil(numCodeblocks / 3)
	);
}
