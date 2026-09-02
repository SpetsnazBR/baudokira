import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = join(import.meta.dirname, "..");

const IGNORED_DIRS = new Set([
	".git",
	".astro",
	"node_modules",
	"dist",
	"images",
	"public",
	"tests",
]);

function listSourceFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!IGNORED_DIRS.has(entry.name)) {
				files.push(...listSourceFiles(full));
			}
		} else {
			files.push(full);
		}
	}
	return files;
}

describe("Remoção do Sanity CMS", () => {
	test("a pasta sanity/ não deve existir", () => {
		assert.equal(existsSync(join(ROOT, "sanity")), false);
	});

	test("o módulo src/lib/sanity.ts não deve existir", () => {
		assert.equal(existsSync(join(ROOT, "src/lib/sanity.ts")), false);
	});

	test("nenhuma referência a @sanity/portabletext/sanity no código-fonte", () => {
		const files = [
			...listSourceFiles(join(ROOT, "src")),
			...listSourceFiles(join(ROOT, "package")),
		];
		assert.ok(files.length > 0, "deveria haver arquivos-fonte");

		const pattern = /@sanity|portabletext|\bsanity\b/i;
		for (const file of files) {
			const content = readFileSync(file, "utf8");
			assert.ok(
				!pattern.test(content),
				`Referência a sanity encontrada em ${file}`,
			);
		}
	});

	test("package.json não deve conter dependências do Sanity", () => {
		const pkg = JSON.parse(
			readFileSync(join(ROOT, "package.json"), "utf8"),
		) as { dependencies?: Record<string, string> };
		const deps = Object.keys(pkg.dependencies ?? {});
		for (const dep of deps) {
			assert.ok(
				!dep.includes("sanity") && !dep.includes("portabletext"),
				`Dependência do Sanity ainda presente: ${dep}`,
			);
		}
	});

	test("os arquivos .env não devem conter variáveis SANITY", () => {
		for (const file of [".env.example", ".env.local"]) {
			const path = join(ROOT, file);
			if (!existsSync(path)) continue;
			const content = readFileSync(path, "utf8");
			assert.ok(
				!/SANITY/i.test(content),
				`Variável SANITY ainda presente em ${file}`,
			);
		}
	});
});
