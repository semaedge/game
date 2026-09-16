// Inicialização mínima e idempotente do backend.

/**
 * Configura a planilha usada como banco e cria o esquema básico.
 *
 * @param {string=} spreadsheetId ID de uma planilha existente. Se omitido,
 * usa a planilha vinculada ao script ou cria uma nova.
 * @param {string=} adminEmail Email administrativo opcional.
 * @return {Object} Resumo da configuração.
 */
function setupBackend(spreadsheetId, adminEmail) {
  const properties = PropertiesService.getScriptProperties();
  const configuredAdmin = properties.getProperty(CONFIG_KEYS.adminEmail);
  const activeEmail = Session.getActiveUser().getEmail();
  if (configuredAdmin &&
      String(activeEmail || '').toLowerCase() !== String(configuredAdmin).toLowerCase() &&
      !Auth_Session.isAdmin()) {
    throw new Error('Acesso negado. Apenas o administrador pode reconfigurar o backend.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    let spreadsheet;
    if (spreadsheetId) {
      spreadsheet = SpreadsheetApp.openById(String(spreadsheetId).trim());
    } else {
      spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      if (!spreadsheet) {
        spreadsheet = SpreadsheetApp.create(APP_NAME + ' - Database');
      }
    }

    properties.setProperty(CONFIG_KEYS.spreadsheetId, spreadsheet.getId());

    const resolvedAdminEmail = adminEmail || Session.getActiveUser().getEmail();
    if (resolvedAdminEmail) {
      properties.setProperty(
        CONFIG_KEYS.adminEmail,
        String(resolvedAdminEmail).trim().toLowerCase()
      );
    }

    Migration_Manager.runMigrations();
    CacheService.getScriptCache().put('backend_schema_ready_v14', 'true', 21600);
    DB_Settings.setSetting('appName', APP_NAME);
    DB_Settings.setSetting('language', DEFAULT_LANGUAGE);
    DB_Settings.setSetting('initializedAt', new Date().toISOString());

    return {
      success: true,
      message: 'Backend configurado com sucesso.',
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl(),
      adminEmail: properties.getProperty(CONFIG_KEYS.adminEmail) || null,
      health: backendHealth()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Diagnóstico leve, disponível no editor e em GET ?api=health.
 */
function backendHealth() {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty(CONFIG_KEYS.spreadsheetId);
  const requiredSheets = [
    USERS_SHEET_NAME,
    SCORES_SHEET_NAME,
    SETTINGS_SHEET_NAME,
    AUDIT_LOGS_SHEET_NAME,
    PROGRESS_SHEET_NAME,
    ACHIEVEMENTS_SHEET_NAME,
    LOGS_SHEET_NAME,
    ANALYTICS_SHEET_NAME
  ];

  if (!spreadsheetId) {
    return {
      success: false,
      status: 'not_configured',
      message: 'Execute setupBackend() no editor do Apps Script.'
    };
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const existingSheets = spreadsheet.getSheets().map(function(sheet) {
      return sheet.getName();
    });
    const missingSheets = requiredSheets.filter(function(name) {
      return existingSheets.indexOf(name) === -1;
    });

    return {
      success: missingSheets.length === 0,
      status: missingSheets.length === 0 ? 'ok' : 'degraded',
      database: spreadsheet.getName(),
      missingSheets: missingSheets,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      message: error.message
    };
  }
}

function runMigrations() {
  assertAdminOperator_();
  Migration_Manager.runMigrations();
  CacheService.getScriptCache().remove('backend_schema_ready_v6');
  CacheService.getScriptCache().remove('backend_schema_ready_v8');
  CacheService.getScriptCache().remove('backend_schema_ready_v9');
  CacheService.getScriptCache().remove('backend_schema_ready_v11');
  CacheService.getScriptCache().remove('backend_schema_ready_v14');
  return backendHealth();
}

function assertAdminOperator_() {
  const activeEmail = Session.getActiveUser().getEmail();
  const configuredAdmin = PropertiesService.getScriptProperties()
    .getProperty(CONFIG_KEYS.adminEmail);
  const activeUserIsAdmin = configuredAdmin &&
    String(activeEmail || '').toLowerCase() === String(configuredAdmin).toLowerCase();
  if (!activeUserIsAdmin && !Auth_Session.isAdmin()) {
    throw new Error('Acesso negado. Operação exclusiva do administrador.');
  }
}

function ensureBackendReady_() {
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty(CONFIG_KEYS.spreadsheetId)) return false;

  const cache = CacheService.getScriptCache();
  if (cache.get('backend_schema_ready_v14') === 'true') return true;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (cache.get('backend_schema_ready_v14') !== 'true') {
      Migration_Manager.runMigrations();
      cache.put('backend_schema_ready_v14', 'true', 21600);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}
