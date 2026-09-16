// Report_Generator.gs
//
// Funcionalidade Principal: Relatórios operacionais sobre usuários e partidas.
//
// Integrações:
// - Export_CSV.gs: serialização (este módulo não monta CSV por conta própria).
// - Email_Service.gs: envio do resumo periódico.
// - Utils_String.gs / Utils_Date.gs: escape e formatação.
//
// Notas de correção nesta revisão:
// - O CSV era concatenado à mão com template strings, sem escape nenhum. Um
//   nome de usuário com vírgula deslocava todas as colunas seguintes e um com
//   aspas corrompia a linha. Agora a serialização é delegada ao Export_CSV,
//   que também neutraliza injeção de fórmula.
// - O resumo por e-mail interpolava dados de usuário direto no HTML. Um nome
//   contendo markup era renderizado como markup no cliente de e-mail do
//   administrador. Os valores passam por escape e os dados completos vão como
//   anexo, não embutidos no corpo.
// - A coluna era rotulada "LastLogin" mas continha updatedAt, que muda em
//   qualquer edição de perfil. O rótulo agora diz o que o dado é.
//
const REPORT_MAX_SCORES = 500;

class Report_Generator {
  static userColumns_() {
    return [
      { key: 'id', label: 'ID' },
      { key: 'username', label: 'Username' },
      { key: 'email', label: 'Email' },
      { key: 'createdAt', label: 'CriadoEm', format: Utils_Date.formatTimestamp },
      { key: 'updatedAt', label: 'AtualizadoEm', format: Utils_Date.formatTimestamp }
    ];
  }

  static scoreColumns_() {
    return [
      { key: 'id', label: 'ID' },
      { key: 'userId', label: 'UsuarioID' },
      { key: 'stage', label: 'Fase' },
      { key: 'score', label: 'Pontuacao' },
      { key: 'createdAt', label: 'RegistradoEm', format: Utils_Date.formatTimestamp }
    ];
  }
  
  static achievementColumns_() {
    return [
      { key: 'userId', label: 'UsuarioID' },
      { key: 'achievementId', label: 'ConquistaID' },
      { key: 'label', label: 'Nome' },
      { key: 'unlockedAt', label: 'DesbloqueadoEm', format: Utils_Date.formatTimestamp }
    ];
  }

  /**
   * Atividade de usuários. As colunas são declaradas explicitamente para que
   * a exportação nunca carregue campos sensíveis do registro.
   */
  static generateUserActivityReport() {
    try {
      const users = DB_Users.getAllUsers();
      return Export_CSV.exportRecords(
        users,
        Report_Generator.userColumns_(),
        'relatorio-atividade-usuarios'
      );
    } catch (error) {
      Middleware_Logger.error('Erro ao gerar relatório de usuários: ' + error.message);
      return { success: false, code: 'REPORT_FAILED', message: 'Erro ao gerar o relatório de usuários.' };
    }
  }

  static generateGameScoresReport(stage) {
    try {
      const normalizedStage = stage === undefined || stage === null || stage === ''
        ? null
        : Number(stage);
      const scores = DB_Scores.getTopScores(normalizedStage).slice(0, REPORT_MAX_SCORES);
      const suffix = normalizedStage === null ? 'geral' : 'fase-' + normalizedStage;

      return Export_CSV.exportRecords(
        scores,
        Report_Generator.scoreColumns_(),
        'relatorio-pontuacoes-' + suffix
      );
    } catch (error) {
      Middleware_Logger.error('Erro ao gerar relatório de pontuações: ' + error.message);
      return { success: false, code: 'REPORT_FAILED', message: 'Erro ao gerar o relatório de pontuações.' };
    }
  }
  
  /**
   * Relatório de conquistas desbloqueadas
   */
  static generateAchievementsReport() {
    try {
      const achievements = DB_Achievements.getAllAchievements_();
      return Export_CSV.exportRecords(
        achievements,
        Report_Generator.achievementColumns_(),
        'relatorio-conquistas'
      );
    } catch (error) {
      Middleware_Logger.error('Erro ao gerar relatório de conquistas: ' + error.message);
      return { success: false, code: 'REPORT_FAILED', message: 'Erro ao gerar o relatório de conquistas.' };
    }
  }
  
  /**
   * Relatório de progresso por bioma
   */
  static generateBiomeProgressReport() {
    try {
      const allScores = DB_Scores.getAllScores_();
      const biomeStats = {};
      
      // Agrupa por bioma
      allScores.forEach(function(score) {
        const stage = Number(score.stage);
        if (!biomeStats[stage]) {
          const mapDef = Helper_Maps.getMapDefinition(stage);
          biomeStats[stage] = {
            stageId: stage,
            biomeName: mapDef ? mapDef.name : 'Estágio ' + stage,
            completions: 0,
            totalMoves: 0,
            avgMoves: 0,
            uniquePlayers: []
          };
        }
        
        biomeStats[stage].completions++;
        biomeStats[stage].totalMoves += Number(score.score || 0);
        
        if (biomeStats[stage].uniquePlayers.indexOf(score.userId) === -1) {
          biomeStats[stage].uniquePlayers.push(score.userId);
        }
      });
      
      // Calcula médias
      const report = Object.keys(biomeStats).map(function(stageId) {
        const stats = biomeStats[stageId];
        stats.avgMoves = stats.completions > 0 
          ? (stats.totalMoves / stats.completions).toFixed(2)
          : 0;
        stats.uniquePlayersCount = stats.uniquePlayers.length;
        delete stats.uniquePlayers; // Remove array para CSV
        return stats;
      });
      
      return Export_CSV.exportRecords(
        report,
        [
          { key: 'stageId', label: 'FaseID' },
          { key: 'biomeName', label: 'Bioma' },
          { key: 'completions', label: 'Conclusoes' },
          { key: 'uniquePlayersCount', label: 'JogadoresUnicos' },
          { key: 'avgMoves', label: 'MediaMovimentos' }
        ],
        'relatorio-progresso-biomas'
      );
    } catch (error) {
      Middleware_Logger.error('Erro ao gerar relatório de biomas: ' + error.message);
      return { success: false, code: 'REPORT_FAILED', message: 'Erro ao gerar o relatório de biomas.' };
    }
  }
  
  /**
   * Relatório de engajamento dos jogadores
   */
  static generatePlayerEngagementReport() {
    try {
      const users = DB_Users.getAllUsers();
      const engagement = [];
      
      users.forEach(function(user) {
        const scores = DB_Scores.getScoresByUserId(user.id);
        const progress = DB_Progress.getByUserId(user.id);
        const achievements = DB_Achievements.getByUserId(user.id);
        const inventory = Logic_Rewards.getPlayerInventory(user.id);
        
        engagement.push({
          userId: user.id,
          username: user.username,
          totalCompletions: scores.length,
          stagesUnlocked: progress && Array.isArray(progress.unlockedStages) ? progress.unlockedStages.length : 0,
          achievementsEarned: achievements.length,
          totalPoints: inventory.totalPoints || 0,
          hintsRemaining: inventory.hints || 0,
          lastActivity: scores.length > 0 
            ? scores[scores.length - 1].createdAt 
            : user.createdAt
        });
      });
      
      // Ordena por total de completions (mais engajados primeiro)
      engagement.sort(function(a, b) {
        return b.totalCompletions - a.totalCompletions;
      });
      
      return Export_CSV.exportRecords(
        engagement,
        [
          { key: 'userId', label: 'UsuarioID' },
          { key: 'username', label: 'Username' },
          { key: 'totalCompletions', label: 'TotalConclusoes' },
          { key: 'stagesUnlocked', label: 'FasesDesbloqueadas' },
          { key: 'achievementsEarned', label: 'Conquistas' },
          { key: 'totalPoints', label: 'Pontos' },
          { key: 'hintsRemaining', label: 'DicasRestantes' },
          { key: 'lastActivity', label: 'UltimaAtividade', format: Utils_Date.formatTimestamp }
        ],
        'relatorio-engajamento-jogadores'
      );
    } catch (error) {
      Middleware_Logger.error('Erro ao gerar relatório de engajamento: ' + error.message);
      return { success: false, code: 'REPORT_FAILED', message: 'Erro ao gerar o relatório de engajamento.' };
    }
  }
  
  /**
   * Relatório de evidências de aprendizagem
   */
  static generateLearningEvidenceReport(stageId) {
    try {
      const allScores = stageId !== undefined 
        ? DB_Scores.getScoresByStage(stageId)
        : DB_Scores.getAllScores_();
      
      const evidenceData = allScores.filter(function(score) {
        return score.plan || score.reflection;
      }).map(function(score) {
        const user = DB_Users.getUserById(score.userId);
        return {
          username: user ? user.username : 'Desconhecido',
          stage: score.stage,
          moves: score.score,
          restarts: score.restarts || 0,
          hasPlan: Boolean(score.plan),
          planLength: score.plan ? score.plan.length : 0,
          hasReflection: Boolean(score.reflection),
          reflectionLength: score.reflection ? score.reflection.length : 0,
          completedAt: score.createdAt
        };
      });
      
      const suffix = stageId !== undefined ? 'fase-' + stageId : 'geral';
      
      return Export_CSV.exportRecords(
        evidenceData,
        [
          { key: 'username', label: 'Usuario' },
          { key: 'stage', label: 'Fase' },
          { key: 'moves', label: 'Movimentos' },
          { key: 'restarts', label: 'Reinicializacoes' },
          { key: 'hasPlan', label: 'TemPlanejamento' },
          { key: 'planLength', label: 'TamanhoPlan' },
          { key: 'hasReflection', label: 'TemReflexao' },
          { key: 'reflectionLength', label: 'TamanhoReflexao' },
          { key: 'completedAt', label: 'ConcluidoEm', format: Utils_Date.formatTimestamp }
        ],
        'relatorio-evidencias-aprendizagem-' + suffix
      );
    } catch (error) {
      Middleware_Logger.error('Erro ao gerar relatório de evidências: ' + error.message);
      return { success: false, code: 'REPORT_FAILED', message: 'Erro ao gerar o relatório de evidências.' };
    }
  }

  static summaryRow_(label, value) {
    return '<tr><th align="left">' + Utils_String.escapeHtml(label) + '</th>' +
      '<td>' + Utils_String.escapeHtml(value) + '</td></tr>';
  }

  /**
   * Resumo diário: números no corpo, dados completos em anexo.
   */
  static sendDailySummaryReport(recipient) {
    const target = Utils_String.normalizeEmail(recipient);
    if (!Utils_String.isValidEmail(target)) {
      return { success: false, code: 'INVALID_RECIPIENT', message: 'Destinatário inválido.' };
    }

    const users = Report_Generator.generateUserActivityReport();
    const scores = Report_Generator.generateGameScoresReport();
    const engagement = Report_Generator.generatePlayerEngagementReport();
    const achievements = Report_Generator.generateAchievementsReport();
    
    if (!users.success || !scores.success || !engagement.success) {
      return { success: false, code: 'REPORT_FAILED', message: 'Não foi possível montar o resumo diário.' };
    }

    const generatedAt = Utils_Date.formatTimestamp(new Date());
    const body = '<h1>' + Utils_String.escapeHtml(APP_NAME) + ' — resumo diário</h1>' +
      '<p>Gerado em ' + Utils_String.escapeHtml(generatedAt) + '.</p>' +
      '<table cellpadding="6" border="0">' +
      Report_Generator.summaryRow_('Usuários cadastrados', users.rows) +
      Report_Generator.summaryRow_('Pontuações registradas', scores.rows) +
      Report_Generator.summaryRow_('Conquistas desbloqueadas', achievements.rows) +
      Report_Generator.summaryRow_('Jogadores ativos', engagement.rows) +
      '</table>' +
      '<p>Os dados completos seguem nos arquivos anexos.</p>';

    const attachments = [
      Utilities.newBlob(users.data, 'text/csv', users.filename),
      Utilities.newBlob(scores.data, 'text/csv', scores.filename),
      Utilities.newBlob(engagement.data, 'text/csv', engagement.filename)
    ];
    
    if (achievements.success) {
      attachments.push(Utilities.newBlob(achievements.data, 'text/csv', achievements.filename));
    }

    return Email_Service.sendEmail(target, 'Resumo diário — ' + APP_NAME, body, true, {
      attachments: attachments
    });
  }
  
  /**
   * Dashboard de métricas consolidadas
   */
  static getDashboardMetrics() {
    try {
      const users = DB_Users.getAllUsers();
      const allScores = DB_Scores.getAllScores_();
      const allAchievements = DB_Achievements.getAllAchievements_();
      
      // Jogadores ativos (com pelo menos um score)
      const activePlayerIds = {};
      allScores.forEach(function(score) {
        activePlayerIds[score.userId] = true;
      });
      const activePlayers = Object.keys(activePlayerIds).length;
      
      // Completions por bioma
      const biomeCompletions = {};
      allScores.forEach(function(score) {
        biomeCompletions[score.stage] = (biomeCompletions[score.stage] || 0) + 1;
      });
      
      // Taxa de conclusão (jogadores que completaram pelo menos um bioma)
      const completionRate = users.length > 0 
        ? ((activePlayers / users.length) * 100).toFixed(2)
        : 0;
      
      return {
        success: true,
        data: {
          totalUsers: users.length,
          activePlayers: activePlayers,
          completionRate: completionRate + '%',
          totalScores: allScores.length,
          totalAchievements: allAchievements.length,
          biomeCompletions: biomeCompletions,
          avgScoresPerPlayer: activePlayers > 0 
            ? (allScores.length / activePlayers).toFixed(2)
            : 0
        }
      };
    } catch (error) {
      Middleware_Logger.error('Erro ao gerar métricas do dashboard: ' + error.message);
      return { success: false, message: 'Erro ao gerar métricas do dashboard.' };
    }
  }
}
