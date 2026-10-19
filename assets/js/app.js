/* =====================================================================
   Site público da Rifa Filhos (textos do filho vêm do config.js)
   ===================================================================== */
(function () {
  const CFG = window.RIFA_CONFIG;
  const API = window.RifaAPI;
  const U = window.RifaUtil;
  const $ = (s) => document.querySelector(s);

  const estado = {
    config: { ...CFG.rifa },
    ocupados: new Map(), // numero -> {status, primeiro_nome, nome_curto}
    selecionados: new Set(),
  };

  /* ---------------------------- helpers ----------------------------- */
  function toast(msg, ms = 2600) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), ms);
  }
  const vendasAbertas = () => {
    const c = estado.config;
    if (c.numeroSorteado) return false;
    if (c.dataAbertura && new Date() < new Date(c.dataAbertura)) return false;
    if (c.vendasAte && new Date() > new Date(c.vendasAte)) return false;
    return true;
  };
  const pad = (n) => U.pad(n, estado.config.totalNumeros);

  /* ----------------------------- hero ------------------------------- */
  function renderHero() {
    const c = estado.config;
    $("#rodape-assinatura").textContent = CFG.familia.assinatura;

    const g = U.gestacao();
    $("#gest-semanas").textContent = g.semanas;
    $("#gest-dias").textContent = g.dias ? `e ${g.dias} dia${g.dias > 1 ? "s" : ""}` : "";
    $("#gest-dpp").textContent = U.dataLonga(g.dpp);
    requestAnimationFrame(() => {
      $("#gest-barra").style.width = g.progresso * 100 + "%";
      $("#gest-bebe").style.left = g.progresso * 100 + "%";
    });

    $("#st-valor").textContent = U.moeda(c.valorNumero);
    $("#st-sorteio").textContent = c.dataSorteio ? U.dataCurta(c.dataSorteio) : "a definir";
    $("#premio").textContent = c.premio ? `Prêmio: ${c.premio}` : "";

    const v = $("#vencedor");
    if (c.numeroSorteado) {
      const dono = estado.ocupados.get(c.numeroSorteado);
      v.hidden = false;
      v.innerHTML = `🎉 Número sorteado: <strong>${pad(c.numeroSorteado)}</strong>` +
        (dono && dono.status === "pago" ? ` — parabéns, <b>${U.esc(U.nomePublico(dono))}</b>!` : "") +
        `<br><span class="muted">Obrigado a todos que fizeram parte. 💛</span> <a href="sorteio.html">Ver o sorteio e o comprovante →</a>`;
    } else v.hidden = true;
  }

  function renderStats() {
    const total = estado.config.totalNumeros;
    const usados = estado.ocupados.size;
    $("#st-vendidos").textContent = `${usados} de ${total}`;
    $("#numeros-resumo").textContent = `${total - usados} números livres de ${total}.`;
  }

  /* --------------------------- contagem ----------------------------- */
  function iniciarContagem() {
    const alvo = estado.config.dataSorteio ? new Date(estado.config.dataSorteio).getTime() : null;
    const sec = $("#contagem");
    if (!alvo) { sec.hidden = true; return; }
    const set = (id, v) => ($(id).textContent = String(v).padStart(2, "0"));
    const tick = () => {
      let r = Math.max(0, alvo - Date.now());
      if (r === 0) { $(".contagem-rotulo").textContent = estado.config.numeroSorteado ? "Sorteio realizado!" : "É hoje! Boa sorte 🍀"; }
      const d = Math.floor(r / 86400e3); r -= d * 86400e3;
      const h = Math.floor(r / 3600e3); r -= h * 3600e3;
      const m = Math.floor(r / 60e3); r -= m * 60e3;
      set("#cd-d", d); set("#cd-h", h); set("#cd-m", m); set("#cd-s", Math.floor(r / 1000));
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------------------- grade ------------------------------- */
  function renderGrade() {
    const grade = $("#grade");
    const busca = $("#busca").value.replace(/\D/g, "");
    const soLivres = $("#so-livres").checked;
    const aberto = vendasAbertas();
    const frag = document.createDocumentFragment();

    for (let n = 1; n <= estado.config.totalNumeros; n++) {
      const oc = estado.ocupados.get(n);
      if (soLivres && oc) continue;
      if (busca && !String(n).includes(busca) && !pad(n).includes(busca)) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "num";
      b.dataset.n = n;
      b.innerHTML = pad(n);
      if (oc) {
        b.disabled = true;
        b.classList.add(oc.status === "pago" ? "pago" : "res");
        const nome = U.nomePublico(oc);
        const [prim, ...resto] = nome.split(" ");
        b.innerHTML += `<small>${U.esc(prim)}</small>` + (resto.length ? `<small>${U.esc(resto.join(" "))}</small>` : "");
        b.title = `${pad(n)} — ${oc.status === "pago" ? "confirmado" : "reservado"} por ${nome}`;
        b.setAttribute("aria-label", b.title);
      } else {
        b.disabled = !aberto;
        b.setAttribute("aria-pressed", estado.selecionados.has(n));
        if (estado.selecionados.has(n)) b.classList.add("sel");
      }
      if (estado.config.numeroSorteado === n) b.classList.add("vencedor-num");
      frag.appendChild(b);
    }
    grade.replaceChildren(frag);

    const aviso = $("#vendas-encerradas");
    if (!aberto) {
      aviso.hidden = false;
      const ab = estado.config.dataAbertura;
      aviso.textContent = estado.config.numeroSorteado
        ? "O sorteio já foi realizado. Obrigado por participar!"
        : ab && new Date() < new Date(ab)
        ? `A rifa abre em ${U.dataLonga(ab)}, às ${U.hora(ab)}. Volte nesse dia para escolher seus números da sorte! 😉`
        : "As vendas foram encerradas. Agora é torcer! 🍀";
    } else aviso.hidden = true;
  }

  function renderBarraSel() {
    const sel = [...estado.selecionados].sort((a, b) => a - b);
    const bar = $("#barra-sel");
    bar.hidden = sel.length === 0;
    $("#sel-qtd").textContent = sel.length;
    $("#sel-rotulo").textContent = sel.length === 1 ? "número" : "números";
    const v = estado.config.valorNumero;
    $("#sel-total").textContent = v == null ? "valor a definir" : U.moeda(v * sel.length);
    $("#sel-lista").textContent = sel.map(pad).join(" · ");
  }

  $("#grade").addEventListener("click", (e) => {
    const b = e.target.closest(".num");
    if (!b || b.disabled) return;
    const n = Number(b.dataset.n);
    if (estado.selecionados.has(n)) estado.selecionados.delete(n);
    else {
      if (estado.selecionados.size >= 50) return toast("Máximo de 50 números por cadastro.");
      estado.selecionados.add(n);
    }
    b.classList.toggle("sel");
    b.setAttribute("aria-pressed", estado.selecionados.has(n));
    renderBarraSel();
  });
  $("#busca").addEventListener("input", renderGrade);
  $("#so-livres").addEventListener("change", renderGrade);
  $("#sel-limpar").addEventListener("click", () => { estado.selecionados.clear(); renderGrade(); renderBarraSel(); });
  $("#sel-continuar").addEventListener("click", abrirCadastro);

  /* --------------------------- cadastro ----------------------------- */
  const modal = $("#modal");
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.hasAttribute("data-fechar")) modal.close();
  });

  function abrirCadastro() {
    const sel = [...estado.selecionados].sort((a, b) => a - b);
    if (!sel.length) return;
    const v = estado.config.valorNumero;
    $("#modal-corpo").innerHTML = `
      <h2>Quase lá!</h2>
      <p class="muted">Seus números:</p>
      <div class="chips">${sel.map((n) => `<span class="chip">${pad(n)}</span>`).join("")}</div>
      <form id="form-cadastro" novalidate>
        <label class="campo"><span>Seu nome</span>
          <input name="nome" autocomplete="name" required maxlength="80" placeholder="Nome e sobrenome" /></label>
        <label class="campo"><span>Celular (WhatsApp)</span>
          <input name="celular" type="tel" inputmode="tel" autocomplete="tel-national" required placeholder="(11) 99999-9999" />
          <small>Usamos só para confirmar seu pagamento e avisar na véspera do sorteio.</small></label>
        <label class="campo"><span>${U.txt("Mensagem {pro} {bebe}")} <span class="muted">(opcional)</span></span>
          <textarea name="mensagem" maxlength="500" placeholder="Deixe um recado carinhoso…"></textarea></label>
        <label class="check"><input type="checkbox" name="publica" checked /> Pode mostrar minha mensagem no mural (aparece só o primeiro nome).</label>
        <div class="total-linha"><span>Total</span><strong>${v == null ? "a definir" : U.moeda(v * sel.length)}</strong></div>
        <p class="erro" id="form-erro"></p>
        <button class="btn btn-primario" type="submit">Reservar ${sel.length > 1 ? "meus números" : "meu número"}</button>
      </form>`;
    const f = $("#form-cadastro");
    f.celular.addEventListener("input", (e) => {
      const d = e.target.value.replace(/\D/g, "").slice(0, 11);
      e.target.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
    });
    f.addEventListener("submit", (e) => enviarCadastro(e, sel));
    modal.showModal();
    setTimeout(() => f.nome.focus(), 50);
  }

  async function enviarCadastro(e, sel) {
    e.preventDefault();
    const f = e.target;
    const erro = $("#form-erro");
    const nome = f.nome.value.trim();
    const celular = f.celular.value.replace(/\D/g, "");
    erro.textContent = "";
    if (nome.length < 2) return (erro.textContent = "Conta pra gente seu nome 🙂");
    if (celular.length < 10 || celular.length > 11) return (erro.textContent = "Confira o celular com DDD.");

    const btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Reservando…";
    try {
      const pedido = await API.reservar({
        numeros: sel, nome, celular, mensagem: f.mensagem.value, publica: f.publica.checked,
      });
      estado.selecionados.clear();
      await recarregar();
      mostrarPagamento(sel, nome, pedido);
    } catch (err) {
      erro.textContent = err.message;
      btn.disabled = false;
      btn.textContent = "Tentar de novo";
      await recarregar(); // atualiza a grade se alguém pegou o número antes
    }
  }

  function mostrarPagamento(sel, nome, pedido) {
    const v = estado.config.valorNumero;
    const total = v == null ? null : v * sel.length;
    const lista = sel.map(pad).join(", ");
    const pix = CFG.pix.chave
      ? RifaPix.gerar({
          chave: CFG.pix.chave, nome: CFG.pix.nomeRecebedor, cidade: CFG.pix.cidade,
          valor: total, txid: "RIFA" + String(pedido).replace(/[^a-z0-9]/gi, "").slice(0, 12),
        })
      : null;
    const msgComprovante =
      `Oi! Sou ${nome} e reservei ${sel.length > 1 ? "os números" : "o número"} ${lista} da ${U.txt("Rifa {do} {bebe}")}. ` +
      `Segue o comprovante do PIX${total ? ` de ${U.moeda(total)}` : ""}. 💛`;

    $("#modal-corpo").innerHTML = `
      <div class="ok-icone">💛</div>
      <h2 style="text-align:center">Obrigado, ${U.esc(nome.split(" ")[0])}!</h2>
      <p class="muted" style="text-align:center">Reservamos para você:</p>
      <div class="chips" style="justify-content:center">${sel.map((n) => `<span class="chip">${pad(n)}</span>`).join("")}</div>
      <div class="pix">
        ${
          pix
            ? `<p><strong>Pague ${total ? U.moeda(total) : ""} via PIX</strong></p>
               <div class="pix-qr" id="pix-qr"></div>
               <p class="pix-dica">Abra o <b>app do seu banco</b> › Pix › <b>Ler QR Code</b> (a câmera comum do celular não lê PIX).<br>No celular? Use o botão <b>Copiar código PIX</b> e escolha <b>Pix Copia e Cola</b> no banco.</p>
               <textarea class="pix-codigo" readonly id="pix-codigo">${U.esc(pix)}</textarea>`
            : `<p class="aviso">A chave PIX será divulgada em breve. A gente te chama no WhatsApp! 😊</p>`
        }
        <div class="pix-acoes">
          ${pix ? `<button class="btn btn-primario" id="copiar-pix" type="button">Copiar código PIX</button>` : ""}
          ${CFG.whatsappContato ? `<a class="btn btn-verde" target="_blank" rel="noopener" href="${U.linkWhatsApp(CFG.whatsappContato, msgComprovante)}">Enviar comprovante no WhatsApp</a>` : ""}
          <button class="btn btn-link" type="button" data-fechar>Fechar</button>
        </div>
        <p class="muted" style="font-size:.85rem;margin-top:10px">Seu número fica como <b>reservado</b> e muda para <b>confirmado</b> assim que conferirmos o pagamento.</p>
      </div>`;

    if (pix && window.qrcode) {
      const qr = qrcode(0, "M");
      qr.addData(pix);
      qr.make();
      $("#pix-qr").innerHTML = qr.createImgTag(6, 0);
    }
    const copiar = $("#copiar-pix");
    if (copiar) copiar.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(pix); }
      catch (_) { $("#pix-codigo").select(); document.execCommand("copy"); }
      toast("Código PIX copiado! Agora é só colar no app do banco.");
    });
  }

  /* -------------------------- cronograma ---------------------------- */
  function renderCronograma() {
    const c = estado.config;
    $("#forma-sorteio").textContent = CFG.formaSorteio;
    const marcos = CFG.cronograma.map((m) => ({ ...m, data: U.dia(m.data) }));
    if (c.dataAbertura) marcos.push({ data: new Date(c.dataAbertura), titulo: "Abertura da rifa", texto: `Começamos! Escolha seus números e faça parte da chegada ${U.txt("{do} {bebe}")}.` });
    if (c.vendasAte) marcos.push({ data: new Date(c.vendasAte), titulo: "Encerramento das vendas", texto: "Último dia para escolher seus números e enviar o PIX." });
    if (c.dataSorteio) {
      const ds = new Date(c.dataSorteio);
      marcos.push({ data: new Date(ds.getTime() - 86400e3), titulo: "Lembrete no WhatsApp", texto: "Na véspera, todo mundo com número confirmado recebe uma mensagem avisando do sorteio." });
      marcos.push({ data: ds, titulo: "Sorteio! 🍀", texto: `Às ${U.hora(ds)}, ao vivo na página do sorteio. ${c.premio ? "Prêmio: " + c.premio + "." : "O prêmio será divulgado em breve."}`, destaque: true, link: "sorteio.html" });
    }
    const g = U.gestacao();
    marcos.push({ data: g.dpp, titulo: U.txt("Chegada {do} {bebe} 👶"), texto: U.txt("A data prevista — mas quem decide é {ele}!"), aprox: true });
    marcos.sort((a, b) => a.data - b.data);

    const agora = Date.now();
    let proximoMarcado = false;
    $("#linha-tempo").innerHTML = marcos.map((m) => {
      let cls = "marco";
      const passou = m.data.getTime() < agora;
      if (passou) cls += " feito";
      else if (!proximoMarcado) { cls += " proximo"; proximoMarcado = true; }
      if (m.destaque) cls += " destaque";
      const selo = !passou && cls.includes("proximo") ? `<span class="selo">próximo</span>` : "";
      return `<li class="${cls}">
        <div class="marco-data">${m.aprox ? "previsto · " : ""}${U.dataLonga(m.data)}</div>
        <h3>${U.esc(m.titulo)}${selo}</h3>
        <p>${U.esc(m.texto || "")}${m.link ? ` <a href="${m.link}">Abrir página do sorteio →</a>` : ""}</p></li>`;
    }).join("");
  }

  /* ----------------------------- diário ----------------------------- */
  async function renderDiario() {
    let posts = CFG.diario;
    try { posts = await API.getDiario(); } catch (_) {}
    posts = [...posts].sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const html = posts.map((p) => {
      const sem = Math.floor(U.diasGestacao(p.data) / 7);
      const texto = String(p.texto || "").replace(/\{semanas\}/g, sem);
      return `<article class="post">
        ${p.foto ? `<img src="${U.esc(p.foto)}" alt="${U.esc(p.titulo)}" loading="lazy" />` : ""}
        <div class="post-corpo">
          <div class="post-meta">${U.dataLonga(U.dia(p.data))} · ${sem} semanas</div>
          <h3>${U.esc(p.titulo)}</h3>
          <p>${U.esc(texto)}</p>
        </div></article>`;
    }).join("");
    $("#diario-lista").innerHTML = html + `<div class="post embreve"><div class="icone">📸</div><p>Novas fotos em breve.<br>Ultrassons, barrigão e muito mais.</p></div>`;
  }
  $("#diario-lista").addEventListener("click", (e) => {
    const img = e.target.closest(".post img");
    if (!img) return;
    const lb = document.createElement("div");
    lb.className = "lightbox";
    lb.innerHTML = `<img src="${img.src}" alt="${U.esc(img.alt)}">`;
    lb.addEventListener("click", () => lb.remove());
    document.body.appendChild(lb);
  });

  /* ------------------------------ mural ----------------------------- */
  async function renderMural() {
    try {
      const recados = await API.getMural();
      $("#mural-lista").innerHTML = recados.length
        ? recados.map((r) => `<div class="recado"><p>${U.esc(r.mensagem)}</p><span>— ${U.esc(U.nomePublico(r))}</span></div>`).join("")
        : `<p class="vazio">Seja o primeiro a deixar um recado ${U.esc(U.txt("{pro} {bebe}"))}!</p>`;
    } catch (_) {
      $("#mural-lista").innerHTML = `<p class="vazio">Não foi possível carregar o mural agora.</p>`;
    }
  }

  /* ------------------------------ carga ----------------------------- */
  async function recarregar() {
    const lista = await API.getOcupados();
    estado.ocupados = new Map(lista.map((o) => [o.numero, o]));
    // remove da seleção números que foram pegos por outra pessoa
    [...estado.selecionados].forEach((n) => estado.ocupados.has(n) && estado.selecionados.delete(n));
    renderStats();
    renderGrade();
    renderBarraSel();
    renderHero();
    renderMural();
  }

  /* ----------------------- área dos pais (login) -------------------- */
  $("#link-pais").addEventListener("click", async (e) => {
    e.preventDefault();
    if (API.modo === "demo") return (location.href = "admin.html");
    const s = await API.sessao().catch(() => null);
    if (s) return (location.href = "admin.html");
    $("#modal-corpo").innerHTML = `
      <h2>Área dos pais</h2>
      <p class="muted">Acesso restrito ao David e à Vanessa.</p>
      <form id="form-login-pais">
        <label class="campo"><span>E-mail</span><input name="email" type="email" required autocomplete="username" /></label>
        <label class="campo"><span>Senha</span><input name="senha" type="password" required autocomplete="current-password" /></label>
        <p class="erro" id="login-pais-erro"></p>
        <button class="btn btn-primario" type="submit">Entrar</button>
      </form>`;
    const f = $("#form-login-pais");
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const btn = f.querySelector("button");
      btn.disabled = true; btn.textContent = "Entrando…";
      try {
        await API.login(f.email.value.trim(), f.senha.value);
        location.href = "admin.html";
      } catch (_) {
        $("#login-pais-erro").textContent = "E-mail ou senha incorretos.";
        btn.disabled = false; btn.textContent = "Entrar";
      }
    });
    modal.showModal();
    setTimeout(() => f.email.focus(), 50);
  });

  /* Preenche os textos marcados com data-tpl no HTML */
  function aplicarTextos() {
    document.querySelectorAll("[data-tpl]").forEach((el) => (el.innerHTML = U.txt(el.dataset.tpl)));
    document.querySelectorAll("[data-tpl-alt]").forEach((el) => (el.alt = U.txt(el.dataset.tplAlt)));
    document.title = U.txt("Rifa {do} {bebe}");
  }

  async function iniciar() {
    aplicarTextos();
    if (API.modo === "demo") $("#faixa-demo").hidden = false;
    try {
      estado.config = await API.getConfig();
      U.aplicarGestacao(estado.config);
    } catch (e) {
      toast("Não consegui carregar a rifa. Atualize a página.", 5000);
    }
    renderHero();
    renderCronograma();
    renderDiario();
    iniciarContagem();
    try { await recarregar(); } catch (e) { $("#numeros-resumo").textContent = "Erro ao carregar os números: " + e.message; }
    setInterval(() => { if (!modal.open) recarregar().catch(() => {}); }, 60000);
  }

  window.addEventListener("scroll", () => $(".topo").classList.toggle("rolou", scrollY > 10), { passive: true });
  iniciar();
})();
