// Contrato único de comunicação entre o frontend e o backend.

class API_Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'API_Error';
    this.code = code;
  }
}

/**
 * Entrada RPC usada pelo frontend.
 * Request: { action, payload, requestId }
 * Response: { ok, data, message, error, meta }
 */
function apiRequest(request) {
  const startedAt = new Date().getTime();
  const safeRequest = request && typeof request === 'object' ? request : {};
  const action = String(safeRequest.action || '');
  const payload = safeRequest.payload && typeof safeRequest.payload === 'object'
    ? safeRequest.payload
    : {};
  const requestId = String(safeRequest.requestId || Utilities.getUuid());
  Auth_Session.setRequestToken(safeRequest.sessionToken || '');
  const contextUser = Auth_Session.getSessionUser();
  Middleware_Logger.setContext({
    requestId: requestId,
    action: action,
    userId: contextUser ? contextUser.id : ''
  });

  try {
    const route = getApiRoutes_()[action];
    if (!route) {
      throw new API_Error('ACTION_NOT_FOUND', 'Ação não encontrada ou não permitida.');
    }

    ensureBackendReady_();
    authorizeApiRoute_(route.access);
    const serviceResult = route.handler(payload);
    const normalized = normalizeServiceResult_(serviceResult);
    const response = {
      ok: normalized.ok,
      data: normalized.data,
      message: normalized.message,
      error: normalized.error,
      meta: apiMeta_(requestId, startedAt)
    };

    Middleware_Logger.log({
      event: 'API_REQUEST',
      requestId: requestId,
      action: action,
      ok: response.ok,
      durationMs: response.meta.durationMs
    });
    Middleware_Logger.clearContext();
    return response;
  } catch (error) {
    const code = error.code || 'INTERNAL_ERROR';
    Middleware_Logger.error({
      event: 'API_ERROR',
      requestId: requestId,
      action: action,
      code: code,
      message: error.message,
      durationMs: new Date().getTime() - startedAt
    });
    const errorResponse = {
      ok: false,
      data: null,
      message: code === 'INTERNAL_ERROR'
        ? 'Ocorreu um erro interno. Tente novamente.'
        : error.message,
      error: { code: code },
      meta: apiMeta_(requestId, startedAt)
    };
    Middleware_Logger.clearContext();
    return errorResponse;
  }
}

function getApiRoutes_() {
  return {
    'auth.login': {
      access: 'public',
      handler: function(payload) {
        return doLogin_(payload.username, payload.password);
      }
    },
    'auth.register': {
      access: 'public',
      handler: function(payload) {
        return doRegister_(payload.username, payload.password, payload.email);
      }
    },
    'auth.logout': {
      access: 'public',
      handler: function() {
        return doLogout_();
      }
    },
    'auth.session': {
      access: 'public',
      handler: function() {
        const user = Auth_Session.getSessionUser();
        return {
          success: true,
          data: {
            authenticated: Boolean(user),
            user: user ? { id: user.id, username: user.username, email: user.email } : null,
            isAdmin: Auth_Session.isAdmin()
          }
        };
      }
    },
    'game.assets': {
      access: 'user',
      handler: function() {
        // A leitura do Drive passa pelo mesmo gateway e pela mesma sessão das
        // demais ações do jogo. O manifesto pode indicar assets ausentes sem
        // transformar isso em erro de transporte.
        return { success: true, data: getGameAssetManifest_() };
      }
    },
    'game.saveScore': {
      access: 'user',
      handler: function(payload) {
        return saveGameScore(payload.stage, payload.moves, payload.evidence);
      }
    },
    'game.strategyFeedback': {
      access: 'user',
      handler: function(payload) {
        return Service_StrategyFeedback.getStrategyFeedback(payload.scoreId, payload.explanation);
      }
    },
    'game.feedback.strategy': {
      access: 'user',
      handler: function(payload) {
        return Service_StrategyFeedback.getStrategyFeedback(payload.scoreId, payload.explanation);
      }
    },
    'game.strategyFeedback.reply': {
      access: 'user',
      handler: function(payload) {
        return Service_StrategyFeedback.saveStudentExplanation(payload.scoreId, payload.explanation);
      }
    },
    'game.strategyFeedback.review': {
      access: 'user',
      handler: function(payload) {
        return Service_StrategyFeedback.reviewStrategyFeedback(payload.scoreId, payload.review);
      }
    },
    'game.leaderboard': {
      access: 'public',
      handler: function(payload) {
        return getLeaderboard(payload.stage === undefined ? null : payload.stage);
      }
    },
    'game.progress': {
      access: 'user',
      handler: function() {
        return getUserGameProgress();
      }
    },
    'game.maps': {
      access: 'user',
      handler: function() {
        return getAvailableMaps();
      }
    },
    'game.achievements': {
      access: 'user',
      handler: function() {
        return getPlayerAchievements();
      }
    },
    'game.inventory': {
      access: 'user',
      handler: function() {
        const user = Auth_Session.getSessionUser();
        const inventory = Logic_Rewards.getPlayerInventory(user.id);
        return { success: true, data: inventory };
      }
    },
    'game.hints.get': {
      access: 'user',
      handler: function(payload) {
        const user = Auth_Session.getSessionUser();
        return Service_Hints.getHint(user.id, payload.stageId, payload.hintLevel);
      }
    },
    'game.hints.status': {
      access: 'user',
      handler: function() {
        const user = Auth_Session.getSessionUser();
        return Service_Hints.getHintStatus(user.id);
      }
    },
    'game.hints.purchase': {
      access: 'user',
      handler: function(payload) {
        const user = Auth_Session.getSessionUser();
        return Service_Hints.purchaseHints(user.id, payload.quantity || 1);
      }
    },
    'game.hints.adaptive': {
      access: 'user',
      handler: function(payload) {
        const user = Auth_Session.getSessionUser();
        return Service_Hints.getAdaptiveHint(user.id, payload.stageId, payload.restartCount);
      }
    },
    'user.profile': {
      access: 'user',
      handler: function() {
        return getUserProfile();
      }
    },
    'user.updateProfile': {
      access: 'user',
      handler: function(payload) {
        return updateMyProfile(payload.username, payload.email);
      }
    },
    'user.changePassword': {
      access: 'user',
      handler: function(payload) {
        return changeMyPassword(payload.currentPassword, payload.newPassword);
      }
    },
    'admin.users.list': {
      access: 'admin',
      handler: function() {
        return adminGetAllUsers();
      }
    },
    'admin.users.delete': {
      access: 'admin',
      handler: function(payload) {
        return adminDeleteUser(payload.userId);
      }
    },
    'admin.users.export': {
      access: 'admin',
      handler: function() {
        return adminExportUsersToCsv();
      }
    },
    'admin.audit.list': {
      access: 'admin',
      handler: function() {
        return adminGetAuditLogs();
      }
    },
    'admin.logs.list': {
      access: 'admin',
      handler: function(payload) {
        return adminGetSystemLogs(payload.limit, payload.level);
      }
    },
    'admin.settings.get': {
      access: 'admin',
      handler: function() {
        return adminGetSettings();
      }
    },
    'admin.settings.update': {
      access: 'admin',
      handler: function(payload) {
        return adminUpdateSettings(payload.appTitle, payload.welcomeMessage);
      }
    },
    'admin.maturity.backend': {
      access: 'admin',
      handler: function() {
        return adminGetBackendMaturity();
      }
    },
    'admin.maturity.frontend': {
      access: 'admin',
      handler: function() {
        return adminGetFrontendMaturity();
      }
    },
    'admin.maturity.frontend.audit': {
      access: 'admin',
      handler: function(payload) {
        return submitFrontendAudit(payload.report);
      }
    },
    'admin.backup.create': {
      access: 'admin',
      handler: function(payload) {
        return BackupService.createManualBackup(payload.description);
      }
    },
    'admin.backup.list': {
      access: 'admin',
      handler: function(payload) {
        return BackupService.listBackups(payload.limit || 10);
      }
    },
    'admin.backup.stats': {
      access: 'admin',
      handler: function() {
        return BackupService.getBackupStats();
      }
    },
    'admin.backup.restore': {
      access: 'admin',
      handler: function(payload) {
        return BackupService.restoreBackup(payload.backupId, payload.newName);
      }
    },
    'admin.backup.verify': {
      access: 'admin',
      handler: function(payload) {
        return BackupService.verifyBackupIntegrity(payload.backupId);
      }
    },
    'admin.reports.dashboard': {
      access: 'admin',
      handler: function() {
        return Report_Generator.getDashboardMetrics();
      }
    },
    'admin.reports.engagement': {
      access: 'admin',
      handler: function() {
        return Report_Generator.generatePlayerEngagementReport();
      }
    },
    'admin.reports.biomes': {
      access: 'admin',
      handler: function() {
        return Report_Generator.generateBiomeProgressReport();
      }
    },
    'admin.reports.learning': {
      access: 'admin',
      handler: function(payload) {
        return Report_Generator.generateLearningEvidenceReport(payload.stageId);
      }
    },
    'admin.reports.achievements': {
      access: 'admin',
      handler: function() {
        return Report_Generator.generateAchievementsReport();
      }
    }
  };
}

function authorizeApiRoute_(access) {
  if (access === 'public') return;
  if (!Auth_Session.isLoggedIn()) {
    throw new API_Error('UNAUTHENTICATED', 'Sua sessão não está ativa. Entre novamente.');
  }
  if (access === 'admin' && !Auth_Session.isAdmin()) {
    throw new API_Error('FORBIDDEN', 'Você não possui permissão para esta operação.');
  }
}

function normalizeServiceResult_(result) {
  if (result && result.success === false) {
    return {
      ok: false,
      data: result.data === undefined ? null : result.data,
      message: result.message || 'Não foi possível concluir a operação.',
      error: { code: result.code || 'BUSINESS_ERROR' }
    };
  }
  if (result && result.success === true) {
    return {
      ok: true,
      data: result.data === undefined ? null : result.data,
      message: result.message || '',
      error: null
    };
  }
  return { ok: true, data: result === undefined ? null : result, message: '', error: null };
}

function apiMeta_(requestId, startedAt) {
  return {
    requestId: requestId,
    timestamp: new Date().toISOString(),
    durationMs: new Date().getTime() - startedAt,
    apiVersion: '1.0'
  };
}

// Compatibilidade temporária para integrações que ainda enviam nomes antigos.
function handleRequest(functionName, args) {
  const legacy = {
    doLogin: { action: 'auth.login', fields: ['username', 'password'] },
    doRegister: { action: 'auth.register', fields: ['username', 'password', 'email'] },
    doLogout: { action: 'auth.logout', fields: [] },
    checkLoginStatus: { action: 'auth.session', fields: [] },
    getLoggedUser: { action: 'auth.session', fields: [] },
    saveGameScore: { action: 'game.saveScore', fields: ['stage', 'moves', 'evidence'] },
    getStrategyFeedback: { action: 'game.strategyFeedback', fields: ['scoreId', 'explanation'] },
    reviewStrategyFeedback: { action: 'game.strategyFeedback.review', fields: ['scoreId', 'review'] },
    getLeaderboard: { action: 'game.leaderboard', fields: ['stage'] },
    getUserGameProgress: { action: 'game.progress', fields: [] },
    getUserProfile: { action: 'user.profile', fields: [] },
    updateProfile: { action: 'user.updateProfile', fields: ['username', 'email'] },
    changePassword: { action: 'user.changePassword', fields: ['currentPassword', 'newPassword'] },
    adminGetBackendMaturity: { action: 'admin.maturity.backend', fields: [] },
    adminGetFrontendMaturity: { action: 'admin.maturity.frontend', fields: [] }
  };
  const definition = legacy[functionName];
  if (!definition) {
    return apiRequest({ action: functionName, payload: {}, requestId: Utilities.getUuid() });
  }
  const values = Array.isArray(args) ? args : [];
  const payload = {};
  if (functionName === 'updateProfile' && values.length >= 3) {
    return apiRequest({
      action: definition.action,
      payload: { username: values[1], email: values[2] },
      requestId: Utilities.getUuid()
    });
  }
  if (functionName === 'changePassword' && values.length >= 3) {
    return apiRequest({
      action: definition.action,
      payload: { currentPassword: values[1], newPassword: values[2] },
      requestId: Utilities.getUuid()
    });
  }
  definition.fields.forEach(function(field, index) {
    payload[field] = values[index];
  });
  return apiRequest({ action: definition.action, payload: payload, requestId: Utilities.getUuid() });
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};
    if (body.payload || String(body.action || '').indexOf('.') !== -1) {
      return jsonResponse_(apiRequest(body));
    }
    return jsonResponse_(handleRequest(body.action, body.args));
  } catch (error) {
    return jsonResponse_({
      ok: false,
      data: null,
      message: 'JSON inválido.',
      error: { code: 'INVALID_JSON' },
      meta: apiMeta_(Utilities.getUuid(), new Date().getTime())
    });
  }
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
