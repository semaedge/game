// Config.gs
//
// Funcionalidade Principal: Gerencia as configurações globais do projeto, incluindo IDs de planilhas, nomes de abas, e outras variáveis de ambiente.
//
// Integrações:
// - Google Sheets: lê o ID da planilha das propriedades do script.
// - Autenticação: Pode conter configurações relacionadas a tokens ou chaves de API (se aplicável).
// - Serviços Externos: Configurações para quaisquer APIs externas ou serviços que o projeto possa consumir.
//
// Uso:
// Este arquivo é carregado uma vez no início da execução do script para garantir que todas as partes do sistema tenham acesso às configurações necessárias.
//
const CONFIG_KEYS = Object.freeze({
  spreadsheetId: 'SPREADSHEETS_ID',
  adminEmail: 'ADMIN_EMAIL',
  teacherEmails: 'TEACHER_EMAILS'
});
const USERS_SHEET_NAME = 'Users';
const SCORES_SHEET_NAME = 'Scores';
const SETTINGS_SHEET_NAME = 'Settings';
const AUDIT_LOGS_SHEET_NAME = 'AuditLogs';
const PROGRESS_SHEET_NAME = 'Progress';
const ACHIEVEMENTS_SHEET_NAME = 'Achievements';
const LOGS_SHEET_NAME = 'SystemLogs';
const ANALYTICS_SHEET_NAME = 'Analytics';

// Outras configurações globais
const APP_NAME = 'Sema Edge';
const ADMIN_EMAIL = PropertiesService.getScriptProperties().getProperty(CONFIG_KEYS.adminEmail) || 'admin@example.com';
const DEFAULT_LANGUAGE = 'pt_BR';

function getSpreadsheetId_() {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty(CONFIG_KEYS.spreadsheetId);

  if (!spreadsheetId) {
    throw new Error('Backend não configurado. Execute setupBackend() uma vez no editor do Apps Script.');
  }

  return spreadsheetId;
}
