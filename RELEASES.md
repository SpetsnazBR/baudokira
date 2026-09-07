# 📦 Releases

Toda **funcionalidade nova** implementada neste projeto deve ser registrada na seção
**Releases** do repositório no GitHub
(<https://github.com/SpetsnazBR/baudokira/releases>), contendo:

- a **descrição do que foi alterado/implementado**; e
- o **número da versão** publicada.

> Isso vale para qualquer mudança que agregue funcionalidade, recurso ou melhoria
> visível no produto — não apenas correções internas.

## Numeração de versão (SemVer)

A versão do projeto fica em `package.json` (`"version"`). Regra prática:

| Tipo de mudança                        | Prefixo de commit | Bump                    | Exemplo           |
| -------------------------------------- | ----------------- | ----------------------- | ----------------- |
| Correção de bug (sem recurso novo)     | `fix:`            | patch                   | `1.0.2` → `1.0.3` |
| Funcionalidade nova / melhoria         | `feat:`           | minor                   | `1.0.3` → `1.1.0` |
| Mudança incompatível (breaking change) | `feat!:`/`fix!:`  | major                   | `1.1.0` → `2.0.0` |

Use [Conventional Commits](https://www.conventionalcommits.org/) nos commits para que
as notas da release sejam geradas de forma legível.

## Fluxo para publicar uma funcionalidade

1. **Implemente e teste** a funcionalidade, descrevendo o que mudou nos commits
   (ex.: `feat(blog): ...`).
2. **Atualize a versão** em `package.json` conforme a tabela acima.
3. **Crie a tag anotada** da versão no commit correspondente da `master`:
   ```bash
   git tag -a v1.1.0 -m "1.1.0 — descrição resumida do que foi implementado"
   git push origin master
   git push origin v1.1.0
   ```
4. O workflow `.github/workflows/release.yml` cria a **GitHub Release**
   automaticamente com o número da versão (`v1.1.0`) e notas geradas a partir dos
   commits desde a última tag.
5. **Revise a Release** no GitHub e ajuste o texto se necessário, garantindo que ele
   descreva com clareza o que foi alterado/implementado.

## Checklist antes de fechar a release

- [ ] Funcionalidade implementada e testada (`npm test`, `npm run build`)
- [ ] `version` atualizada em `package.json` (SemVer)
- [ ] Commits seguem Conventional Commits (`feat:`, `fix:`, ...)
- [ ] Tag anotada `vX.Y.Z` criada e enviada ao repositório
- [ ] GitHub Release criada com descrição do que mudou e número da versão
