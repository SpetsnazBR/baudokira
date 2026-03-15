import { defineType, defineField } from "sanity";

export default defineType({
	name: "tag",
	title: "Tag",
	type: "document",
	fields: [
		defineField({
			name: "name",
			title: "Nome",
			type: "string",
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: "slug",
			title: "Slug",
			type: "slug",
			options: {
				source: "name",
				maxLength: 50,
			},
			validation: (Rule) => Rule.required(),
		}),
	],
	preview: {
		select: {
			title: "name",
		},
	},
});
