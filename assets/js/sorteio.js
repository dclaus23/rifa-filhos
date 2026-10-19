/* =====================================================================
   Página do sorteio — ao vivo, com roleta, comprovante e controles
   dos pais (sortear / anular). O número é gerado no servidor.
   ===================================================================== */
(function () {
  const CFG = window.RIFA_CONFIG;
  const API = window.RifaAPI;
  const U = window.RifaUtil;
  const $ = (s) => document.querySelector(s);
  const reduzirMov = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const estado = {
    config: { ...CFG.rifa },
    sorteios: [],
    pagos: [],          // números confirmados (antes do sorteio)
    participantes: [],  // só para os pais (nome completo + celular do ganhador)
    admin: false,
    animando: false,
    idValidoMostrado: undefined,
  };
  const pad = (n) => U.pad(n, estado.config.totalNumeros);
  const valido = () => estado.sorteios.find((s) => !s.anulado) || null;

  function toast(msg, ms = 2800) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), ms);
  }

  /* ---------------------------- render ------------------------------ */
  function render() {
    const s = valido();
    const c = estado.config;

    // Palco
    $("#bola").classList.toggle("vencedora", !!s);
    if (!estado.animando) $("#bola-num").textContent = s ? pad(s.numero) : "?";
    const cont = $("#sorteio-contagem");
    if (s) {
      $("#palco-titulo").innerHTML = `Parabéns, <em>${U.esc(U.nomePublico(s))}</em>! 🎉`;
      $("#palco-sub").textContent = `Número ${pad(s.numero)} sorteado em ${U.dataLonga(s.realizado_em)}, às ${horaSeg(s.realizado_em)}, entre ${s.total_concorrentes} números confirmados.`;
      cont.hidden = true;
      $("#btn-rever").hidden = reduzirMov;
    } else {
      $("#btn-rever").hidden = true;
      const quando = c.dataSorteio ? `${U.dataLonga(c.dataSorteio)}, às ${U.hora(c.dataSorteio)}` : "data a definir";
      const passou = c.dataSorteio && new Date(c.dataSorteio) <= new Date();
      $("#palco-titulo").textContent = passou ? "O sorteio vai começar! 🍀" : "O sorteio ainda não aconteceu";
      $("#palco-sub").textContent = passou
        ? "Fique nesta página: o número aparece aqui assim que for sorteado."
        : `Será ao vivo, aqui nesta página, em ${quando}. Deixe a página aberta no dia — o resultado aparece sozinho.`;
      cont.hidden = !c.dataSorteio || passou;
    }

    // Pais
    $("#pais-box").hidden = !estado.admin;
    $("#btn-sortear").hidden = !!s;
    $("#btn-anular").hidden = !s;
    const contato = $("#ganhador-contato");
    const dono = s && estado.admin ? estado.participantes.find((p) => p.numero === s.numero) : null;
    contato.hidden = !dono;
    if (dono) {
      const msg = `Oi, ${dono.nome.split(" ")[0]}! 🎉 Aqui é da ${U.txt("Rifa {do} {bebe}")}: o seu número ${pad(s.numero)} foi o sorteado! Parabéns e obrigado por fazer parte desse momento. 💛`;
      contato.innerHTML = `<p>Ganhador(a), só vocês veem: <b>${U.esc(dono.nome)}</b> · ${U.formatarCelular(dono.celular)}</p>
        <a class="btn btn-verde" target="_blank" rel="noopener" href="${U.linkWhatsApp(dono.celular, msg)}">Avisar no WhatsApp</a>`;
    }

    // Concorrentes
    const lista = s ? s.concorrentes : estado.pagos;
    $("#conc-titulo").textContent = s ? `Números que concorreram (${lista.length})` : `Números concorrendo (${lista.length})`;
    $("#conc-lista").innerHTML = lista.length
      ? lista.map((n) => `<span class="chip${s && n === s.numero ? " chip-vencedor" : ""}">${pad(n)}</span>`).join("")
      : `<p class="vazio">Ainda não há números com pagamento confirmado.</p>`;

    // Comprovante
    const anulados = estado.sorteios.filter((x) => x.anulado);
    $("#comprovante-sec").hidden = !s && !anulados.length;
    $("#comprovante").innerHTML = s ? comprovanteHTML(s) : `<p class="vazio">Nenhum sorteio válido no momento.</p>`;
    $("#anulados").innerHTML = anulados.length
      ? `<h3 class="anulados-tit">Sorteios anulados</h3>` + anulados.map((a) => `
        <div class="anulado">
          <b>${pad(a.numero)}</b> sorteado em ${U.dataLonga(a.realizado_em)} às ${horaSeg(a.realizado_em)} —
          anulado em ${U.dataLonga(a.anulado_em)} às ${horaSeg(a.anulado_em)}.
          <div class="muted">Motivo: ${U.esc(a.motivo_anulacao || "—")}</div>
        </div>`).join("")
      : "";
  }

  function horaSeg(d) {
    return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
  }

  function comprovanteHTML(s) {
    const codigo = String(s.id).replace(/-/g, "").slice(0, 10).toUpperCase();
    return `
      <dl class="comp-grid">
        <div><dt>Número sorteado</dt><dd class="comp-num">${pad(s.numero)}</dd></div>
        <div><dt>Ganhador(a)</dt><dd>${U.esc(U.nomePublico(s) || "—")}${s.celular_final ? `<br><span class="muted">celular final ${U.esc(s.celular_final)}</span>` : ""}</dd></div>
        <div><dt>Data e hora</dt><dd>${U.dataLonga(s.realizado_em)}, ${horaSeg(s.realizado_em)}</dd></div>
        <div><dt>Concorrentes</dt><dd>${s.total_concorrentes} números confirmados</dd></div>
        <div><dt>Código do sorteio</dt><dd><code>${codigo}</code></dd></div>
        <div><dt>Método</dt><dd>Aleatório criptográfico, gerado no servidor</dd></div>
      </dl>`;
  }

  /* --------------------------- contagem ----------------------------- */
  function contagem() {
    const alvo = estado.config.dataSorteio ? new Date(estado.config.dataSorteio).getTime() : null;
    if (!alvo) return;
    const set = (id, v) => ($(id).textContent = String(v).padStart(2, "0"));
    let r = Math.max(0, alvo - Date.now());
    const d = Math.floor(r / 86400e3); r -= d * 86400e3;
    const h = Math.floor(r / 3600e3); r -= h * 3600e3;
    const m = Math.floor(r / 60e3); r -= m * 60e3;
    set("#sc-d", d); set("#sc-h", h); set("#sc-m", m); set("#sc-s", Math.floor(r / 1000));
  }

  /* ---------------------------- roleta ------------------------------ */
  function roleta(concorrentes, vencedor) {
    return new Promise((fim) => {
      const el = $("#bola-num");
      const bola = $("#bola");
      if (reduzirMov || concorrentes.length < 2) { el.textContent = pad(vencedor); return fim(); }
      estado.animando = true;
      $("#sorteio-contagem").hidden = true;
      $("#pais-box").hidden = true;
      $("#btn-rever").hidden = true;
      bola.classList.remove("vencedora");
      bola.classList.add("girando");
      $("#palco-titulo").textContent = "Sorteando…";
      $("#palco-sub").textContent = `Entre ${concorrentes.length} números confirmados`;
      const passos = 42;
      let i = 0;
      const tick = () => {
        i++;
        if (i >= passos) {
          el.textContent = pad(vencedor);
          bola.classList.remove("girando");
          bola.classList.add("vencedora", "pulso");
          setTimeout(() => bola.classList.remove("pulso"), 900);
          estado.animando = false;
          confete();
          return fim();
        }
        let n;
        do { n = concorrentes[Math.floor(Math.random() * concorrentes.length)]; } while (concorrentes.length > 1 && pad(n) === el.textContent);
        el.textContent = pad(n);
        const t = i / passos;
        setTimeout(tick, 45 + Math.pow(t, 3) * 520); // começa rápido e vai desacelerando (~6 s)
      };
      tick();
    });
  }

  function confete() {
    if (reduzirMov) return;
    const cores = ["#b4613f", "#6f8467", "#c99a3d", "#f4dfd3", "#e3eadc", "#ffffff"];
    const box = document.createElement("div");
    box.className = "confete";
    for (let i = 0; i < 140; i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = cores[i % cores.length];
      p.style.animationDuration = 2.4 + Math.random() * 2.2 + "s";
      p.style.animationDelay = Math.random() * 0.6 + "s";
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 5500);
  }

  /* ----------------------------- dados ------------------------------ */
  async function carregar() {
    const [cfg, sorteios, ocupados] = await Promise.all([
      API.getConfig(), API.getSorteios(), API.getOcupados(),
    ]);
    estado.config = cfg;
    estado.sorteios = sorteios;
    estado.pagos = ocupados.filter((o) => o.status === "pago").map((o) => o.numero).sort((a, b) => a - b);
    if (estado.admin) estado.participantes = await API.listarParticipantes().catch(() => []);
  }

  /* Verifica de tempos em tempos: quem está assistindo vê a roleta
     girar assim que os pais apertarem "Sortear". */
  async function vigiar() {
    if (estado.animando || estado.ocupado) return;
    try {
      const antes = valido();
      await carregar();
      const agora = valido();
      const idAntes = antes ? antes.id : null;
      const idAgora = agora ? agora.id : null;
      if (idAgora && idAgora !== idAntes) {
        await roleta(agora.concorrentes, agora.numero);
      }
      render();
    } catch (_) {}
  }

  /* ------------------------- ações dos pais ------------------------- */
  const modal = $("#modal");
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.hasAttribute("data-fechar")) modal.close();
  });

  $("#btn-sortear").addEventListener("click", async () => {
    await carregar().catch(() => {});
    render();
    const n = estado.pagos.length;
    const c = estado.config;
    const vendasAbertas = c.vendasAte && new Date() < new Date(c.vendasAte);
    $("#modal-corpo").innerHTML = `
      <h2>Sortear agora?</h2>
      <p><b>${n}</b> ${n === 1 ? "número confirmado vai" : "números confirmados vão"} concorrer.</p>
      ${vendasAbertas ? `<p class="aviso">⚠️ As vendas ainda estão abertas até ${U.dataLonga(c.vendasAte)}, às ${U.hora(c.vendasAte)}. Depois do sorteio ninguém mais consegue reservar.</p>` : ""}
      <p class="muted">Só existe um sorteio válido. Se precisar refazer, será preciso anular (e o motivo fica público).</p>
      <p class="erro" id="sortear-erro"></p>
      <button class="btn btn-primario" id="confirmar-sorteio" type="button" ${n ? "" : "disabled"}>🎲 Sortear</button>
      <button class="btn btn-link" type="button" data-fechar>cancelar</button>`;
    modal.showModal();
    $("#confirmar-sorteio").addEventListener("click", async (e) => {
      const b = e.currentTarget;
      b.disabled = true; b.textContent = "Sorteando…";
      estado.ocupado = true;
      try {
        const s = await API.sortear();
        modal.close();
        await carregar();
        await roleta(s.concorrentes, s.numero);
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        $("#sortear-erro").textContent = err.message;
        b.disabled = false; b.textContent = "🎲 Sortear";
      } finally { estado.ocupado = false; }
    });
  });

  $("#btn-anular").addEventListener("click", () => {
    const s = valido();
    if (!s) return;
    $("#modal-corpo").innerHTML = `
      <h2>Anular o sorteio?</h2>
      <p>O número <b>${pad(s.numero)}</b> deixa de valer e vocês poderão sortear de novo. A anulação e o motivo ficam <b>públicos</b> no comprovante.</p>
      <label class="campo"><span>Motivo</span><textarea id="motivo" maxlength="300" placeholder="ex.: a transmissão caiu antes do resultado"></textarea></label>
      <p class="erro" id="anular-erro"></p>
      <button class="btn btn-primario" id="confirmar-anular" type="button">Anular sorteio</button>
      <button class="btn btn-link" type="button" data-fechar>cancelar</button>`;
    modal.showModal();
    $("#confirmar-anular").addEventListener("click", async () => {
      try {
        await API.anularSorteio($("#motivo").value);
        modal.close();
        await carregar();
        render();
        toast("Sorteio anulado. Vocês já podem sortear de novo.");
      } catch (err) { $("#anular-erro").textContent = err.message; }
    });
  });

  $("#btn-rever").addEventListener("click", async () => {
    const s = valido();
    if (!s || estado.animando) return;
    await roleta(s.concorrentes, s.numero);
    render();
  });

  /* ----------------------------- início ----------------------------- */
  (async function iniciar() {
    document.querySelectorAll("[data-tpl]").forEach((el) => (el.innerHTML = U.txt(el.dataset.tpl)));
    document.title = U.txt("Sorteio — Rifa {do} {bebe}");
    $("#rodape-assinatura").textContent = CFG.familia.assinatura;
    if (API.modo === "demo") $("#faixa-demo").hidden = false;
    try {
      await carregar();
    } catch (e) {
      toast("Não consegui carregar o sorteio. Atualize a página.", 5000);
    }
    try {
      const sessao = await API.sessao();
      estado.admin = !!sessao && (await API.eAdmin());
      if (estado.admin) estado.participantes = await API.listarParticipantes().catch(() => []);
    } catch (_) {}
    render();
    contagem();
    setInterval(contagem, 1000);
    setInterval(vigiar, 4000);
  })();
})();
