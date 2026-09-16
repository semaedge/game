function normalizeLearningEvidence_(evidence) {
  evidence = evidence && typeof evidence === 'object' && !Array.isArray(evidence) ? evidence : {};
  const plan = String(evidence.plan || '').trim().slice(0, 240);
  const reflection = String(evidence.reflection || '').trim().slice(0, 420);
  const route = Array.isArray(evidence.route) ? evidence.route.slice(0, 100000) : [];
  const allowedDirections = ['up', 'down', 'left', 'right'];
  if (plan.length < 8) throw new Error('Registre um plano antes de concluir.');
  if (reflection.length < 12) throw new Error('Registre uma revisão da estratégia antes de concluir.');
  if (!route.length || route.some(function(direction) { return allowedDirections.indexOf(direction) === -1; })) {
    throw new Error('A sequência da rota é inválida.');
  }
  const restarts = Number(evidence.restarts || 0);
  if (!Number.isInteger(restarts) || restarts < 0 || restarts > 1000) throw new Error('Quantidade de reinícios inválida.');
  const rawDuration = evidence.durationSeconds;
  const durationSeconds = rawDuration === undefined || rawDuration === null || rawDuration === ''
    ? null
    : Number(rawDuration);
  if (durationSeconds !== null && (!Number.isFinite(durationSeconds) || durationSeconds < 0 || durationSeconds > 86400)) {
    throw new Error('Duração da tentativa inválida.');
  }
  return {
    plan: plan,
    reflection: reflection,
    route: route,
    restarts: restarts,
    durationSeconds: durationSeconds === null ? null : Math.round(durationSeconds)
  };
}

/**
 * Reproduz a rota no mapa canônico. O cliente não decide se uma fase foi
 * concluída: somente o estado final calculado aqui autoriza score e progresso.
 */
function validateSolvedRoute_(mapDefinition, route) {
  if (!mapDefinition || !Array.isArray(mapDefinition.structure)) {
    throw new Error('Mapa canônico indisponível.');
  }
  const grid = mapDefinition.structure.map(function(row) { return String(row).split(''); });
  const crates = new Set();
  const targets = new Set();
  let player = null;
  const key = function(x, y) { return x + ',' + y; };
  const directions = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  grid.forEach(function(row, y) {
    row.forEach(function(cell, x) {
      if (cell === '@' || cell === '+') player = { x: x, y: y };
      if (cell === '$' || cell === '*') crates.add(key(x, y));
      if (cell === '.' || cell === '*' || cell === '+') targets.add(key(x, y));
      if (cell !== '#') grid[y][x] = ' ';
    });
  });
  if (!player || !targets.size) throw new Error('Mapa canônico inválido.');

  function isWall(x, y) {
    return !grid[y] || grid[y][x] === undefined || grid[y][x] === '#';
  }
  (route || []).forEach(function(direction) {
    const delta = directions[direction];
    if (!delta) throw new Error('A rota contém direção inválida.');
    const nx = player.x + delta[0];
    const ny = player.y + delta[1];
    if (isWall(nx, ny)) throw new Error('A rota atravessa uma parede.');
    const nextKey = key(nx, ny);
    if (crates.has(nextKey)) {
      const bx = nx + delta[0];
      const by = ny + delta[1];
      const beyondKey = key(bx, by);
      if (isWall(bx, by) || crates.has(beyondKey)) {
        throw new Error('A rota contém um empurrão impossível.');
      }
      crates.delete(nextKey);
      crates.add(beyondKey);
    }
    player = { x: nx, y: ny };
  });

  let solved = true;
  targets.forEach(function(target) { if (!crates.has(target)) solved = false; });
  if (!solved) throw new Error('A rota enviada não resolve o mapa.');
  return { solved: true, moves: route.length, targets: targets.size };
}

function saveGameScore(stage, moves, evidence) {
  const user = Auth_Session.getSessionUser();
  if (!user) {
    return { success: false, code: 'UNAUTHENTICATED', message: 'Usuário não autenticado.' };
  }

  const normalizedStage = Number(stage);
  const normalizedMoves = Number(moves);
  if (!Number.isInteger(normalizedStage) || !Helper_Maps.getMapDefinition(normalizedStage)) {
    return { success: false, code: 'INVALID_STAGE', message: 'Estágio inválido.' };
  }
  if (!Number.isInteger(normalizedMoves) || normalizedMoves <= 0 || normalizedMoves > 100000) {
    return { success: false, code: 'INVALID_SCORE', message: 'Número de movimentos inválido.' };
  }
  if (!Logic_GameProgress.isStageUnlocked(user.id, normalizedStage)) {
    return { success: false, code: 'STAGE_LOCKED', message: 'Este estágio ainda está bloqueado.' };
  }

  let learningEvidence;
  try {
    learningEvidence = normalizeLearningEvidence_(evidence);
  } catch (error) {
    return { success: false, code: 'INCOMPLETE_EVIDENCE', message: error.message };
  }
  if (learningEvidence.route.length !== normalizedMoves) {
    return { success: false, code: 'ROUTE_MISMATCH', message: 'A rota registrada não corresponde aos movimentos realizados.' };
  }
  try {
    validateSolvedRoute_(Helper_Maps.getMapDefinition(normalizedStage), learningEvidence.route);
  } catch (error) {
    return { success: false, code: 'UNSOLVED_ROUTE', message: error.message };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const savedScore = DB_Scores.addScore(user.id, normalizedStage, normalizedMoves, learningEvidence);
    const progress = Logic_GameProgress.completeStage(user.id, normalizedStage);
    const newAchievements = Logic_Rewards.evaluateAfterScore(
      user.id,
      normalizedStage,
      normalizedMoves,
      learningEvidence.restarts,
      learningEvidence.reflection,
      learningEvidence.durationSeconds
    );
    Audit_Trail.logAction('GAME_STAGE_COMPLETED', {
      stage: normalizedStage,
      moves: normalizedMoves,
      evidenceComplete: true,
      restarts: learningEvidence.restarts,
      achievements: newAchievements
    });
    Analytics_Service.trackEvent(
      'game',
      'stage_completed',
      'stage_' + normalizedStage,
      normalizedMoves,
      { newAchievements: newAchievements.length, evidenceComplete: true, restarts: learningEvidence.restarts }
    );
    return {
      success: true,
      message: 'Resultado salvo com sucesso.',
      data: {
        score: savedScore,
        progress: progress,
        newAchievements: newAchievements
      }
    };
  } catch (error) {
    Middleware_Logger.error('Erro ao salvar resultado: ' + error.message);
    return { success: false, code: 'SAVE_FAILED', message: 'Não foi possível salvar o resultado.' };
  } finally {
    lock.releaseLock();
  }
}

function getLeaderboard(stage) {
  try {
    const normalizedStage = stage === null || stage === undefined || stage === ''
      ? null
      : Number(stage);
    if (normalizedStage !== null &&
        (!Number.isInteger(normalizedStage) || !Helper_Maps.getMapDefinition(normalizedStage))) {
      return { success: false, code: 'INVALID_STAGE', message: 'Filtro de estágio inválido.' };
    }

    const rawScores = DB_Scores.getTopScores(normalizedStage);
    const bestByUserAndStage = {};
    rawScores.forEach(function(score) {
      const key = score.userId + ':' + score.stage;
      if (!bestByUserAndStage[key] || score.score < bestByUserAndStage[key].score) {
        bestByUserAndStage[key] = score;
      }
    });
    const leaderboard = Object.keys(bestByUserAndStage)
      .map(function(key) {
        const score = bestByUserAndStage[key];
        const player = DB_Users.getUserById(score.userId);
        return {
          userId: score.userId,
          username: player ? player.username : 'Explorador',
          stage: Number(score.stage),
          score: Number(score.score),
          createdAt: score.createdAt
        };
      })
      .sort(function(a, b) {
        return a.score - b.score ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })
      .slice(0, 100);
    return { success: true, data: leaderboard };
  } catch (error) {
    Middleware_Logger.error('Erro ao obter ranking: ' + error.message);
    return { success: false, code: 'LEADERBOARD_FAILED', message: 'Não foi possível carregar o ranking.' };
  }
}

function getUserGameProgress() {
  const user = Auth_Session.getSessionUser();
  if (!user) {
    return { success: false, code: 'UNAUTHENTICATED', message: 'Usuário não autenticado.' };
  }
  try {
    return { success: true, data: Logic_GameProgress.getLatestProgress(user.id) };
  } catch (error) {
    Middleware_Logger.error('Erro ao obter progresso: ' + error.message);
    return { success: false, code: 'PROGRESS_FAILED', message: 'Não foi possível carregar o progresso.' };
  }
}

function getAvailableMaps() {
  const user = Auth_Session.getSessionUser();
  if (!user) {
    return { success: false, code: 'UNAUTHENTICATED', message: 'Usuário não autenticado.', data: [] };
  }
  try {
    const scores = DB_Scores.getScoresByUserId(user.id);
    const maps = Helper_Maps.getMaps().map(function(map) {
      const mapScores = scores.filter(function(score) { return Number(score.stage) === map.id; });
      const bestMoves = mapScores.length
        ? Math.min.apply(null, mapScores.map(function(score) { return Number(score.score); }))
        : null;
      return {
        id: map.id,
        name: map.name,
        description: map.description || ('Explore ' + map.theme + ' e explique sua estratégia.'),
        landscapeType: map.landscapeType || 'paisagem',
        inquiry: map.inquiry || '',
        unlocked: Logic_GameProgress.isStageUnlocked(user.id, map.id),
        completed: mapScores.length > 0,
        bestMoves: bestMoves
      };
    });
    return { success: true, data: maps };
  } catch (error) {
    Middleware_Logger.error('Erro ao listar mapas: ' + error.message);
    return { success: false, code: 'MAPS_FAILED', message: 'Não foi possível carregar os mapas.', data: [] };
  }
}

function getPlayerAchievements() {
  const user = Auth_Session.getSessionUser();
  if (!user) {
    return { success: false, code: 'UNAUTHENTICATED', message: 'Usuário não autenticado.' };
  }
  return { success: true, data: Logic_Rewards.getPlayerAchievements(user.id) };
}
