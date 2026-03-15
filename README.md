# Baú do Kira

![Baú do Kira](./images/README.png)

Um blog pessoal minimalista inspirado em terminal, construído com Astro e integrado com Sanity CMS.

## ✨ Funcionalidades

- 🚀 **100/100 no Lighthouse** - Performance otimizada
- 📱 **Responsivo** - Adaptável a todos os tamanhos de tela
- ♿ **Acessível** - Navegação completa por teclado e compatível com leitores de tela
- 🔍 **Busca integrada** - Powered by [Pagefind](https://pagefind.app)
- 💬 **Comentários** - Sistema de comentários com [Giscus](https://giscus.app) (opcional)
- 📝 **Markdown/MDX** - Suporte completo para escrita de posts
- 🎨 **Tema escuro** - Design minimalista em modo escuro
- 🗺️ **Sitemap automático** - SEO otimizado
- 📦 **Content Collections** - Posts e projetos organizados
- 🔒 **TypeScript** - Código type-safe

## 🆕 Integração com Sanity CMS

Este blog possui integração com [Sanity CMS](https://www.sanity.io/), permitindo:

- ✍️ Criar e editar posts através de um painel administrativo
- 🏷️ Gerenciamento de tags
- 🖼️ Upload de imagens
- 📄 Edição de conteúdo em Markdown
- 🔄 Posts locais (MDX) e do Sanity funcionam juntos

## 🚀 Começando

### Pré-requisitos

- Node.js 18+
- npm ou pnpm

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/SpetsnazBR/blog.git
cd blog

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Edite o .env.local com suas credenciais
```

### Configurar Sanity CMS

1. Crie uma conta em [sanity.io](https://www.sanity.io/)
2. Crie um novo projeto e obtenha o Project ID
3. Configure as variáveis no `.env.local`:

```env
SANITY_STUDIO_PROJECT_ID=seu_project_id
SANITY_STUDIO_DATASET=production
SANITY_API_TOKEN=seu_token

PUBLIC_SANITY_PROJECT_ID=seu_project_id
PUBLIC_SANITY_DATASET=production
PUBLIC_SANITY_API_VERSION=2024-01-01
```

4. Inicie o Sanity Studio:

```bash
cd sanity
npm install
npm run dev
```

O Sanity Studio estará disponível em: http://localhost:3333

### Executar o blog

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Iniciar servidor de produção
npm run start
```

O blog estará disponível em: http://localhost:3334

## 📁 Estrutura do Projeto

```
├── public/              # Arquivos estáticos
├── sanity/              # Configuração do Sanity CMS
│   ├── schemas/         # Schemas (posts, tags)
│   └── sanity.config.ts # Configuração
├── src/
│   ├── components/      # Componentes Astro
│   ├── content/         # Conteúdo local (MDX)
│   │   ├── other/       # Página sobre
│   │   └── projects/    # Projetos
│   ├── layouts/         # Layouts
│   ├── lib/             # Utilitários (cliente Sanity)
│   ├── pages/           # Páginas e rotas
│   ├── scripts/         # Scripts client-side
│   └── styles/          # Estilos CSS
└── package.json
```

## 📝 Criando Posts

### Via Sanity CMS (recomendado)

1. Acesse o Sanity Studio (http://localhost:3333)
2. Clique em "Posts" > "Create new"
3. Preencha título, slug, conteúdo e publique

### Via arquivos MDX (local)

Crie um arquivo em `src/content/posts/` seguindo o formato:

```mdx
---
title: "Título do Post"
description: "Descrição do post"
createdAt: 2024-01-01
tags: ["tag1", "tag2"]
image: "./imagem.png"
draft: false
---

Conteúdo do post aqui...
```

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Build para produção |
| `npm run start` | Inicia servidor de produção |
| `npm run preview` | Preview do build |
| `npm run lint` | Verifica código com Biome |
| `npm run lint:fix` | Corrige problemas automaticamente |

## 🙏 Créditos

Este projeto é baseado no tema [Spectre](https://github.com/louisescher/spectre) por [Louise Scherer](https://github.com/louisescher).

## 📄 Licença

MIT License
