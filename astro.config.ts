import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import spectre from './package/src';
import { spectreDark } from './src/ec-theme';

// https://astro.build/config
const config = defineConfig({
	site: 'https://spetsnazbr.github.io/baudokira',
	base: '/baudokira/',
	output: 'static',
	server: {
		port: 3334,
	},
	integrations: [
		expressiveCode({
			themes: [spectreDark],
		}),
		mdx(),
		sitemap(),
		spectre({
			name: 'Baú do Kira',
			openGraph: {
				home: {
					title: 'Baú do Kira',
					description: 'Um tema minimalista para Astro.',
				},
				blog: {
					title: 'Blog',
					description: 'Notícias e guias para o Baú do Kira.',
				},
				projects: {
					title: 'Projetos',
				},
			},
		}),
	],
});

export default config;
