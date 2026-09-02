import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { timeToRead } from "../src/lib/reading-time.ts";

describe("timeToRead", () => {
	it("retorna tempo de leitura para conteúdo vazio", () => {
		// "".split(/\s+/) retorna [""] -> 1 "palavra" -> ceil(1/200) = 1
		assert.equal(timeToRead(""), 1);
	});

	it("estima 1 minuto para 200 palavras", () => {
		const words = Array(200).fill("palavra").join(" ");
		assert.equal(timeToRead(words), 1);
	});

	it("adiciona minutos proporcionais ao volume de palavras", () => {
		const words = Array(600).fill("palavra").join(" ");
		// ceil(600/200) = 3
		assert.equal(timeToRead(words), 3);
	});

	it("conta imagens no tempo de leitura", () => {
		// 6 imagens = +1 minuto (1 palavra de base)
		const content = Array(6)
			.fill(0)
			.map((_, i) => `![img ${i}](img${i}.png)`)
			.join(" ");
		assert.equal(timeToRead(content), 2);
	});

	it("ignora código em bloco no cálculo de palavras", () => {
		const content = "```js\n" + "x".repeat(1000) + "\n```";
		// 1 palavra base ("" -> [""]), 1 bloco de código (2x ```) -> ceil(2/3) = 1
		// total = ceil(1/200) + ceil(2/3) = 2
		assert.equal(timeToRead(content), 2);
	});
});
