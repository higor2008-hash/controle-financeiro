# Controle Financeiro

Site pessoal do Higor: investimentos, cartões, contas a pagar, chácara (leite, queijo, fiado, animais) e veículos.

Endereço: **https://higor2008-hash.github.io/controle-financeiro/**

| Parte | Onde fica |
|---|---|
| Páginas do site | GitHub Pages (este repositório) |
| Dados e login | Supabase (mesmo projeto do Controle de Obras, tabela `cf_docs`) |

## Segurança

- Para entrar é preciso e-mail e senha do Supabase. Só a conta cadastrada na tabela `cf_dono` vê ou altera os dados; a regra vale no próprio banco (RLS), não só na tela.
- O código é público, mas os dados não ficam aqui.
- Depois do login, o site ainda pode pedir a senha de números (e rosto ou digital) configurada em **Senha**.
- O login trava por alguns minutos depois de 5 senhas erradas seguidas.

## Estrutura

- `index.html`: página e visual.
- `app.js`: telas e regras (mesmo código da versão no Claude).
- `backend.js`: login e ligação com o Supabase.
- `config.js`: endereço e chave pública do Supabase.
- `supabase/schema.sql`: estrutura do banco (pode ser rodado de novo sem apagar dados).
