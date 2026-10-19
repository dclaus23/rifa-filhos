# Rifa Filhos 💛

Site de rifa que substitui o chá de bebê, feito para ser reaproveitado a cada filho. Edição atual: **Matias (1º filho)**. Estático (HTML/CSS/JS, sem build) + Supabase.

- `index.html` — site público · `admin.html` — painel dos pais
- Tudo que muda no dia a dia fica em **`assets/js/config.js`**
- Histórico e decisões: **`DESENVOLVIMENTO.md`**

## 1. Ver funcionando agora (modo demo)

Sem configurar nada, o site roda com dados de exemplo salvos no navegador.

```bash
cd "Rifa - Chá Filhos"
python3 -m http.server 8000
# abra http://localhost:8000  e  http://localhost:8000/admin.html
```

## 2. Ligar o Supabase

1. Crie um projeto em supabase.com (região São Paulo).
2. **SQL Editor** → cole e rode `supabase/schema.sql`.
3. **Authentication → Users → Add user** (e-mail + senha de vocês dois).
4. No SQL Editor: `insert into public.admins (email) values ('seu@email.com'), ('vanessa@email.com');`
5. **Project Settings → API**: copie a *Project URL* e a *anon/publishable key* para `config.js` → `supabase`.
6. Em `config.js` preencha também `pix` e `whatsappContato`.
7. Entre no `admin.html` → aba **Configuração** → valor, quantidade, datas e prêmio.

## 3. Publicar (GitHub Pages)

1. Crie um repositório (ex.: `rifa-matias`) e envie os arquivos (**não** precisa enviar a pasta `Fotos/` com os originais).
2. **Settings → Pages → Deploy from branch → main / root**.
3. O site fica em `https://<usuario>.github.io/rifa-matias/`.

> A *anon key* pode ficar pública: a segurança está nas regras (RLS) do `schema.sql`. Nunca coloque a *service_role key* no site.

## 4. Lembrete na véspera

**Manual (grátis, já funciona):** painel → aba *Lembretes da véspera* → um clique por pessoa abre o WhatsApp com a mensagem pronta.

**Automático (opcional, precisa de provedor de WhatsApp):**

```bash
supabase functions deploy lembrete-sorteio --no-verify-jwt
supabase secrets set LEMBRETE_SECRET=<uma-senha-longa> WHATSAPP_PROVIDER=zapi \
  ZAPI_INSTANCE=... ZAPI_TOKEN=... ZAPI_CLIENT_TOKEN=...
# testar sem enviar:
curl -X POST https://<ref>.supabase.co/functions/v1/lembrete-sorteio \
  -H "x-cron-secret: <uma-senha-longa>" -d '{"dryRun":true}'
```

Depois rode `supabase/agendar-lembrete.sql` (ajustando ref, segredo e data).
Provedores: **Z-API** (envia do seu próprio número, mensalidade) ou **WhatsApp Cloud API da Meta** (exige template aprovado; cobra por mensagem).

## 5. Dia do sorteio

Painel → Configuração → **Número sorteado**. O site mostra o vencedor e encerra as reservas.
