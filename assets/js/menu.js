/* Menu do topo: botão "Menu" no celular abre/fecha a lista */
(function () {
  const topo = document.querySelector(".topo");
  const btn = document.querySelector(".menu-toggle");
  if (!topo || !btn) return;
  const fechar = () => { topo.classList.remove("aberto"); btn.setAttribute("aria-expanded", "false"); };
  btn.addEventListener("click", () => {
    const aberto = topo.classList.toggle("aberto");
    btn.setAttribute("aria-expanded", String(aberto));
  });
  topo.querySelectorAll(".menu a").forEach((a) => a.addEventListener("click", fechar));
  document.addEventListener("click", (e) => { if (!topo.contains(e.target)) fechar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
})();
