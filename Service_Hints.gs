/**
 * Service_Hints.gs
 * 
 * Sistema de dicas progressivas para auxiliar jogadores em desafios.
 * Fornece dicas contextuais baseadas no estágio e na dificuldade.
 */

class Service_Hints {
  /**
   * Define as dicas progressivas para cada estágio
   */
  static hintDatabase_() {
    return {
      0: { // Floresta Amazônica
        name: "Floresta Amazônica",
        hints: [
          { level: 1, text: "Observe o padrão de obstáculos. Às vezes, é preciso empurrar uma caixa para longe do alvo antes de trazê-la de volta.", icon: "💡" },
          { level: 2, text: "Comece planejando de trás para frente: identifique onde cada caixa precisa estar no final.", icon: "🎯" },
          { level: 3, text: "A ordem importa! Tente mover a caixa mais distante primeiro para não bloquear as outras.", icon: "📍" }
        ]
      },
      1: { // Cerrado
        name: "Cerrado",
        hints: [
          { level: 1, text: "O Cerrado tem corredores estreitos. Planeje seus movimentos com cuidado para não ficar preso.", icon: "🌾" },
          { level: 2, text: "Use as paredes a seu favor. Às vezes você precisa empurrar caixas contra a parede para criar espaço.", icon: "🧱" },
          { level: 3, text: "Tente visualizar a sequência completa antes de começar. Qual caixa é mais fácil de posicionar primeiro?", icon: "🔍" }
        ]
      },
      2: { // Caatinga
        name: "Caatinga",
        hints: [
          { level: 1, text: "A Caatinga requer resiliência. Não desista - cada tentativa ensina algo novo!", icon: "🌵" },
          { level: 2, text: "Observe os alvos que estão mais isolados. Geralmente eles precisam ser preenchidos primeiro.", icon: "🎯" },
          { level: 3, text: "Movimente-se em círculos ao redor das caixas para encontrar o melhor ângulo de empurrar.", icon: "🔄" }
        ]
      },
      3: { // Mata Atlântica
        name: "Mata Atlântica",
        hints: [
          { level: 1, text: "Como a Mata Atlântica, este puzzle tem muitas camadas. Resolva uma de cada vez.", icon: "🦜" },
          { level: 2, text: "Pares de caixas próximas geralmente devem ser movidas juntas em sequência.", icon: "👥" },
          { level: 3, text: "Se você empacou, tente uma abordagem diferente: mova primeiro as caixas que parecem mais difíceis.", icon: "🔀" }
        ]
      },
      4: { // Pantanal
        name: "Pantanal",
        hints: [
          { level: 1, text: "No Pantanal, a água flui em ciclos. Seus movimentos também devem fluir - evite cantos sem saída.", icon: "🐊" },
          { level: 2, text: "Mantenha sempre uma 'via de fuga' livre. Nunca se prenda entre caixas e paredes.", icon: "🚪" },
          { level: 3, text: "Este desafio tem múltiplas áreas. Resolva cada seção antes de passar para a próxima.", icon: "🗺️" }
        ]
      },
      5: { // Pampa
        name: "Pampa",
        hints: [
          { level: 1, text: "Os campos do Pampa são abertos, mas não se deixe enganar - planejamento ainda é essencial.", icon: "🌱" },
          { level: 2, text: "Use o espaço extra para reorganizar as caixas. Nem sempre o caminho mais curto é o melhor.", icon: "🛤️" },
          { level: 3, text: "Desenhe ou escreva sua estratégia antes de executar. Visualizar ajuda a evitar erros.", icon: "✏️" }
        ]
      },
      6: { // Litoral
        name: "Litoral do Nordeste",
        hints: [
          { level: 1, text: "Como as ondas do mar, mantenha um ritmo constante. Pressa pode levar a erros.", icon: "🌊" },
          { level: 2, text: "Este é um desafio de coordenação. Foque em uma caixa por vez até dominá-la.", icon: "🎯" },
          { level: 3, text: "Observe o padrão vertical. Às vezes, mover de cima para baixo é melhor que da esquerda para direita.", icon: "⬇️" }
        ]
      }
    };
  }

  /**
   * Obtém dicas gerais que se aplicam a qualquer estágio
   */
  static generalHints_() {
    return [
      { text: "Lembre-se: você só pode EMPURRAR caixas, não puxá-las. Posicione-se do lado oposto ao destino.", icon: "⚠️" },
      { text: "Caixas não podem ser empurradas sobre outras caixas ou paredes. Planeje rotas livres.", icon: "🚫" },
      { text: "Use o botão de reiniciar quando necessário - não há penalidade, é parte do aprendizado!", icon: "🔄" },
      { text: "Reflita sobre o bioma enquanto joga. Como suas ações conectam com a preservação ambiental?", icon: "🌍" },
      { text: "Os melhores jogadores planejam antes de mover. Use papel e caneta se ajudar!", icon: "📝" }
    ];
  }

  /**
   * Obtém uma dica para o jogador baseada no estágio e nível de dificuldade
   */
  static getHint(userId, stageId, hintLevel) {
    const stage = stageId === undefined || stageId === null || stageId === '' ? NaN : Number(stageId);
    const stageHints = Service_Hints.hintDatabase_()[stage];
    if (!Number.isInteger(stage) || !stageHints) {
      return { success: false, message: 'Estágio não encontrado.', hintsRemaining: Logic_Rewards.getPlayerInventory(userId).hints || 0 };
    }
    const requestedLevel = hintLevel === undefined || hintLevel === null || hintLevel === ''
      ? 1
      : Number(hintLevel);
    if (!Number.isInteger(requestedLevel) || requestedLevel < 1 || requestedLevel > 3) {
      return { success: false, message: 'Nível de dica inválido.', hintsRemaining: Logic_Rewards.getPlayerInventory(userId).hints || 0 };
    }

    // Valida o estágio antes de consumir a dica.
    const result = Logic_Rewards.useHint(userId);
    if (!result.success) {
      return {
        success: false,
        message: result.message,
        hintsRemaining: 0
      };
    }

    // Retorna dica específica do estágio
    const level = requestedLevel;
    const hint = stageHints.hints[level - 1];
    
    Middleware_Logger.log('Dica fornecida', {
      userId: userId,
      stageId: stage,
      hintLevel: level,
      hintsRemaining: result.hintsRemaining
    });
    
    return {
      success: true,
      hint: hint,
      stageName: stageHints.name,
      hintLevel: level,
      stageId: stage,
      hintsRemaining: result.hintsRemaining,
      type: 'stage-specific',
      maxHintLevel: stageHints.hints.length
    };
  }

  /**
   * Obtém todas as dicas disponíveis para um estágio (apenas para admins ou após completar)
   */
  static getAllHintsForStage(stageId) {
    const stage = stageId === undefined || stageId === null || stageId === '' ? NaN : Number(stageId);
    const stageHints = Service_Hints.hintDatabase_()[stage];

    if (!Number.isInteger(stage) || !stageHints) {
      return {
        success: false,
        message: 'Estágio não encontrado'
      };
    }
    
    return {
      success: true,
      stageId: stage,
      stageName: stageHints.name,
      hints: stageHints.hints,
      generalHints: Service_Hints.generalHints_()
    };
  }

  /**
   * Obtém informações sobre dicas disponíveis para o usuário
   */
  static getHintStatus(userId) {
    const inventory = Logic_Rewards.getPlayerInventory(userId);
    
    return {
      hintsAvailable: inventory.hints || 0,
      canEarnMore: true,
      earnMethods: [
        'Complete desafios para ganhar pontos e trocar por dicas',
        'Conquistas especiais concedem dicas extras',
        'Demonstre reflexão profunda sobre os biomas'
      ]
    };
  }

  /**
   * Sistema de troca de pontos por dicas
   */
  static purchaseHints(userId, quantity) {
    const cost = 25; // 25 pontos por dica
    quantity = Number(quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
      return { success: false, message: 'Quantidade de dicas inválida.' };
    }
    const totalCost = cost * quantity;
    
    const inventory = Logic_Rewards.getPlayerInventory(userId);
    
    if (inventory.totalPoints < totalCost) {
      return {
        success: false,
        message: 'Pontos insuficientes',
        required: totalCost,
        available: inventory.totalPoints
      };
    }
    
    // Deduz pontos e adiciona dicas
    inventory.totalPoints -= totalCost;
    inventory.hints = (inventory.hints || 0) + quantity;
    
    DB_Users.update(userId, { inventory: JSON.stringify(inventory) });
    
    Middleware_Logger.log('Dicas compradas', {
      userId: userId,
      quantity: quantity,
      cost: totalCost,
      newBalance: inventory.totalPoints,
      newHints: inventory.hints
    });
    
    return {
      success: true,
      message: quantity + ' dica(s) adquirida(s) com sucesso',
      hintsAdded: quantity,
      pointsSpent: totalCost,
      newBalance: inventory.totalPoints,
      totalHints: inventory.hints
    };
  }

  /**
   * Fornece dica contextual baseada no número de reinicializações
   */
  static getAdaptiveHint(userId, stageId, restartCount) {
    const restarts = restartCount === undefined || restartCount === null || restartCount === ''
      ? 0
      : Number(restartCount);
    if (!Number.isInteger(restarts) || restarts < 0 || restarts > 100000) {
      return { freeHintAvailable: false, restartCount: 0, message: 'Quantidade de reinícios inválida.' };
    }
    
    // Após 3 reinicializações, oferece dica grátis
    if (restarts >= 3 && restarts % 3 === 0) {
      const level = Math.min(Math.floor(restarts / 3), 3);
      const stage = Number(stageId);
      const stageHints = Service_Hints.hintDatabase_()[stage];
      if (!stageHints) {
        return { freeHintAvailable: false, restartCount: restarts, message: 'Estágio não encontrado.' };
      }
      return {
        freeHintAvailable: true,
        message: 'Você tentou várias vezes! Aqui está uma dica gratuita para ajudar.',
        hint: {
          success: true,
          hint: stageHints.hints[level - 1],
          stageName: stageHints.name,
          hintLevel: level,
          stageId: stage,
          type: 'stage-specific',
          maxHintLevel: stageHints.hints.length
        },
        encouragement: 'Persistência é uma virtude! Continue tentando.'
      };
    }
    
    return {
      freeHintAvailable: false,
      restartCount: restarts,
      nextFreeHintAt: Math.ceil((restarts + 1) / 3) * 3
    };
  }
}
