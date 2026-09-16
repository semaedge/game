// DB_Scores.gs
//
// Funcionalidade Principal: Gerencia as operações CRUD para os scores dos jogadores no Google Sheet.
//
// Integrações:
// - DB_Core.gs: Utiliza as funções genéricas de CRUD da camada de banco de dados.
// - Config.gs: Obtém o nome da aba de scores (SCORES_SHEET_NAME).
//
// Uso:
// Fornece métodos para registrar, ler e atualizar scores de usuários para diferentes fases do jogo.
//
class DB_Scores {
  static addScore(userId, stage, score, evidence) {
    const newId = Utilities.getUuid();
    evidence = evidence || {};
    const rowData = [
      newId, userId, stage, score, new Date().toISOString(),
      evidence.plan || '', evidence.reflection || '',
      JSON.stringify(evidence.route || []), Number(evidence.restarts || 0), Number(evidence.durationSeconds || 0)
    ];
    DB_Core.appendRow(SCORES_SHEET_NAME, rowData);
    return { id: newId, userId, stage: Number(stage), score: Number(score), createdAt: rowData[4], evidenceComplete: Boolean(evidence.plan && evidence.reflection) };
  }

  static getScoreById(scoreId) {
    if (!scoreId) return null;
    const result = DB_Core.findRow(SCORES_SHEET_NAME, 0, scoreId);
    if (!result || !result.rowData) return null;
    const row = result.rowData;
    let teacherReview = null;
    if (row[11]) {
      try {
        teacherReview = typeof row[11] === 'object' ? row[11] : JSON.parse(row[11]);
      } catch (e) {
        teacherReview = null;
      }
    }
    let strategyFeedback = null;
    if (row[12]) {
      try {
        strategyFeedback = typeof row[12] === 'object' ? row[12] : JSON.parse(row[12]);
      } catch (e) {
        strategyFeedback = null;
      }
    }
    return {
      id: row[0],
      userId: row[1],
      stage: Number(row[2]),
      score: Number(row[3]),
      createdAt: row[4],
      plan: row[5] || '',
      reflection: row[6] || '',
      route: row[7] || '[]',
      restarts: Number(row[8] || 0),
      durationSeconds: Number(row[9] || 0),
      explanation: row[10] || '',
      teacherReview: teacherReview,
      strategyFeedback: strategyFeedback
    };
  }

  static getScoresByUserId(userId) {
    const data = DB_Core.getAllData(SCORES_SHEET_NAME);
    const userScores = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === userId) { // Coluna 1 para userId
        userScores.push({
          id: data[i][0],
          userId: data[i][1],
          stage: Number(data[i][2]),
          score: Number(data[i][3]),
          createdAt: data[i][4],
          plan: data[i][5] || '',
          reflection: data[i][6] || '',
          route: data[i][7] || '[]',
          restarts: Number(data[i][8] || 0),
          durationSeconds: Number(data[i][9] || 0)
        });
      }
    }
    return userScores.sort(function(a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  static getTopScores(stage = null) {
    const data = DB_Core.getAllData(SCORES_SHEET_NAME);
    let scores = [];
    for (let i = 1; i < data.length; i++) {
      scores.push({
        id: data[i][0],
        userId: data[i][1],
        stage: Number(data[i][2]),
        score: Number(data[i][3]),
        createdAt: data[i][4],
      });
    }

    if (stage !== null) {
      scores = scores.filter(s => s.stage == stage);
    }

    // Ordenar por score (menor é melhor para jogos de quebra-cabeça, por exemplo) e depois por data
    scores.sort((a, b) => {
      if (Number(a.score) !== Number(b.score)) {
        return a.score - b.score;
      } else {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
    });

    return scores;
  }

  static updateScore(scoreId, newScore) {
    const result = DB_Core.findRow(SCORES_SHEET_NAME, 0, scoreId); // Coluna 0 para ID
    if (result) {
      const rowData = result.rowData;
      rowData[3] = newScore; // Atualiza a coluna do score
      DB_Core.updateRow(SCORES_SHEET_NAME, result.rowIndex, rowData);
      return true;
    }
    return false;
  }

  static updateStudentExplanation(scoreId, explanation) {
    if (!scoreId) return false;
    const result = DB_Core.findRow(SCORES_SHEET_NAME, 0, scoreId);
    if (!result || !result.rowData) return false;
    const rowData = result.rowData;
    rowData[10] = String(explanation || '').trim().slice(0, 500);
    DB_Core.updateRow(SCORES_SHEET_NAME, result.rowIndex, rowData);
    return true;
  }

  static updateTeacherReview(scoreId, reviewData) {
    if (!scoreId) return false;
    const result = DB_Core.findRow(SCORES_SHEET_NAME, 0, scoreId);
    if (!result || !result.rowData) return false;
    const rowData = result.rowData;
    rowData[11] = JSON.stringify(reviewData || {});
    DB_Core.updateRow(SCORES_SHEET_NAME, result.rowIndex, rowData);
    return true;
  }

  static updateStrategyFeedback(scoreId, feedbackData) {
    if (!scoreId) return false;
    const result = DB_Core.findRow(SCORES_SHEET_NAME, 0, scoreId);
    if (!result || !result.rowData) return false;
    const rowData = result.rowData;
    rowData[12] = JSON.stringify(feedbackData || {});
    DB_Core.updateRow(SCORES_SHEET_NAME, result.rowIndex, rowData);
    return true;
  }
  
  static getAllScores_() {
    const data = DB_Core.getAllData(SCORES_SHEET_NAME);
    const scores = [];
    for (let i = 1; i < data.length; i++) {
      scores.push({
        id: data[i][0],
        userId: data[i][1],
        stage: Number(data[i][2]),
        score: Number(data[i][3]),
        createdAt: data[i][4],
        plan: data[i][5] || '',
        reflection: data[i][6] || '',
        route: data[i][7] || '[]',
        restarts: Number(data[i][8] || 0),
        durationSeconds: Number(data[i][9] || 0)
      });
    }
    return scores;
  }
  
  static getScoresByStage(stageId) {
    const data = DB_Core.getAllData(SCORES_SHEET_NAME);
    const scores = [];
    for (let i = 1; i < data.length; i++) {
      if (Number(data[i][2]) === Number(stageId)) {
        scores.push({
          id: data[i][0],
          userId: data[i][1],
          stage: Number(data[i][2]),
          score: Number(data[i][3]),
          createdAt: data[i][4],
          plan: data[i][5] || '',
          reflection: data[i][6] || '',
          route: data[i][7] || '[]',
          restarts: Number(data[i][8] || 0),
          durationSeconds: Number(data[i][9] || 0)
        });
      }
    }
    return scores;
  }
}
