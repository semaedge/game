class Logic_Rewards {
  static definitions_() {
    return {
      // Conquistas básicas
      first_win: { label: 'Primeira Vitória', description: 'Complete seu primeiro desafio', icon: '🏆', points: 10 },
      efficient_route: { label: 'Rota Eficiente', description: 'Complete um desafio com menos de 35 movimentos', icon: '⚡', points: 25 },
      biome_explorer: { label: 'Explorador de Biomas', description: 'Complete todos os biomas brasileiros', icon: '🌎', points: 100 },
      
      // Conquistas de maestria
      perfect_amazon: { label: 'Guardião da Amazônia', description: 'Complete a Floresta Amazônica com o menor número de movimentos', icon: '🌳', points: 50 },
      cerrado_master: { label: 'Mestre do Cerrado', description: 'Complete o Cerrado sem reiniciar', icon: '🌾', points: 40 },
      caatinga_survivor: { label: 'Sobrevivente da Caatinga', description: 'Complete a Caatinga em menos de 50 movimentos', icon: '🌵', points: 40 },
      atlantic_protector: { label: 'Protetor da Mata Atlântica', description: 'Complete a Mata Atlântica sem erros', icon: '🦜', points: 50 },
      pantanal_navigator: { label: 'Navegador do Pantanal', description: 'Complete o Pantanal com rota eficiente', icon: '🐊', points: 45 },
      pampa_ranger: { label: 'Guardião do Pampa', description: 'Complete o Pampa demonstrando conhecimento ambiental', icon: '🌱', points: 40 },
      
      // Conquistas de dedicação
      persistent_learner: { label: 'Aprendiz Persistente', description: 'Reinicie um desafio mais de 10 vezes antes de completar', icon: '💪', points: 30 },
      speed_runner: { label: 'Corredor Veloz', description: 'Complete qualquer desafio em menos de 2 minutos', icon: '⏱️', points: 35 },
      reflection_master: { label: 'Mestre da Reflexão', description: 'Forneça reflexões detalhadas em 5 desafios diferentes', icon: '📝', points: 50 },
      eco_warrior: { label: 'Guerreiro Ecológico', description: 'Alcance 500 pontos totais', icon: '🛡️', points: 75 }
    };
  }

  static getOptimalMoves_(stageId) {
    const optimalMap = {
      0: 28,  // Amazônia
      1: 32,  // Cerrado
      2: 35,  // Caatinga
      3: 30,  // Mata Atlântica
      4: 38,  // Pantanal
      5: 40,  // Pampa
      6: 25   // Litoral
    };
    return optimalMap[stageId] || 35;
  }

  static grantAchievement(userId, achievementId) {
    const definition = Logic_Rewards.definitions_()[achievementId];
    if (!definition) throw new Error('Conquista desconhecida: ' + achievementId);
    
    const granted = DB_Achievements.grant(userId, achievementId, definition.label);
    if (granted) {
      Middleware_Logger.log('Conquista ' + achievementId + ' concedida ao usuário ' + userId + '.', {
        achievement: achievementId,
        points: definition.points
      });
      
      // Adiciona pontos ao inventário do usuário
      Logic_Rewards.addInventoryPoints(userId, definition.points);
    }
    return granted;
  }

  static evaluateAfterScore(userId, stage, moves, restartCount, reflection, durationSeconds) {
    const unlocked = [];
    const stageNum = Number(stage);
    const moveCount = Number(moves);
    const restarts = Number(restartCount || 0);
    const duration = durationSeconds === null || durationSeconds === undefined ? null : Number(durationSeconds);
    
    // Primeira vitória
    const userScores = DB_Scores.getScoresByUserId(userId);
    if (userScores.length === 1 && Logic_Rewards.grantAchievement(userId, 'first_win')) {
      unlocked.push(Logic_Rewards.definitions_().first_win.label);
    }
    
    // Rota eficiente geral
    if (moveCount <= 35 && Logic_Rewards.grantAchievement(userId, 'efficient_route')) {
      unlocked.push(Logic_Rewards.definitions_().efficient_route.label);
    }
    
    // Conquistas específicas por bioma
    const optimalMoves = Logic_Rewards.getOptimalMoves_(stageNum);
    
    if (stageNum === 0 && moveCount <= optimalMoves && 
        Logic_Rewards.grantAchievement(userId, 'perfect_amazon')) {
      unlocked.push(Logic_Rewards.definitions_().perfect_amazon.label);
    }
    
    if (stageNum === 1 && restarts === 0 && 
        Logic_Rewards.grantAchievement(userId, 'cerrado_master')) {
      unlocked.push(Logic_Rewards.definitions_().cerrado_master.label);
    }
    
    if (stageNum === 2 && moveCount <= 50 && 
        Logic_Rewards.grantAchievement(userId, 'caatinga_survivor')) {
      unlocked.push(Logic_Rewards.definitions_().caatinga_survivor.label);
    }
    
    if (stageNum === 3 && moveCount <= optimalMoves && 
        Logic_Rewards.grantAchievement(userId, 'atlantic_protector')) {
      unlocked.push(Logic_Rewards.definitions_().atlantic_protector.label);
    }
    
    if (stageNum === 4 && moveCount <= optimalMoves + 5 && 
        Logic_Rewards.grantAchievement(userId, 'pantanal_navigator')) {
      unlocked.push(Logic_Rewards.definitions_().pantanal_navigator.label);
    }
    
    if (stageNum === 5 && reflection && reflection.length > 100 && 
        Logic_Rewards.grantAchievement(userId, 'pampa_ranger')) {
      unlocked.push(Logic_Rewards.definitions_().pampa_ranger.label);
    }

    if (duration !== null && duration >= 0 && duration < 120 && Logic_Rewards.grantAchievement(userId, 'speed_runner')) {
      unlocked.push(Logic_Rewards.definitions_().speed_runner.label);
    }
    
    // Aprendiz persistente
    if (restarts >= 10 && Logic_Rewards.grantAchievement(userId, 'persistent_learner')) {
      unlocked.push(Logic_Rewards.definitions_().persistent_learner.label);
    }
    
    // Mestre da reflexão
    const reflectiveScores = userScores.filter(function(s) {
      return s.reflection && s.reflection.length > 100;
    });
    if (reflectiveScores.length >= 5 && 
        Logic_Rewards.grantAchievement(userId, 'reflection_master')) {
      unlocked.push(Logic_Rewards.definitions_().reflection_master.label);
    }

    // Explorador de biomas (todos os biomas principais)
    const completedStages = Array.from(new Set(
      userScores.map(function(score) { return Number(score.stage); })
    ));
    const mainBiomes = [0, 1, 2, 3, 4, 5]; // Excluindo litoral (6)
    const completedAllMainBiomes = mainBiomes.every(function(biome) {
      return completedStages.indexOf(biome) !== -1;
    });
    
    if (completedAllMainBiomes && Logic_Rewards.grantAchievement(userId, 'biome_explorer')) {
      unlocked.push(Logic_Rewards.definitions_().biome_explorer.label);
    }
    
    // Guerreiro ecológico (pontos totais)
    const totalPoints = Logic_Rewards.getPlayerInventory(userId).totalPoints;
    if (totalPoints >= 500 && Logic_Rewards.grantAchievement(userId, 'eco_warrior')) {
      unlocked.push(Logic_Rewards.definitions_().eco_warrior.label);
    }
    
    return unlocked;
  }

  static getPlayerAchievements(userId) {
    const items = DB_Achievements.getByUserId(userId);
    const definitions = Logic_Rewards.definitions_();
    
    return {
      userId: userId,
      totalAchievements: items.length,
      possibleAchievements: Object.keys(definitions).length,
      achievements: items.map(function(item) {
        const def = definitions[item.achievementId];
        return {
          id: item.achievementId,
          label: item.label,
          icon: def ? def.icon : '🏅',
          points: def ? def.points : 0,
          unlockedAt: item.unlockedAt
        };
      })
    };
  }

  // ===== Sistema de Inventário =====
  
  static getPlayerInventory(userId) {
    const data = DB_Users.findById(userId);
    if (!data) throw new Error('Usuário não encontrado');
    
    const inventory = data.inventory ? JSON.parse(data.inventory) : {
      totalPoints: 0,
      items: [],
      badges: [],
      hints: 3
    };
    
    return inventory;
  }
  
  static addInventoryPoints(userId, points) {
    const inventory = Logic_Rewards.getPlayerInventory(userId);
    inventory.totalPoints = (inventory.totalPoints || 0) + points;
    
    DB_Users.update(userId, { inventory: JSON.stringify(inventory) });
    Middleware_Logger.log('Pontos adicionados ao inventário', {
      userId: userId,
      points: points,
      newTotal: inventory.totalPoints
    });
    
    return inventory;
  }
  
  static unlockItem(userId, itemId, itemData) {
    const inventory = Logic_Rewards.getPlayerInventory(userId);
    
    if (!inventory.items) inventory.items = [];
    
    // Verifica se já possui o item
    const hasItem = inventory.items.some(function(item) {
      return item.id === itemId;
    });
    
    if (hasItem) {
      return { success: false, message: 'Item já desbloqueado' };
    }
    
    inventory.items.push({
      id: itemId,
      name: itemData.name || itemId,
      type: itemData.type || 'collectible',
      unlockedAt: new Date().toISOString()
    });
    
    DB_Users.update(userId, { inventory: JSON.stringify(inventory) });
    
    Middleware_Logger.log('Item desbloqueado', {
      userId: userId,
      itemId: itemId
    });
    
    return { success: true, message: 'Item desbloqueado com sucesso', item: itemData };
  }
  
  static addBadge(userId, badgeId, badgeLabel) {
    const inventory = Logic_Rewards.getPlayerInventory(userId);
    
    if (!inventory.badges) inventory.badges = [];
    
    const hasBadge = inventory.badges.some(function(badge) {
      return badge.id === badgeId;
    });
    
    if (!hasBadge) {
      inventory.badges.push({
        id: badgeId,
        label: badgeLabel,
        earnedAt: new Date().toISOString()
      });
      
      DB_Users.update(userId, { inventory: JSON.stringify(inventory) });
    }
    
    return inventory;
  }
  
  static useHint(userId) {
    const inventory = Logic_Rewards.getPlayerInventory(userId);
    
    if (!inventory.hints || inventory.hints <= 0) {
      return { success: false, message: 'Sem dicas disponíveis' };
    }
    
    inventory.hints = inventory.hints - 1;
    DB_Users.update(userId, { inventory: JSON.stringify(inventory) });
    
    return { success: true, hintsRemaining: inventory.hints };
  }
  
  static addHints(userId, count) {
    const inventory = Logic_Rewards.getPlayerInventory(userId);
    inventory.hints = (inventory.hints || 0) + count;
    
    DB_Users.update(userId, { inventory: JSON.stringify(inventory) });
    return inventory;
  }
}
