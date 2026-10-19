/* =====================================================================
   Camada de dados — Supabase (produção) ou localStorage (modo demo).
   As duas implementações têm a mesma interface.
   ===================================================================== */
(function () {
  const CFG = window.RIFA_CONFIG;
  const temSupabase = !!(CFG.supabase.url && CFG.supabase.anonKey && window.supabase);

  const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";

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
    });

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
            numero_sorteado: c.numeroSorteado,
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
      async getConfig() { await espera(); return { ...estado.config }; },
      async getOcupados() {
        await espera();
        return estado.participantes
          .map((p) => ({ numero: p.numero, status: p.status, primeiro_nome: primeiroNome(p.nome) }))
          .sort((a, b) => a.numero - b.numero);
      },
      async getMural() {
        await espera();
        const vistos = new Set();
        return estado.participantes
          .filter((p) => p.mensagem_publica && p.mensagem && !vistos.has(p.pedido_id) && vistos.add(p.pedido_id))
          .map((p) => ({ primeiro_nome: primeiroNome(p.nome), mensagem: p.mensagem, criado_em: p.criado_em }))
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
      async listarParticipantes() { await espera(); return [...estado.participantes].sort((a, b) => a.numero - b.numero); },
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
      async salvarConfig(c) { estado.config = { ...estado.config, ...c }; salvar(estado); },
      resetarDemo() { try { localStorage.removeItem(KEY); } catch (_) {} estado = ler(); },
    };
  }

  window.RifaAPI = temSupabase ? criarApiSupabase() : criarApiDemo();
})();

/* =====================================================================
   Utilitários compartilhados (site e painel)
   ===================================================================== */
window.RifaUtil = {
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
  gestacao() {
    const g = window.RIFA_CONFIG.gestacao;
    const ref = RifaUtil.dia(g.dataReferencia);
    const diasDesdeRef = Math.floor((Date.now() - ref.getTime()) / 86400e3);
    const totalDias = Math.max(0, g.semanasNaReferencia * 7 + diasDesdeRef);
    const dpp = new Date(ref.getTime() + (40 * 7 - g.semanasNaReferencia * 7) * 86400e3);
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
