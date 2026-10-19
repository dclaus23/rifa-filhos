/* =====================================================================
   Camada de dados — Supabase (produção) ou localStorage (modo demo).
   As duas implementações têm a mesma interface.
   ===================================================================== */
(function () {
  const CFG = window.RIFA_CONFIG;
  const temSupabase = !!(CFG.supabase.url && CFG.supabase.anonKey && window.supabase);

  const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";
  /* Mesma regra do banco (public.nome_curto): primeiro + último nome,
     mantendo o sobrenome antes de Filho/Neto/Júnior... */
  const SUFIXOS = ["filho", "filha", "neto", "neta", "junior", "júnior", "jr", "jr.", "sobrinho", "sobrinha", "segundo", "terceiro"];
  const nomeCurto = (nome) => {
    const a = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (a.length <= 1) return a[0] || "";
    const n = a.length;
    if (n >= 3 && SUFIXOS.includes(a[n - 1].toLowerCase())) return `${a[0]} ${a[n - 2]} ${a[n - 1]}`;
    return `${a[0]} ${a[n - 1]}`;
  };

  /* ----------------------------- SUPABASE ---------------------------- */
  function criarApiSupabase() {
    const sb = window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey);
    const erro = (e) => {
      if (!e) return;
      throw new Error(e.message || "Erro inesperado. Tente novamente.");
    };

    const mapConfig = (r) => ({
      totalNumeros: r.total_numeros,
      dataAbertura: r.data_abertura,
      valorNumero: r.valor_numero === null ? null : Number(r.valor_numero),
      dataSorteio: r.data_sorteio,
      vendasAte: r.vendas_ate,
      premio: r.premio,
      numeroSorteado: r.numero_sorteado,
      ...(r.gestacao_dias != null ? { gestacaoDataRef: r.gestacao_data_ref, gestacaoDias: r.gestacao_dias } : {}),
    });
    const mapPost = (r) => ({ id: r.id, data: r.data, titulo: r.titulo, texto: r.texto, foto: r.foto_url, fotoPath: r.foto_path });

    return {
      modo: "supabase",
      async getConfig() {
        const { data, error } = await sb.from("rifa_config").select("*").eq("id", 1).single();
        erro(error);
        return { ...CFG.rifa, ...mapConfig(data) };
      },
      async getOcupados() {
        const { data, error } = await sb.rpc("numeros_ocupados");
        erro(error);
        return data;
      },
      async getSorteios() {
        const { data, error } = await sb.from("sorteios").select("*").order("realizado_em", { ascending: false });
        if (error) return []; // migração 03 ainda não rodada
        return data;
      },
      async sortear() {
        const { data, error } = await sb.rpc("realizar_sorteio");
        erro(error);
        return data;
      },
      async anularSorteio(motivo) {
        const { error } = await sb.rpc("anular_sorteio", { p_motivo: motivo });
        erro(error);
      },
      async getDiario() {
        const { data, error } = await sb.from("diario").select("*").order("data", { ascending: false });
        if (error) return CFG.diario; // tabela ainda não criada → usa o config.js
        return data.map(mapPost);
      },
      async salvarPost(p, arquivo) {
        let foto_url = p.foto || null, foto_path = p.fotoPath || null;
        if (arquivo) {
          const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const up = await sb.storage.from("diario").upload(path, arquivo, { contentType: "image/jpeg", upsert: false });
          erro(up.error);
          if (foto_path) await sb.storage.from("diario").remove([foto_path]);
          foto_path = path;
          foto_url = sb.storage.from("diario").getPublicUrl(path).data.publicUrl;
        }
        const linha = { data: p.data, titulo: p.titulo, texto: p.texto || null, foto_url, foto_path };
        const q = p.id ? sb.from("diario").update(linha).eq("id", p.id) : sb.from("diario").insert(linha);
        const { error } = await q;
        erro(error);
      },
      async removerPost(p) {
        const { error } = await sb.from("diario").delete().eq("id", p.id);
        erro(error);
        if (p.fotoPath) await sb.storage.from("diario").remove([p.fotoPath]);
      },
      async getMural() {
        const { data, error } = await sb.rpc("mural_mensagens");
        erro(error);
        return data;
      },
      async reservar({ numeros, nome, celular, mensagem, publica }) {
        const { data, error } = await sb.rpc("reservar_numeros", {
          p_numeros: numeros,
          p_nome: nome,
          p_celular: celular,
          p_mensagem: mensagem,
          p_mensagem_publica: publica,
        });
        erro(error);
        return data;
      },

      /* ------- admin ------- */
      async sessao() {
        const { data } = await sb.auth.getSession();
        return data.session;
      },
      async login(email, senha) {
        const { error } = await sb.auth.signInWithPassword({ email, password: senha });
        erro(error);
      },
      async logout() {
        await sb.auth.signOut();
      },
      async eAdmin() {
        const { data, error } = await sb.from("admins").select("email").limit(1);
        return !error && data.length > 0; // RLS só devolve linhas para quem é admin
      },
      async listarParticipantes() {
        const { data, error } = await sb.from("participantes").select("*").order("numero");
        erro(error);
        return data;
      },
      async marcarPago(ids, pago) {
        const { error } = await sb
          .from("participantes")
          .update({ status: pago ? "pago" : "reservado", pago_em: pago ? new Date().toISOString() : null })
          .in("id", ids);
        erro(error);
      },
      async remover(ids) {
        const { error } = await sb.from("participantes").delete().in("id", ids);
        erro(error);
      },
      async marcarLembrete(ids) {
        const { error } = await sb
          .from("participantes")
          .update({ lembrete_enviado_em: new Date().toISOString() })
          .in("id", ids);
        erro(error);
      },
      async salvarConfig(c) {
        const { error } = await sb
          .from("rifa_config")
          .update({
            total_numeros: c.totalNumeros,
            data_abertura: c.dataAbertura,
            valor_numero: c.valorNumero,
            data_sorteio: c.dataSorteio,
            vendas_ate: c.vendasAte,
            premio: c.premio,
            ...(c.gestacaoDias != null ? { gestacao_data_ref: c.gestacaoDataRef, gestacao_dias: c.gestacaoDias } : {}),
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", 1);
        erro(error);
      },
    };
  }

  /* ------------------------------- DEMO ------------------------------ */
  function criarApiDemo() {
    const KEY = "rifa-matias-demo-v1";
    const ler = () => {
      try {
        const s = JSON.parse(localStorage.getItem(KEY));
        if (s) return s;
      } catch (_) {}
      const agora = Date.now();
      const seed = (numero, nome, status, mensagem, h) => ({
        id: crypto.randomUUID(), pedido_id: "demo-" + nome, numero, nome, celular: "1199999" + String([...nome].reduce((a, c) => a + c.charCodeAt(0), 0)).slice(-4),
        mensagem, mensagem_publica: true, status,
        criado_em: new Date(agora - h * 3600e3).toISOString(),
        pago_em: status === "pago" ? new Date(agora - h * 3000e3).toISOString() : null,
        lembrete_enviado_em: null,
      });
      return {
        config: { ...CFG.rifa },
        diario: CFG.diario.map((p) => ({ ...p, id: crypto.randomUUID() })),
        participantes: [
          seed(7, "Exemplo Avó", "pago", CFG.familia.bebe + ", a vovó já te ama demais! (mensagem de demonstração)", 30),
          seed(21, "Exemplo Tio", "pago", "", 20),
          seed(22, "Exemplo Tio", "pago", "", 20),
          seed(100, "Exemplo Amiga", "reservado", "Que venha com muita saúde! (demo)", 3),
        ],
      };
    };
    const salvar = (s) => {
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
    };
    let estado = ler();
    const espera = () => new Promise((r) => setTimeout(r, 250));

    return {
      modo: "demo",
      async getConfig() { await espera(); estado = ler(); return { ...estado.config }; },
      async getOcupados() {
        await espera(); estado = ler();
        return estado.participantes
          .map((p) => ({ numero: p.numero, status: p.status, primeiro_nome: primeiroNome(p.nome), nome_curto: nomeCurto(p.nome) }))
          .sort((a, b) => a.numero - b.numero);
      },
      async getSorteios() {
        await espera(); estado = ler();
        return [...(estado.sorteios || [])].sort((a, b) => b.realizado_em.localeCompare(a.realizado_em));
      },
      async sortear() {
        estado.sorteios = estado.sorteios || [];
        if (estado.sorteios.some((s) => !s.anulado)) throw new Error("O sorteio já foi realizado. Para refazer, é preciso anular o atual.");
        const conc = estado.participantes.filter((p) => p.status === "pago").map((p) => p.numero).sort((a, b) => a - b);
        if (!conc.length) throw new Error("Nenhum número com pagamento confirmado para sortear.");
        const lim = Math.floor(2 ** 32 / conc.length) * conc.length;
        let x; do { x = crypto.getRandomValues(new Uint32Array(1))[0]; } while (x >= lim);
        const numero = conc[x % conc.length];
        const dono = estado.participantes.find((p) => p.numero === numero);
        const s = { id: crypto.randomUUID(), realizado_em: new Date().toISOString(), numero, primeiro_nome: primeiroNome(dono.nome), nome_curto: nomeCurto(dono.nome), celular_final: String(dono.celular).slice(-4),
          concorrentes: conc, total_concorrentes: conc.length, anulado: false, motivo_anulacao: null, anulado_em: null };
        estado.sorteios.push(s);
        estado.config.numeroSorteado = numero;
        salvar(estado);
        return s;
      },
      async anularSorteio(motivo) {
        const s = (estado.sorteios || []).find((x) => !x.anulado);
        if (!s) throw new Error("Não há sorteio válido para anular.");
        if (String(motivo || "").trim().length < 3) throw new Error("Informe o motivo da anulação.");
        Object.assign(s, { anulado: true, motivo_anulacao: motivo.trim(), anulado_em: new Date().toISOString() });
        estado.config.numeroSorteado = null;
        salvar(estado);
      },
      async getDiario() {
        await espera();
        if (!estado.diario) estado.diario = CFG.diario.map((p) => ({ ...p, id: crypto.randomUUID() }));
        return [...estado.diario].sort((a, b) => String(b.data).localeCompare(String(a.data)));
      },
      async salvarPost(p, arquivo) {
        const foto = arquivo ? await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(arquivo); }) : p.foto || null;
        const novo = { id: p.id || crypto.randomUUID(), data: p.data, titulo: p.titulo, texto: p.texto, foto };
        estado.diario = (estado.diario || []).filter((x) => x.id !== novo.id).concat(novo);
        salvar(estado);
      },
      async removerPost(p) { estado.diario = estado.diario.filter((x) => x.id !== p.id); salvar(estado); },
      async getMural() {
        await espera();
        const vistos = new Set();
        return estado.participantes
          .filter((p) => p.mensagem_publica && p.mensagem && !vistos.has(p.pedido_id) && vistos.add(p.pedido_id))
          .map((p) => ({ primeiro_nome: primeiroNome(p.nome), nome_curto: nomeCurto(p.nome), mensagem: p.mensagem, criado_em: p.criado_em }))
          .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
      },
      async reservar({ numeros, nome, celular, mensagem, publica }) {
        await espera();
        const c = estado.config;
        if (c.numeroSorteado) throw new Error("O sorteio já aconteceu.");
        if (c.dataAbertura && new Date() < new Date(c.dataAbertura)) throw new Error("A rifa ainda não abriu.");
        if (c.vendasAte && new Date() > new Date(c.vendasAte)) throw new Error("As vendas já foram encerradas.");
        const cel = String(celular).replace(/\D/g, "");
        if (!/^\d{10,13}$/.test(cel)) throw new Error("Celular inválido.");
        if (String(nome).trim().length < 2) throw new Error("Informe seu nome.");
        const ocupados = numeros.filter((n) => estado.participantes.some((p) => p.numero === n));
        if (ocupados.length) throw new Error("Ops! Já reservados: " + ocupados.join(", "));
        const pedido = crypto.randomUUID();
        numeros.forEach((n) =>
          estado.participantes.push({
            id: crypto.randomUUID(), pedido_id: pedido, numero: n, nome: String(nome).trim(),
            celular: cel, mensagem: (mensagem || "").trim() || null, mensagem_publica: !!publica,
            status: "reservado", criado_em: new Date().toISOString(), pago_em: null, lembrete_enviado_em: null,
          })
        );
        salvar(estado);
        return pedido;
      },
      async sessao() { return { demo: true }; },
      async login() {},
      async logout() {},
      async eAdmin() { return true; },
      async listarParticipantes() { await espera(); estado = ler(); return [...estado.participantes].sort((a, b) => a.numero - b.numero); },
      async marcarPago(ids, pago) {
        estado.participantes.forEach((p) => {
          if (ids.includes(p.id)) { p.status = pago ? "pago" : "reservado"; p.pago_em = pago ? new Date().toISOString() : null; }
        });
        salvar(estado);
      },
      async remover(ids) { estado.participantes = estado.participantes.filter((p) => !ids.includes(p.id)); salvar(estado); },
      async marcarLembrete(ids) {
        estado.participantes.forEach((p) => { if (ids.includes(p.id)) p.lembrete_enviado_em = new Date().toISOString(); });
        salvar(estado);
      },
      async salvarConfig(c) { const { numeroSorteado, ...resto } = c; estado.config = { ...estado.config, ...resto }; salvar(estado); },
      resetarDemo() { try { localStorage.removeItem(KEY); } catch (_) {} estado = ler(); },
    };
  }

  window.RifaAPI = temSupabase ? criarApiSupabase() : criarApiDemo();
})();

/* =====================================================================
   Utilitários compartilhados (site e painel)
   ===================================================================== */
window.RifaUtil = {
  /* nome para exibição pública (usa o que veio do banco; senão o primeiro nome) */
  nomePublico(o) {
    return (o && (o.nome_curto || o.primeiro_nome)) || "";
  },
  /* Textos com o nome/gênero/ordem do filho: {bebe} {do} {pro} {o} {ele} {dele} {pel}
     {ordinal} (primeiro/segunda...) {ordem} (1º/2ª) {pais} {assinatura} */
  txt(tpl) {
    const F = window.RIFA_CONFIG.familia;
    const f = F.genero === "f";
    const ord = ["", "primeir", "segund", "terceir", "quart", "quint", "sext"][F.ordem] || "";
    const m = {
      bebe: F.bebe, pais: F.pais, assinatura: F.assinatura,
      do: f ? "da" : "do", pro: f ? "pra" : "pro", o: f ? "a" : "o", ele: f ? "ela" : "ele", dele: f ? "dela" : "dele", pel: f ? "pela" : "pelo",
      filho: f ? "filha" : "filho",
      ordinal: ord ? ord + (f ? "a" : "o") : `${F.ordem}${f ? "ª" : "º"}`,
      ordem: `${F.ordem}${f ? "ª" : "º"}`,
    };
    return String(tpl).replace(/\{(\w+)\}/g, (x, k) => (k in m ? m[k] : x));
  },
  esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },
  pad(n, total) {
    return String(n).padStart(String(total).length, "0");
  },
  moeda(v) {
    return v == null ? "a definir" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  },
  dataLonga(d) {
    return new Date(d).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  },
  dataCurta(d) {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).replace(".", "");
  },
  hora(d) {
    return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  },
  /* Data "AAAA-MM-DD" interpretada ao meio-dia de Brasília (evita pular dia por fuso) */
  dia(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00-03:00") : new Date(iso);
  },
  celularBR(cel) {
    const d = String(cel || "").replace(/\D/g, "");
    return d.length >= 12 && d.startsWith("55") ? d : "55" + d;
  },
  formatarCelular(cel) {
    const d = String(cel || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return d;
  },
  linkWhatsApp(cel, texto) {
    return `https://wa.me/${RifaUtil.celularBR(cel)}?text=${encodeURIComponent(texto)}`;
  },
  /* Os valores do banco (painel) têm prioridade sobre o config.js */
  aplicarGestacao(cfg) {
    if (cfg && cfg.gestacaoDias != null && cfg.gestacaoDataRef) {
      window.RIFA_CONFIG.gestacao = { dataReferencia: String(cfg.gestacaoDataRef).slice(0, 10), diasNaReferencia: cfg.gestacaoDias };
    }
  },
  /* dias de gestação numa data qualquer */
  diasGestacao(data) {
    const g = window.RIFA_CONFIG.gestacao;
    const base = g.diasNaReferencia ?? g.semanasNaReferencia * 7;
    return base + Math.floor((RifaUtil.dia(data).getTime() - RifaUtil.dia(g.dataReferencia).getTime()) / 86400e3);
  },
  gestacao() {
    const g = window.RIFA_CONFIG.gestacao;
    const ref = RifaUtil.dia(g.dataReferencia);
    const base = g.diasNaReferencia ?? g.semanasNaReferencia * 7;
    const diasDesdeRef = Math.floor((Date.now() - ref.getTime()) / 86400e3);
    const totalDias = Math.max(0, base + diasDesdeRef);
    const dpp = new Date(ref.getTime() + (280 - base) * 86400e3);
    return { semanas: Math.floor(totalDias / 7), dias: totalDias % 7, progresso: Math.min(1, totalDias / 280), dpp };
  },
  mensagemLembrete(nome, numeros, cfg) {
    const F = window.RIFA_CONFIG.familia;
    const lista = numeros.map((n) => RifaUtil.pad(n, cfg.totalNumeros)).join(", ");
    return (
      `Oi, ${nome}! 💛\n\n` +
      `Amanhã (${RifaUtil.dataLonga(cfg.dataSorteio)}, às ${RifaUtil.hora(cfg.dataSorteio)}) é o sorteio da ${RifaUtil.txt("Rifa {do} {bebe}")}!\n` +
      `${numeros.length > 1 ? "Seus números" : "Seu número"}: ${lista}.\n\n` +
      `Obrigado por fazer parte desse momento tão especial pra nós. Torce com a gente! 🍀\n— ${F.assinatura}`
    );
  },
};

/* =====================================================================
   PIX "copia e cola" (BR Code estático com valor) — padrão EMV do Bacen
   ===================================================================== */
window.RifaPix = {
  _campo(id, valor) {
    return id + String(valor.length).padStart(2, "0") + valor;
  },
  _limpar(s, max) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, max).trim();
  },
  _crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  },
  gerar({ chave, nome, cidade, valor, txid }) {
    if (!chave) return null;
    const c = this._campo.bind(this);
    const conta = c("00", "br.gov.bcb.pix") + c("01", chave.trim());
    let p =
      c("00", "01") +
      c("26", conta) +
      c("52", "0000") +
      c("53", "986") +
      (valor ? c("54", valor.toFixed(2)) : "") +
      c("58", "BR") +
      c("59", this._limpar(nome, 25) || "RECEBEDOR") +
      c("60", this._limpar(cidade, 15) || "BRASIL") +
      c("62", c("05", (txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***")) +
      "6304";
    return p + this._crc16(p);
  },
};
