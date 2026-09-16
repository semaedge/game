// Service_Admin.gs
//
// Funcionalidade Principal: Expõe funções administrativas para o frontend via `google.script.run`, permitindo que administradores gerenciem o sistema.
//
// Integrações:
// - DB_Users.gs: Para gerenciar usuários.
// - DB_Scores.gs: Para gerenciar pontuações.
// - DB_Settings.gs: Para gerenciar configurações do sistema.
// - Audit_Trail.gs: Para acessar logs de auditoria.
// - Auth_Session.gs: Para verificar permissões de administrador.
//
// Uso:
// Funções acessíveis apenas por usuários com privilégios de administrador para realizar operações de manutenção e gerenciamento.
//
function adminGetAllUsers() {
  if (!Auth_Session.isAdmin()) {
    throw new Error("Acesso negado. Apenas administradores podem acessar esta função.");
  }
  return { success: true, data: getSafeUsers_() };
}

function getSafeUsers_() {
  return DB_Users.getAllUsers().map(function(user) {
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    });
}

function adminDeleteUser(userId) {
  if (!Auth_Session.isAdmin()) {
    throw new Error("Acesso negado. Apenas administradores podem acessar esta função.");
  }
  const currentAdmin = Auth_Session.getSessionUser();
  if (String(userId) === String(currentAdmin.id)) {
    return { success: false, code: 'SELF_DELETE_BLOCKED', message: 'O administrador não pode excluir a própria conta.' };
  }
  const result = DB_Users.deleteUser(userId);
  if (result) {
    Audit_Trail.logAction("ADMIN_DELETE_USER", { admin: Auth_Session.getSessionUser().username, deletedUserId: userId });
    return { success: true, message: "Usuário deletado com sucesso." };
  }
  return { success: false, message: "Falha ao deletar usuário." };
}

/**
 * Exportação administrativa de usuários em CSV.
 *
 * A ação `admin.users.export` do API_Router já apontava para esta função, que
 * não existia em lugar nenhum — a rota respondia INTERNAL_ERROR. As colunas
 * são declaradas explicitamente para que a exportação não carregue o campo de
 * senha presente no registro.
 */
function adminExportUsersToCsv() {
  if (!Auth_Session.isAdmin()) {
    throw new Error("Acesso negado. Apenas administradores podem acessar esta função.");
  }

  const result = Export_CSV.exportRecords(
    getSafeUsers_(),
    [
      { key: 'id', label: 'ID' },
      { key: 'username', label: 'Username' },
      { key: 'email', label: 'Email' },
      { key: 'createdAt', label: 'CriadoEm', format: Utils_Date.formatTimestamp },
      { key: 'updatedAt', label: 'AtualizadoEm', format: Utils_Date.formatTimestamp }
    ],
    'usuarios'
  );
  if (!result.success) return result;

  Audit_Trail.logAction('ADMIN_EXPORT_USERS', { rows: result.rows });
  return {
    success: true,
    message: result.rows + ' usuário(s) exportado(s).',
    data: { filename: result.filename, content: result.data, rows: result.rows }
  };
}

function adminGetAuditLogs() {
  if (!Auth_Session.isAdmin()) {
    throw new Error("Acesso negado. Apenas administradores podem acessar esta função.");
  }
  // Assumindo que Audit_Trail tem um método para buscar logs
  const data = DB_Core.getAllData("AuditLogs");
  const logs = [];
  for (let i = 1; i < data.length; i++) {
    logs.push({
      timestamp: data[i][0],
      username: data[i][1],
      action: data[i][2],
      details: data[i][3],
    });
  }
  return { success: true, data: logs };
}

/**
 * Logs estruturados da aba SystemLogs.
 *
 * A tela de administração se chamava "Logs do Sistema e Auditoria" mas só
 * conseguia carregar a trilha de auditoria: não havia ação exposta para os
 * logs estruturados, embora Middleware_Logger já os persistisse.
 */
function adminGetSystemLogs(limit, level) {
  if (!Auth_Session.isAdmin()) {
    throw new Error("Acesso negado. Apenas administradores podem acessar esta função.");
  }

  const size = Math.max(1, Math.min(Number(limit) || 100, 500));
  const normalizedLevel = String(level || '').toUpperCase();
  const allowedLevels = ['INFO', 'WARN', 'ERROR'];
  const filter = allowedLevels.indexOf(normalizedLevel) === -1 ? '' : normalizedLevel;

  try {
    return { success: true, data: Middleware_Logger.getRecent(size, filter) };
  } catch (error) {
    Middleware_Logger.error('Falha ao ler os logs estruturados: ' + error.message);
    return {
      success: false,
      code: 'LOGS_UNAVAILABLE',
      message: 'Não foi possível ler os logs estruturados. Verifique se as migrações foram aplicadas.'
    };
  }
}

function adminGetSettings() {
  if (!Auth_Session.isAdmin()) {
    throw new Error("Acesso negado. Apenas administradores podem acessar esta função.");
  }
  return {
    success: true,
    data: {
      appTitle: DB_Settings.getSetting('appTitle') || APP_NAME,
      welcomeMessage: DB_Settings.getSetting('welcomeMessage') || ''
    }
  };
}

function adminUpdateSettings(appTitle, welcomeMessage) {
  if (!Auth_Session.isAdmin()) {
    throw new Error("Acesso negado. Apenas administradores podem acessar esta função.");
  }
  const normalizedTitle = String(appTitle || '').trim();
  const normalizedMessage = String(welcomeMessage || '').trim();
  if (!normalizedTitle || normalizedTitle.length > 80 || normalizedMessage.length > 500) {
    return { success: false, code: 'INVALID_SETTINGS', message: 'Configurações inválidas.' };
  }
  DB_Settings.setSetting('appTitle', normalizedTitle);
  DB_Settings.setSetting('welcomeMessage', normalizedMessage);
  Audit_Trail.logAction('ADMIN_SETTINGS_UPDATED', {
    appTitle: normalizedTitle
  });
  return {
    success: true,
    message: 'Configurações atualizadas.',
    data: { appTitle: normalizedTitle, welcomeMessage: normalizedMessage }
  };
}

function adminGetBackendMaturity() {
  if (!Auth_Session.isAdmin()) {
    throw new Error("Acesso negado. Apenas administradores podem executar esta avaliação.");
  }
  const report = Backend_Maturity.assess({ persist: true });
  Audit_Trail.logAction("ADMIN_BACKEND_MATURITY_ASSESSMENT", {
    score: report.score,
    level: report.level.name,
    criticalGaps: report.criticalGaps
  });
  return { success: true, data: report };
}

function adminGetFrontendMaturity() {
  if (!Auth_Session.isAdmin()) {
    throw new Error("Acesso negado. Apenas administradores podem executar esta avaliação.");
  }
  const report = Frontend_Maturity.assess({ persist: true });
  Audit_Trail.logAction("ADMIN_FRONTEND_MATURITY_ASSESSMENT", {
    overallScore: report.overallScore,
    maturityScore: report.maturity.score,
    intuitivenessScore: report.intuitiveness.score,
    level: report.level.name
  });
  return { success: true, data: report };
}
