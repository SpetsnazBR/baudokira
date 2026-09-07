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
- 🧰 Barra de formatação **Markdown**: títulos H1–H6, negrito, itálico, riscado,
  código inline e em bloco, link, citação, listas (com marcadores, numerada e de
  tarefas), linha horizontal e tabela — aplicadas na linha/seleção do editor.
- ✍️ **Corretor ortográfico PT-BR**: `spellcheck` nativo do navegador habilitado
  (`lang="pt-BR"`) na caixa de texto — erros são sublinhados conforme o dicionário
  de português instalado no navegador.
- 👁️ **Preview no blog**: botão abaixo de "+ Nova postagem" abre a postagem atual
  no servidor Astro em execução (configurável via `CMS_ASTRO_URL`/`CMS_ASTRO_BASE`;
  padrão `http://localhost:3334` + `/baudokira`). Antes de abrir, o CMS testa se o
  Astro está acessível (com fallback entre `localhost` e `127.0.0.1`) e avisa se não
  estiver no ar.
- 🚀 Botão **Publicar** faz `git add`+`git commit` do conteúdo (e `git push`
  se `CMS_AUTO_PUSH=1`).

## Campos (mesmos exigidos pelo blog)

Título *, Descrição *, Data *, Horário, Slug (auto), Tags, Rascunho,
Imagem de capa, Conteúdo em Markdown *, "Marcar como atualizado".

## Segurança

- **Token obrigatório**: `CMS_TOKEN` é sempre exigido. Se ausente, um token
  aleatório é gerado automaticamente e salvo em `cms/.env` na 1ª execução.
- Comparação de token com **timing constante** (anti side-channel).
- **DNS rebinding / CSRF**: rejeita requisições com `Origin` fora de
  `127.0.0.1`/`localhost`; mutações (`POST`/`PUT`) exigem `Content-Type:
  application/json` (bloqueia CSRF via formulário/`no-cors`).
- **Rate limit**: 300 req/min e 60 mutações/min por IP (`429`).
- Servidor escuta apenas em `127.0.0.1` (não exposto na rede).
- Segredos ficam em `cms/.env` — **ignorado pelo git**; banco (`data/`) e
  uploads temporários também são ignorados.
- Valida slug/caminhos (anti path-traversal), `Content-Type` e tamanho do
  corpo (20MB); erros 500 não vazam stack/caminhos internos (só no log).
- SQL preparado (sem SQL injection).

## Observações

- Se `npm run dev` do Astro estiver rodando, o post novo já aparece no
  navegador (hot-reload) ao salvar.
- Para publicar de verdade no GitHub Pages: botão "Publicar no GitHub"
  (commit) e depois `git push` (ou ligue `CMS_AUTO_PUSH=1`).
