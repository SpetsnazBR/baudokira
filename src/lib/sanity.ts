import { createClient } from "@sanity/client";
import type { SanityImageSource } from "@sanity/image-url";
import { createImageUrlBuilder } from "@sanity/image-url";

// Configuração do cliente Sanity
const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || "production";
const apiVersion = import.meta.env.PUBLIC_SANITY_API_VERSION || "2024-01-01";
const token = import.meta.env.SANITY_API_TOKEN;

export const sanityClient = createClient({
	projectId: projectId || "4s72mcyv",
	dataset,
	apiVersion,
	useCdn: process.env.NODE_ENV === "production",
	token: token, // Token para autenticação com a API do Sanity
});

// Builder para URLs de imagens
const builder = createImageUrlBuilder(sanityClient);

export function urlFor(source: SanityImageSource) {
	return builder.image(source);
}

// Queries GROQ
export const queries = {
	// Buscar todos os posts publicados
	getAllPosts: `*[_type == "post" && published == true] | order(date desc) {
    _id,
    title,
    slug,
    excerpt,
    content,
    coverImage,
    date,
    tags[]->{
      _id,
      name,
      slug
    },
    published
  }`,

	// Buscar post por slug
	getPostBySlug: (
		slug: string,
	) => `*[_type == "post" && slug.current == "${slug}" && published == true][0] {
    _id,
    title,
    slug,
    excerpt,
    content,
    coverImage,
    date,
    tags[]->{
      _id,
      name,
      slug
    },
    published
  }`,

	// Buscar todos os posts por tag
	getPostsByTag: (
		tagSlug: string,
	) => `*[_type == "post" && published == true && "${tagSlug}" in tags[]->slug.current] | order(date desc) {
    _id,
    title,
    slug,
    excerpt,
    content,
    coverImage,
    date,
    tags[]->{
      _id,
      name,
      slug
    },
    published
  }`,

	// Buscar todas as tags
	getAllTags: `*[_type == "tag"] | order(name asc) {
    _id,
    name,
    slug,
    "postCount": count(*[_type == "post" && published == true && references(^._id)])
  }`,

	// Buscar tag por slug
	getTagBySlug: (
		slug: string,
	) => `*[_type == "tag" && slug.current == "${slug}"][0] {
    _id,
    name,
    slug
  }`,

	// Buscar posts recentes (limite)
	getRecentPosts: (
		limit: number = 5,
	) => `*[_type == "post" && published == true] | order(date desc)[0...${limit}] {
    _id,
    title,
    slug,
    excerpt,
    coverImage,
    date
  }`,
};

// Funções auxiliares
export async function getAllPosts() {
	try {
		return await sanityClient.fetch(queries.getAllPosts);
	} catch (error) {
		console.warn("Erro ao buscar posts do Sanity:", error);
		return [];
	}
}

export async function getPostBySlug(slug: string) {
	try {
		return await sanityClient.fetch(queries.getPostBySlug(slug));
	} catch (error) {
		console.warn(`Erro ao buscar post "${slug}" do Sanity:`, error);
		return null;
	}
}

export async function getPostsByTag(tagSlug: string) {
	try {
		return await sanityClient.fetch(queries.getPostsByTag(tagSlug));
	} catch (error) {
		console.warn(`Erro ao buscar posts da tag "${tagSlug}" do Sanity:`, error);
		return [];
	}
}

export async function getAllTags() {
	try {
		return await sanityClient.fetch(queries.getAllTags);
	} catch (error) {
		console.warn("Erro ao buscar tags do Sanity:", error);
		return [];
	}
}

export async function getTagBySlug(slug: string) {
	try {
		return await sanityClient.fetch(queries.getTagBySlug(slug));
	} catch (error) {
		console.warn(`Erro ao buscar tag "${slug}" do Sanity:`, error);
		return null;
	}
}

export async function getRecentPosts(limit: number = 5) {
	try {
		return await sanityClient.fetch(queries.getRecentPosts(limit));
	} catch (error) {
		console.warn("Erro ao buscar posts recentes do Sanity:", error);
		return [];
	}
}

// Tipos TypeScript
export interface SanityPost {
	_id: string;
	title: string;
	slug: {
		current: string;
	};
	excerpt?: string;
	content?: any;
	coverImage?: SanityImageSource;
	date: string;
	tags?: Array<{
		_id: string;
		name: string;
		slug: {
			current: string;
		};
	}>;
	published: boolean;
}

export interface SanityTag {
	_id: string;
	name: string;
	slug: {
		current: string;
	};
	postCount?: number;
}
