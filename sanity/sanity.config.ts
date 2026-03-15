import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { markdownSchema } from "sanity-plugin-markdown";
import { schemaTypes } from "./schemas";

export default defineConfig({
	name: "default",
	title: "Baú do Kira CMS",

	projectId: "4s72mcyv",
	dataset: "production",

	plugins: [structureTool(), markdownSchema()],

	schema: {
		types: schemaTypes,
	},
});
