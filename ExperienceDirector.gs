/**
 * Diretor de experiência de Sema Edge.
 * Inspirado em ZQuestClassic (capítulos/estado), Unciv (decisões por rodada)
 * e GCompris (andaimes e evidência formativa). Funções puras e determinísticas.
 *
 * Estrutura de fases:
 *   Fase 1 — Exploração (cap. 1–2): decisão binária clara, estado generoso.
 *   Fase 2 — Tensão     (cap. 3–4): 3 opções com trade-offs reais.
 *   Fase 3 — Crise      (cap. 5–6): decisões encadeadas, estado pressionado.
 */
var EXPERIENCE_GAME_ = {
  id: "sema-edge",
  title: "Sema Edge",
  sharedResource: "planejamento e depuração de rotas computacionais",
  chapters: [
    // ── FASE 1 · Exploração ──────────────────────────────────────────────────
    { id: "prever", order: 1, phase: 1, constraint: null,
      title: "A encomenda que precisa chegar",
      situation: "O grupo recebe um mapa de grafos e deve desenhar uma rota no papel antes de mover qualquer pacote.",
      decisions: [
        { id: "planejar", label: "Marcar passos lógicos e pontos de decisão explícitos", delta: { knowledge: 2, cooperation: 1, pressure: -1 } },
        { id: "tentar",   label: "Mover os nós aleatoriamente sem registrar um plano",    delta: { knowledge: 0, cooperation: 0, pressure: 1 } }
      ]
    },
    { id: "topologia-inicial", order: 2, phase: 1, constraint: null,
      title: "A primeira bifurcação de rede",
      situation: "Dois caminhos levam ao nó central: um tem menos saltos e o outro tem menor latência de transmissão.",
      decisions: [
        { id: "analisar-metricas", label: "Calcular a latência média e justificar a escolha", delta: { knowledge: 2, cooperation: 1, pressure: -1 } },
        { id: "escolha-apressada", label: "Escolher o caminho visualmente mais curto",         delta: { knowledge: -1, cooperation: 0, pressure: 1 } }
      ]
    },

    // ── FASE 2 · Tensão ──────────────────────────────────────────────────────
    { id: "depurar", order: 3, phase: 2, constraint: "Falha de enlace: dois nós principais caíram simultaneamente durante o tráfego.",
      title: "A trilha interrompida e depuração",
      situation: "Um bloqueio inesperado torna a primeira rota inviável. O erro precisa ser transformado em pista algorítmica.",
      decisions: [
        { id: "revisar",    label: "Voltar ao último nó seguro e alterar a sub-rota",        delta: { knowledge: 2, cooperation: 1, pressure: -1 } },
        { id: "reiniciar",  label: "Repetir toda a rota do zero sem comparar diferenças",   delta: { knowledge: -1, cooperation: 0, pressure: 1 } },
        { id: "roteamento", label: "Implementar desvio dinâmico com tabela de contingência", delta: { knowledge: 2, cooperation: 2, pressure: 0 } }
      ]
    },
    { id: "gargalo-fluxo", order: 4, phase: 2, constraint: "Buffer limitado: nós intermediários acumulam pacotes e podem estourar a memória.",
      title: "O gargalo de vazão",
      situation: "O tráfego de dados aumentou 300%. Manter a entrega sem perda de pacotes exige balanceamento de carga.",
      decisions: [
        { id: "balancear-canais", label: "Distribuir o fluxo em canais paralelos de menor capacidade", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "forcar-principal", label: "Concentrar tudo no canal principal aceitando descartes",      delta: { knowledge: -1, cooperation: -1, pressure: 2 } },
        { id: "priorizar-filas",  label: "Configurar fila de prioridade para pacotes de emergência",   delta: { knowledge: 1, cooperation: 2, pressure: 0 } }
      ]
    },

    // ── FASE 3 · Crise ───────────────────────────────────────────────────────
    { id: "otimizar", order: 5, phase: 3, constraint: "Restrição de energia: os nós de borda (edge) operam com bateria solar em fim de carga.",
      title: "Mais curto para quem? Otimização multi-critério",
      situation: "Duas rotas finais têm custos conflitantes: economia de energia versus velocidade máxima de entrega.",
      decisions: [
        { id: "justificar",  label: "Ponderar critérios de energia, latência e equidade de nós", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "encurtar",    label: "Escolher cegamente pelo menor tempo sem avaliar o consumo", delta: { knowledge: 0, cooperation: -1, pressure: 1 } },
        { id: "adaptativo",  label: "Programar algoritmo adaptativo que reduz frequência de clock", delta: { knowledge: 2, cooperation: 2, pressure: 0 } }
      ]
    },
    { id: "rede-resiliente", order: 6, phase: 3, constraint: "Ataque distribuído: simulação de estresse com 50% de pacotes maliciosos na borda.",
      title: "A malha autônoma e resiliente",
      situation: "A rede precisa isolar nós infectados e manter serviços essenciais da escola ativos sem interrupção.",
      decisions: [
        { id: "quarentena-segmentada", label: "Segmentar a rede em clusters isolados com validação criptográfica", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "desconectar-geral",     label: "Derrubar toda a rede e perder a comunicação da escola",            delta: { knowledge: -2, cooperation: -2, pressure: 2 } },
        { id: "filtro-coletivo",       label: "Consolidar regras de firewall distribuído validadas pelos alunos",  delta: { knowledge: 2, cooperation: 3, pressure: -1 } }
      ]
    },

    // ── FASE 4 · Rede Conectada ──────────────────────────────────────────────────
    { id: "malha-regional", order: 7, phase: 4, constraint: "Escala regional: os trajetos urbanos devem conectar corredores verdes sem segregação.",
      title: "A malha territorial integrada",
      situation: "O planejamento das rotas locais agora precisa se conectar com a malha intermunicipal, preservando mananciais.",
      decisions: [
        { id: "corredores-verdes", label: "Desenhar rotas que respeitem as faixas de preservação permanente e reduzam emissões", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "caminho-mais-curto-danoso", label: "Cortar a área de proteção ambiental para obter o trajeto mais rápido", delta: { knowledge: -1, cooperation: -2, pressure: 2 } },
        { id: "mapeamento-colaborativo", label: "Abrir plataforma para motoristas, pedestres e ciclistas mapearem pontos de conflito", delta: { knowledge: 2, cooperation: 3, pressure: -1 } }
      ]
    },
    { id: "autonomia-comunitaria", order: 8, phase: 4, constraint: "Soberania de dados: a comunidade deve ter autonomia para atualizar os mapas de risco.",
      title: "A cidade inteligente e humana",
      situation: "O sistema de roteamento é entregue à gestão democrática dos bairros para guiar o crescimento planejado.",
      decisions: [
        { id: "governanca-participativa", label: "Estabelecer conselho cidadão de mobilidade e monitoramento ambiental em tempo real", delta: { knowledge: 2, cooperation: 3, pressure: -1 } },
        { id: "privatizar-dados", label: "Vender os dados de tráfego a empresas privadas sem transparência pública", delta: { knowledge: -2, cooperation: -3, pressure: 2 } },
        { id: "observatorio-escola", label: "Transformar a escola em laboratório permanente de planejamento urbano sustentável", delta: { knowledge: 2, cooperation: 2, pressure: 0 } }
      ]
    }
  ]
};

function experienceClamp_(value) {
  return Math.max(0, Math.min(10, Number(value) || 0));
}

function getExperienceChapter(chapterId, year) {
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];
  var schoolYear = Math.max(1, Math.min(5, Number(year) || 3));
  var phaseLabels = { 1: 'Exploração', 2: 'Tensão', 3: 'Crise', 4: 'Rede Conectada' };
  return {
    success: true,
    data: {
      gameId:         EXPERIENCE_GAME_.id,
      title:          chapter.title,
      situation:      chapter.situation,
      sharedResource: EXPERIENCE_GAME_.sharedResource,
      phase:          chapter.phase,
      phaseLabel:     phaseLabels[chapter.phase] || 'Exploração',
      constraint:     chapter.constraint || null,
      totalChapters:  EXPERIENCE_GAME_.chapters.length,
      decisions: chapter.decisions.map(function (item) { return { id: item.id, label: item.label }; }),
      cycle: {
        prediction:  schoolYear <= 2 ? 'Desenhe ou conte o que você acha que vai acontecer.' : 'Registre sua previsão e a evidência que pretende observar.',
        observation: 'O que mudou depois da escolha? Use um dado, sinal ou acontecimento do jogo.',
        explanation: 'Como a decisão contribuiu para esse resultado?',
        revision:    'O que o grupo manteria ou mudaria na próxima rodada?'
      },
      support: schoolYear <= 2 ? 'Leitura em voz alta, ícones e resposta oral.' : 'Tabela comparativa, pausa e papéis cooperativos.'
    }
  };
}

function resolveExperienceDecision(state, chapterId, decisionId, evidence) {
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];
  var decision = chapter.decisions.filter(function (item) {
    return item.id === String(decisionId || '');
  })[0];
  if (!decision) return { success: false, error: 'Escolha não reconhecida para este capítulo.' };
  var current = state || {};
  var next = {
    chapter:     Math.min(EXPERIENCE_GAME_.chapters.length, (Number(current.chapter) || chapter.order) + 1),
    knowledge:   experienceClamp_((Number(current.knowledge)   || 5) + decision.delta.knowledge),
    cooperation: experienceClamp_((Number(current.cooperation) || 5) + decision.delta.cooperation),
    pressure:    experienceClamp_((Number(current.pressure)    || 2) + decision.delta.pressure)
  };
  var balance = next.knowledge + next.cooperation - next.pressure;
  return {
    success:   true,
    gameId:    EXPERIENCE_GAME_.id,
    choice:    { id: decision.id, label: decision.label },
    phase:     chapter.phase,
    previousState: {
      knowledge:   experienceClamp_(Number(current.knowledge)   || 5),
      cooperation: experienceClamp_(Number(current.cooperation) || 5),
      pressure:    experienceClamp_(Number(current.pressure)    || 2)
    },
    nextState:   next,
    consequence: balance >= 8
      ? 'A decisão aperfeiçoou a topologia e a robustez algorítmica de ' + EXPERIENCE_GAME_.sharedResource + '.'
      : balance >= 4
      ? 'A rota calculada garantiu a entrega com compensações de latência documentadas pela equipe.'
      : 'A decisão provocou congestionamento de pacotes que demanda reestruturação das tabelas de fluxo.',
    evidence:    String(evidence || '').trim().substring(0, 420),
    reflection:  getExperienceChapter(chapterId, 3).data.cycle.revision,
    complete:    chapter.order >= EXPERIENCE_GAME_.chapters.length
  };
}

/**
 * Calcula o desfecho final com base no estado acumulado de Sema Edge.
 */
function getExperienceEndgame(state) {
  var s = state || {};
  var k = experienceClamp_(Number(s.knowledge)   || 5);
  var c = experienceClamp_(Number(s.cooperation) || 5);
  var p = experienceClamp_(Number(s.pressure)    || 2);
  var balance = k + c - p;
  var route, title, summary, recommendation;
  if (balance >= 10) {
    route          = 'equilibrado';
    title          = 'Arquitetura de Borda Ótima e Resiliente';
    summary        = 'O time dominou os princípios de grafos, balanceamento de carga e segurança distribuída com alto entrosamento.';
    recommendation = 'Documente os algoritmos de depuração e publique no repositório de robótica da escola.';
  } else if (p >= 7) {
    route          = 'sobrecarga';
    title          = 'Rede Saturada';
    summary        = 'O afã de velocidade levou à saturação de buffers e perda crítica de pacotes sob estresse.';
    recommendation = 'Reveja o capítulo 4 sobre controle de congestionamento e filas prioritárias.';
  } else {
    route          = 'fragmentado';
    title          = 'Sub-redes Isoladas';
    summary        = 'Nós individuais foram otimizados, mas faltou coerência no roteamento global de ponta a ponta.';
    recommendation = 'Pratiquem exercícios de simulação de grafos completos em duplas.';
  }
  return {
    success:        true,
    gameId:         EXPERIENCE_GAME_.id,
    route:          route,
    title:          title,
    summary:        summary,
    recommendation: recommendation,
    finalState:     { knowledge: k, cooperation: c, pressure: p, balance: balance }
  };
}

/**
 * Workflow mínimo compartilhado: orientar → prever → decidir → observar →
 * refletir. O estado retornado é serializável e pode ser salvo pelo cliente.
 */
function getExperienceBasicWorkflow(year) {
  var first = EXPERIENCE_GAME_.chapters[0];
  return {
    success: true,
    data: {
      gameId:    EXPERIENCE_GAME_.id,
      title:     EXPERIENCE_GAME_.title,
      chapterId: first.id,
      stage:     'briefing',
      stages:    ['briefing', 'prediction', 'decision', 'observation', 'reflection'],
      briefing:  getExperienceChapter(first.id, year).data,
      state:     { chapter: 1, knowledge: 5, cooperation: 5, pressure: 2 },
      complete:  false
    }
  };
}

function advanceExperienceBasicWorkflow(workflow, input, year) {
  var current = workflow && workflow.data ? workflow.data : workflow;
  if (!current || current.gameId !== EXPERIENCE_GAME_.id) {
    current = getExperienceBasicWorkflow(year).data;
  }
  var payload = input || {};
  var stages  = ['briefing', 'prediction', 'decision', 'observation', 'reflection'];
  var stage   = current.stage || 'briefing';
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(current.chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];

  // Verificação de pré-requisito na transição entre fases
  if (stage === 'briefing' && chapter.phase > 1) {
    var prevIdx     = chapter.order - 2;
    var prevChapter = prevIdx >= 0 ? EXPERIENCE_GAME_.chapters[prevIdx] : null;
    if (prevChapter && prevChapter.phase < chapter.phase &&
        (Number((current.state || {}).knowledge) || 5) < 3) {
      return {
        success:     true,
        needsReview: true,
        message:     'A equipe precisa consolidar o traçado lógico da fase anterior antes de enfrentar gargalos maiores de tráfego.',
        data:        current
      };
    }
  }

  var next = {
    gameId:      EXPERIENCE_GAME_.id,
    title:       EXPERIENCE_GAME_.title,
    chapterId:   chapter.id,
    stage:       stage,
    stages:      stages.slice(),
    briefing:    getExperienceChapter(chapter.id, year).data,
    state:       current.state || { chapter: chapter.order, knowledge: 5, cooperation: 5, pressure: 2 },
    prediction:  String(current.prediction  || ''),
    observation: String(current.observation || ''),
    reflection:  String(current.reflection  || ''),
    lastResult:  current.lastResult || null,
    complete:    false
  };

  if (stage === 'briefing') {
    next.stage = 'prediction';
  } else if (stage === 'prediction') {
    next.prediction = String(payload.text || payload.prediction || '').trim().substring(0, 420);
    if (!next.prediction) return { success: false, error: 'Registre uma previsão antes de decidir.', data: next };
    next.stage = 'decision';
  } else if (stage === 'decision') {
    var result = resolveExperienceDecision(next.state, chapter.id, payload.decisionId, payload.evidence);
    if (!result.success) return { success: false, error: result.error, data: next };
    next.state      = result.nextState;
    next.lastResult = result;
    next.stage      = 'observation';
  } else if (stage === 'observation') {
    next.observation = String(payload.text || payload.observation || '').trim().substring(0, 420);
    if (!next.observation) return { success: false, error: 'Registre uma evidência observada.', data: next };
    next.stage = 'reflection';
  } else {
    next.reflection = String(payload.text || payload.reflection || '').trim().substring(0, 420);
    if (!next.reflection) return { success: false, error: 'Registre o que manter ou revisar.', data: next };
    var nextChapter = EXPERIENCE_GAME_.chapters[chapter.order];
    if (!nextChapter) {
      next.complete = true;
      next.stage    = 'complete';
      next.endgame  = getExperienceEndgame(next.state);
    } else {
      next.chapterId   = nextChapter.id;
      next.stage       = 'briefing';
      next.briefing    = getExperienceChapter(nextChapter.id, year).data;
      next.prediction  = '';
      next.observation = '';
      next.reflection  = '';
    }
  }
  return { success: true, data: next };
}

