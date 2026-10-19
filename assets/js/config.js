/* =====================================================================
   CONFIGURAÇÃO DA RIFA DO MATIAS
   Este é o único arquivo que você precisa editar no dia a dia:
   textos, fotos do diário, chave PIX, datas e conexão com o Supabase.
   ===================================================================== */
window.RIFA_CONFIG = {
  /* ---------------------------------------------------------------
     SUPABASE — deixe vazio para rodar em MODO DEMONSTRAÇÃO
     (os dados ficam só no navegador, ótimo para testar o layout).
     Preencha com a URL e a "anon/publishable key" do projeto.
     --------------------------------------------------------------- */
  supabase: {
    url: "https://bohzxjiyxgibdufaheik.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvaHp4aml5eGdpYmR1ZmFoZWlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTkxMzYsImV4cCI6MjEwNzk5NTEzNn0.wlyQCGjmOg2bn-1jBwpdItxK8_TlWm4ww-8sgKE1lmI",
  },

  /* ---------------------------------------------------------------
     RIFA FILHOS — dados do filho desta edição.
     Para o próximo filho: troque nome, ordem e gênero aqui (e as
     fotos/diário abaixo). Todo o site se ajusta sozinho.
     --------------------------------------------------------------- */
  familia: {
    pais: "David & Vanessa",
    bebe: "Matias",
    ordem: 1,          // 1 = primeiro filho, 2 = segundo...
    genero: "m",       // "m" (do/pro/ele) ou "f" (da/pra/ela)
    assinatura: "David, Vanessa e Matias",
  },

  /* Valores usados no modo demo. Com o Supabase ligado, os valores
     oficiais vêm da tabela rifa_config (editável pelo painel admin). */
  rifa: {
    totalNumeros: 200,
    dataAbertura: "2026-10-18T00:00:00-03:00",
    valorNumero: null,                         // null = "a definir"
    dataSorteio: "2027-01-30T19:00:00-03:00",
    vendasAte: "2027-01-29T12:00:00-03:00",
    premio: null,                              // ex.: "Um kit surpresa + R$ 300"
    numeroSorteado: null,
  },

  /* Como o número vencedor será definido (aparece no cronograma) */
  formaSorteio:
    "O sorteio é feito aqui no site, ao vivo, na página do sorteio. Concorrem todos os números " +
    "com pagamento confirmado, com a mesma chance. O número é gerado pelo servidor de forma " +
    "aleatória, só pode ser sorteado uma vez e o comprovante fica público.",

  pix: {
    chave: "13658007761",   // CPF (só números), e-mail, celular (+55...) ou chave aleatória
    nomeRecebedor: "David", // até 25 caracteres, sem acento
    cidade: "RIO DE JANEIRO", // até 15 caracteres, sem acento
  },

  /* WhatsApp para receber os comprovantes (só números, com 55 + DDD) */
  whatsappContato: "5521995258697",

  /* Gestação (usado só no modo demo / antes da migração 02).
     Com o Supabase, edite em: Área dos pais › Configuração › Gestação. */
  gestacao: {
    dataReferencia: "2026-10-18",
    semanasNaReferencia: 21,
  },

  /* Marcos EXTRAS do cronograma (opcional). Abertura, fim das vendas,
     lembrete, sorteio e chegada do Matias já são gerados automaticamente
     a partir das datas da aba Configuração do painel. Exemplo:
     { data: "2026-12-20", titulo: "Live de Natal", texto: "..." } */
  cronograma: [],

  /* Diário — usado só no modo demo / antes da migração 02.
     Com o Supabase, publique pela Área dos pais › Diário (com foto).
     {semanas} no texto vira a semana de gestação na data do post. */
  diario: [
    {
      data: "2026-10-18",
      titulo: "Nós três",
      texto:
        "{semanas} semanas de muito amor. Em vez de chá, decidimos fazer uma rifa — " +
        "e queremos que você acompanhe cada passo com a gente até o sorteio.",
      foto: "imagens/familia.jpg",
    },
  ],
};
