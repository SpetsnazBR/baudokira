# CMS local — Baú do Kira

Sistema **local** de publicação que gera posts `.md` para o Astro (`src/content/posts/`).
Zero dependências: usa apenas APIs nativas do Node (`node:http`, `node:sqlite`).

## Como rodar

```bash
# 1. (Opcional) configurar token e auto-push
cp cms/.env.example cms/.env
#    edite cms/.env: CMS_TOKEN (recomendado) e CMS_AUTO_PUSH

# 2. iniciar
cd cms && npm start        # ou:  node cms/server.mjs
```

Painel: **http://127.0.0.1:4444/**

## O que ele faz

- 💾 Salva postagem no banco SQLite (`cms/data/cms.db`) **e** gera o arquivo
  `src/content/posts/<slug>.md` pronto para o Astro.
- 🖼️ Capa: envia/redimensiona e salva em `src/content/assets/<slug>-cover.webp`.
- 🖼️ Imagens do corpo: botão "inserir imagem" envia para `assets/` e insere
  `![alt](../assets/arquivo.webp)` no conteúdo.
- 🏷️ Tags novas são adicionadas automaticamente em `src/content/tags.json`.
- 🚀 Botão **Publicar** faz `git add`+`git commit` do conteúdo (e `git push`
  se `CMS_AUTO_PUSH=1`).

## Campos (mesmos exigidos pelo blog)

Título *, Descrição *, Data *, Horário, Slug (auto), Tags, Rascunho,
Imagem de capa, Conteúdo em Markdown *, "Marcar como atualizado".

## Segurança

- Servidor escuta apenas em `127.0.0.1` (não exposto na rede).
- `CMS_TOKEN` (opcional): se definido, painel e API exigem o token.
- Segredos ficam em `cms/.env` — **ignorado pelo git**.
- Banco (`data/`) e uploads temporários são ignorados pelo git.
- Valida slug/caminhos (anti path-traversal) e tamanho do corpo (20MB).

## Observações

- Se `npm run dev` do Astro estiver rodando, o post novo já aparece no
  navegador (hot-reload) ao salvar.
- Para publicar de verdade no GitHub Pages: botão "Publicar no GitHub"
  (commit) e depois `git push` (ou ligue `CMS_AUTO_PUSH=1`).
