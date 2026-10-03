# Baú do Kira — Regras do Projeto para o Agente

Este é um blog Astro (repositório `SpetsnazBR/baudokira`, clone local em `Projetos Programação/blog`).

## Releases (obrigatório)

- Toda **funcionalidade nova** implementada no projeto deve ser registrada na seção **Releases** do repositório no GitHub, com **descrição do que foi alterado/implementado** e o **número da versão**.
- Versionamento SemVer: `feat`/funcionalidade nova → bump minor (ex.: 1.0.2 → 1.1.0); `fix` → patch; breaking → major. Versão fica em `package.json`.
- Commits seguem Conventional Commits.
- Push de tag anotada `v*` na master dispara `.github/workflows/release.yml`, que cria a GitHub Release automaticamente com notas geradas dos commits desde a tag anterior.
- Política completa em `RELEASES.md` (raiz do repositório).

## Branch de postagens

- A pasta `src/content/posts/` **não deve ser commitada em `master`**: a master contém apenas o código do site.
- As postagens vivem de forma exclusiva na branch **`blog-posts`** (criada a partir da master), que versiona `src/content/posts/`.
- Para publicar conteúdo no site (GitHub Pages builda a partir de `master`): fazer `merge` de `blog-posts` em `master` e dar push.
- O CMS local (`cms/`) gera os posts em `src/content/posts/<slug>.md`; deve ser usado com a branch `blog-posts` ativa.

## CMS Local

- O CMS (`cms/`) é um sistema local (escuta em `127.0.0.1:4444`) que publica posts no Astro gerando `.md` em `src/content/posts/`.
- Zero dependências: usa `node:http` + `node:sqlite` (nativo do Node ≥22.5).
- O token de API (`CMS_TOKEN`) fica em `cms/.env` (gitignored, permissão 0600) e é auto-gerado se ausente.
- Iniciar com: `npm run cms`

## Segurança

- **Nunca commitar** `cms/.env`, `cms/data/` ou qualquer arquivo com segredos.
- O CMS tem proteções: auth Bearer obrigatória, rate limit, CSP, checagem de Origin, anti-path-traversal.