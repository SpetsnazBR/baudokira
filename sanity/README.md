# Sanity CMS - Baú do Kira

Este diretório contém o Sanity CMS configurado para o blog "Baú do Kira".

## Configuração

### 1. Criar um projeto no Sanity

1. Acesse [https://www.sanity.io/](https://www.sanity.io/) e crie uma conta
2. Crie um novo projeto chamado "Baú do Kira"
3. Anote o **Project ID** que será fornecido

### 2. Configurar variáveis de ambiente

Edite o arquivo `.env.local` na raiz do projeto e substitua:

```
SANITY_STUDIO_PROJECT_ID=seu_project_id_aqui
SANITY_STUDIO_DATASET=production
SANITY_API_TOKEN=seu_token_aqui

PUBLIC_SANITY_PROJECT_ID=seu_project_id_aqui
PUBLIC_SANITY_DATASET=production
PUBLIC_SANITY_API_VERSION=2024-01-01
```

### 3. Obter o token de API

1. No dashboard do Sanity, vá para **Settings > API**
2. Clique em **Add API Token**
3. Crie um token com permissões de **Editor** (read + write)
4. Copie o token gerado e adicione ao `.env.local`

### 4. Fazer deploy do schema

Execute o comando para fazer deploy do schema para o Sanity:

```bash
cd sanity
npx sanity deploy
```

### 5. Iniciar o Sanity Studio

```bash
cd sanity
npm run dev
```

O Sanity Studio estará disponível em: http://localhost:3333

## Schemas

### Post
- **Título**: Título do post
- **Slug**: URL amigável (gerado automaticamente do título)
- **Resumo**: Breve descrição do post
- **Conteúdo**: Conteúdo principal em Markdown
- **Imagem de Capa**: Imagem principal do post
- **Data de Publicação**: Data de publicação
- **Tags**: Tags associadas ao post
- **Publicado**: Status de publicação (rascunho/publicado)

### Tag
- **Nome**: Nome da tag
- **Slug**: URL amigável da tag

## Integração com Astro

O Astro está configurado para buscar dados do Sanity através do cliente localizado em `src/lib/sanity.ts`.

Os componentes Astro usam queries GROQ para buscar posts e tags do Sanity.

## Comandos Úteis

```bash
# Iniciar Sanity Studio
npm run dev

# Fazer deploy do schema
npx sanity deploy

# Verificar configuração
npx sanity debug

# Gerar types TypeScript
npx sanity schema extract
```

## Estrutura de Diretórios

```
sanity/
├── schemas/           # Schemas do Sanity
│   ├── index.ts      # Exportação dos schemas
│   ├── post.ts       # Schema de posts
│   └── tag.ts        # Schema de tags
├── sanity.config.ts  # Configuração do Sanity
└── package.json      # Dependências do Sanity