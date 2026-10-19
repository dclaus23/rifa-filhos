/* =====================================================================
   Painel dos pais — confirmar pagamentos, lembretes e configuração
   ===================================================================== */
(function () {
  const API = window.RifaAPI;
  const U = window.RifaUtil;
  const $ = (s) => document.querySelector(s);
  let config = null;
  let participantes = [];

  const toast = (m) => {
    const t = $("#toast"); t.textContent = m; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2600);
  };
  const pad = (n) => U.pad(n, config.totalNumeros);

  /* Brasília é UTC-3 fixo (sem horário de verão desde 2019) */
  const paraInput = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 16) : "");
  const deInput = (v) => (v ? new Date(v + ":00-03:00").toISOString() : null);

  /* Agrupa por pedido (uma pessoa pode escolher vários números de uma vez) */
  function pedidos() {
    const m = new Map();
    participantes.forEach((p) => {
      if (!m.has(p.pedido_id)) m.set(p.pedido_id, { ...p, itens: [] });
      m.get(p.pedido_id).itens.push(p);
    });
    return [...m.values()].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  }
  /* Agrupa por celular (lembrete: uma mensagem por pessoa) */
  function porPessoa() {
    const m = new Map();
    participantes.filter((p) => p.status === "pago").forEach((p) => {
      if (!m.has(p.celular)) m.set(p.celular, { nome: p.nome, celular: p.celular, itens: [] });
      m.get(p.celular).itens.push(p);
    });
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  /* ------------------------------ cards ----------------------------- */
  function renderCards() {
    const pagos = participantes.filter((p) => p.status === "pago").length;
    const res = participantes.length - pagos;
    const v = config.valorNumero;
    const livres = config.totalNumeros - participantes.length;
    const card = (t, b) => `<div class="card"><small>${t}</small><b>${b}</b></div>`;
    $("#cards").innerHTML =
      card("Confirmados", pagos) +
      card("Aguardando PIX", res) +
      card("Livres", `${livres} / ${config.totalNumeros}`) +
      card("Arrecadado", v == null ? "—" : U.moeda(v * pagos)) +
      card("A receber", v == null ? "—" : U.moeda(v * res));
  }

  /* -------------------------- participantes ------------------------- */
  function renderParticipantes() {
    const busca = $("#f-busca").value.trim().toLowerCase();
    const st = $("#f-status").value;
    const linhas = pedidos().filter((p) => {
      const statusPedido = p.itens.every((i) => i.status === "pago") ? "pago" : "reservado";
      if (st && statusPedido !== st) return false;
      if (!busca) return true;
      return p.nome.toLowerCase().includes(busca) || p.celular.includes(busca.replace(/\D/g, "") || "§") ||
        p.itens.some((i) => String(i.numero) === busca || pad(i.numero) === busca);
    });

    $("#tb-participantes").innerHTML = linhas.length ? linhas.map((p) => {
      const ids = p.itens.map((i) => i.id).join(",");
      const pago = p.itens.every((i) => i.status === "pago");
      const nums = p.itens.map((i) => pad(i.numero)).join(", ");
      const total = config.valorNumero == null ? "—" : U.moeda(config.valorNumero * p.itens.length);
      const msgCobranca = `Oi, ${p.nome.split(" ")[0]}! Aqui é da ${U.txt("Rifa {do} {bebe}")} 💛 ` +
        `Vimos sua reserva ${p.itens.length > 1 ? "dos números" : "do número"} ${nums}. ` +
        (config.valorNumero == null ? "" : `O valor é ${total}. `) + `Qualquer dúvida é só chamar!`;
      const msgConfirma = `Oi, ${p.nome.split(" ")[0]}! Pagamento confirmado ✅ ` +
        `${p.itens.length > 1 ? "Seus números" : "Seu número"} ${nums} ${p.itens.length > 1 ? "estão garantidos" : "está garantido"} na ${U.txt("Rifa {do} {bebe}")}. Obrigado! 💛`;
      return `<tr>
        <td><b>${U.esc(p.nome)}</b><br><span class="muted">${U.formatarCelular(p.celular)}</span><br>
            <small class="muted">${new Date(p.criado_em).toLocaleString("pt-BR")}</small></td>
        <td>${nums}</td>
        <td>${total}</td>
        <td><span class="tag ${pago ? "pago" : "reservado"}">${pago ? "pago" : "aguardando"}</span></td>
        <td class="msg">${p.mensagem ? U.esc(p.mensagem) + (p.mensagem_publica ? "" : " <i>(privada)</i>") : "—"}</td>
        <td><div class="acoes">
          ${pago
            ? `<button class="btn btn-fantasma" data-acao="despagar" data-ids="${ids}">desfazer</button>
               <a class="btn btn-verde" target="_blank" rel="noopener" href="${U.linkWhatsApp(p.celular, msgConfirma)}">avisar ✅</a>`
            : `<button class="btn btn-primario" data-acao="pagar" data-ids="${ids}">confirmar PIX</button>
               <a class="btn btn-fantasma" target="_blank" rel="noopener" href="${U.linkWhatsApp(p.celular, msgCobranca)}">WhatsApp</a>`}
          <button class="btn btn-link" data-acao="remover" data-ids="${ids}" data-nums="${nums}">liberar</button>
        </div></td></tr>`;
    }).join("") : `<tr><td colspan="6" class="vazio">Nenhum participante encontrado.</td></tr>`;
  }

  $("#tb-participantes").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-acao]");
    if (!b) return;
    const ids = b.dataset.ids.split(",");
    try {
      if (b.dataset.acao === "pagar") { await API.marcarPago(ids, true); toast("Pagamento confirmado!"); }
      if (b.dataset.acao === "despagar") { await API.marcarPago(ids, false); toast("Voltou para aguardando."); }
      if (b.dataset.acao === "remover") {
        if (!confirm(`Liberar os números ${b.dataset.nums}? A reserva será apagada.`)) return;
        await API.remover(ids); toast("Números liberados.");
      }
      await carregar();
    } catch (err) { toast("Erro: " + err.message); }
  });
  $("#f-busca").addEventListener("input", renderParticipantes);
  $("#f-status").addEventListener("change", renderParticipantes);

  /* ---------------------------- lembretes --------------------------- */
  function renderLembretes() {
    const pessoas = porPessoa();
    $("#preview-lembrete").textContent = config.dataSorteio
      ? U.mensagemLembrete("Fulano", [7, 21], config)
      : "Defina a data do sorteio na aba Configuração.";
    $("#tb-lembretes").innerHTML = pessoas.length ? pessoas.map((p) => {
      const nums = p.itens.map((i) => i.numero).sort((a, b) => a - b);
      const enviado = p.itens.every((i) => i.lembrete_enviado_em);
      const ids = p.itens.map((i) => i.id).join(",");
      const link = config.dataSorteio ? U.linkWhatsApp(p.celular, U.mensagemLembrete(p.nome.split(" ")[0], nums, config)) : "#";
      return `<tr>
        <td><b>${U.esc(p.nome)}</b><br><span class="muted">${U.formatarCelular(p.celular)}</span></td>
        <td>${nums.map(pad).join(", ")}</td>
        <td>${enviado ? `<span class="enviado">✓ enviado ${new Date(p.itens[0].lembrete_enviado_em).toLocaleString("pt-BR")}</span>` : `<span class="muted">pendente</span>`}</td>
        <td><a class="btn btn-verde btn-pequeno" target="_blank" rel="noopener" href="${link}" data-lembrete="${ids}">${enviado ? "reenviar" : "enviar no WhatsApp"}</a></td>
      </tr>`;
    }).join("") : `<tr><td colspan="4" class="vazio">Ainda não há pagamentos confirmados.</td></tr>`;
  }
  $("#tb-lembretes").addEventListener("click", async (e) => {
    const a = e.target.closest("a[data-lembrete]");
    if (!a || !config.dataSorteio) return;
    try { await API.marcarLembrete(a.dataset.lembrete.split(",")); setTimeout(carregar, 800); } catch (_) {}
  });

  /* ------------------------------ config ---------------------------- */
  function preencherConfig() {
    const f = $("#form-config");
    f.valorNumero.value = config.valorNumero ?? "";
    f.totalNumeros.value = config.totalNumeros;
    f.dataAbertura.value = paraInput(config.dataAbertura);
    f.dataSorteio.value = paraInput(config.dataSorteio);
    f.vendasAte.value = paraInput(config.vendasAte);
    f.premio.value = config.premio ?? "";
    f.numeroSorteado.value = config.numeroSorteado ?? "";
  }
  $("#form-config").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const total = Number(f.totalNumeros.value);
    const maiorUsado = Math.max(0, ...participantes.map((p) => p.numero));
    $("#cfg-erro").textContent = "";
    if (total < maiorUsado) return ($("#cfg-erro").textContent = `Já existe o número ${maiorUsado} reservado; não dá para reduzir abaixo disso.`);
    if (f.dataAbertura.value && f.vendasAte.value && f.dataAbertura.value >= f.vendasAte.value)
      return ($("#cfg-erro").textContent = "A abertura precisa ser antes do fim das vendas.");
    const sorteado = f.numeroSorteado.value ? Number(f.numeroSorteado.value) : null;
    if (sorteado && (sorteado < 1 || sorteado > total)) return ($("#cfg-erro").textContent = "Número sorteado fora da faixa.");
    try {
      await API.salvarConfig({
        valorNumero: f.valorNumero.value === "" ? null : Number(f.valorNumero.value),
        totalNumeros: total,
        dataAbertura: deInput(f.dataAbertura.value),
        dataSorteio: deInput(f.dataSorteio.value),
        vendasAte: deInput(f.vendasAte.value),
        premio: f.premio.value.trim() || null,
        numeroSorteado: sorteado,
      });
      toast("Configuração salva!");
      await carregar();
    } catch (err) { $("#cfg-erro").textContent = err.message; }
  });

  /* ------------------------------- CSV ------------------------------ */
  $("#btn-csv").addEventListener("click", () => {
    const linhas = [["numero", "nome", "celular", "status", "mensagem", "criado_em", "pago_em", "lembrete_enviado_em"]];
    participantes.forEach((p) => linhas.push([p.numero, p.nome, p.celular, p.status, p.mensagem || "", p.criado_em, p.pago_em || "", p.lembrete_enviado_em || ""]));
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `rifa-matias-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  });

  /* ------------------------------- abas ----------------------------- */
  document.querySelectorAll(".abas button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".abas button").forEach((x) => x.classList.toggle("ativa", x === b));
      document.querySelectorAll("[data-painel]").forEach((p) => (p.hidden = p.dataset.painel !== b.dataset.aba));
    })
  );

  /* ------------------------- login / carga -------------------------- */
  async function carregar() {
    [config, participantes] = await Promise.all([API.getConfig(), API.listarParticipantes()]);
    renderCards();
    renderParticipantes();
    renderLembretes();
    preencherConfig();
  }

  async function mostrarPainel() {
    if (!(await API.eAdmin())) {
      await API.logout();
      $("#tela-login").hidden = false;
      $("#login-erro").textContent = "Este e-mail não tem acesso à área dos pais.";
      return;
    }
    $("#tela-login").hidden = true;
    $("#tela-painel").hidden = false;
    try { await carregar(); } catch (e) { toast("Erro ao carregar: " + e.message); }
  }

  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#login-erro").textContent = "";
    try { await API.login(e.target.email.value, e.target.senha.value); mostrarPainel(); }
    catch (err) { $("#login-erro").textContent = "E-mail ou senha incorretos."; }
  });
  $("#btn-sair").addEventListener("click", async () => { await API.logout(); location.reload(); });

  (async function iniciar() {
    if (API.modo === "demo") {
      $("#faixa-demo").hidden = false;
      $("#reset-demo").addEventListener("click", () => { API.resetarDemo(); location.reload(); });
    }
    const s = await API.sessao();
    if (s) mostrarPainel();
    else $("#tela-login").hidden = false;
  })();
})();
