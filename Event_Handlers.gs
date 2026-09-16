// Event_Handlers.gs
//
// Funcionalidade Principal: Gatilhos simples da planilha (menu e edição) e a
// ponte usada pela barra lateral de administração.
//
// Integrações:
// - Backend_Setup.gs: health check e migrações, agora sob ação explícita.
// - Audit_Trail.gs: registra alterações feitas direto na planilha.
//
// Notas de correção nesta revisão:
// - onOpen executava Migration_Manager.runMigrations() a cada abertura. Além
//   do custo, gatilhos simples rodam com autorização restrita: abrir a
//   planilha do banco por ID e escrever nela exige autorização que o onOpen
//   simples não tem, então a migração automática falhava justamente para quem
//   não é o dono do arquivo. Migrar virou item de menu, sob ação deliberada.
// - onEdit registrava um log INFO para toda célula editada. Com
//   PERSIST_INFO_LOGS ligado isso significa uma escrita na aba de logs por
//   tecla — os gatilhos simples têm limite de 30s e cota diária. Agora só as
//   abas sensíveis geram registro, e como auditoria, que é o dado que
//   realmente importa: alteração feita fora da aplicação.
//
const EVENT_AUDITED_SHEETS = [USERS_SHEET_NAME, SETTINGS_SHEET_NAME];

function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Sema Edge')
    .addItem('Abrir painel de administração', 'showSidebar')
    .addSeparator()
    .addItem('Verificar saúde do backend', 'menuCheckHealth')
    .addItem('Executar migrações', 'menuRunMigrations')
    .addItem('Configurar backend', 'setupBackend')
    .addToUi();
}

/**
 * Auditoria de edições manuais nas abas sensíveis.
 *
 * Uma alteração feita direto na planilha não passa por nenhuma validação nem
 * pelo log da API — é o único caminho de escrita completamente invisível para
 * a aplicação. É exatamente por isso que ele merece registro.
 */
function onEdit(e) {
  try {
    if (!e || !e.range || !e.source) return;

    const sheetName = e.range.getSheet().getName();
    if (EVENT_AUDITED_SHEETS.indexOf(sheetName) === -1) return;

    // Gatilho simples só pode escrever na própria planilha: se o banco for
    // outro arquivo, registrar aqui falharia por falta de autorização.
    const configuredId = PropertiesService.getScriptProperties()
      .getProperty(CONFIG_KEYS.spreadsheetId);
    if (!configuredId || configuredId !== e.source.getId()) return;

    Audit_Trail.logAction('SHEET_MANUAL_EDIT', {
      sheet: sheetName,
      cell: e.range.getA1Notation(),
      previousValue: Utils_String.truncate(e.oldValue, 80),
      newValue: Utils_String.truncate(e.value, 80),
      editor: e.user ? e.user.getEmail() : ''
    });
  } catch (error) {
    // Um gatilho que lança interrompe a edição do usuário com um alerta.
    // Auditoria nunca deve atrapalhar quem está editando a planilha.
    console.error('onEdit falhou: ' + error.message);
  }
}

function showSidebar() {
  const html = HtmlService.createTemplateFromFile('Sidebar').evaluate()
    .setTitle('Sema Edge — Administração');
  SpreadsheetApp.getUi().showSidebar(html);
}

function menuCheckHealth() {
  const health = backendHealth();
  const details = health.status === 'ok'
    ? 'Banco: ' + (health.database || '—')
    : (health.message || 'Abas ausentes: ' + (health.missingSheets || []).join(', '));
  SpreadsheetApp.getUi().alert('Saúde do backend: ' + health.status + '\n\n' + details);
}

function menuRunMigrations() {
  const ui = SpreadsheetApp.getUi();
  try {
    const health = runMigrations();
    ui.alert('Migrações concluídas.\n\nEstado atual: ' + health.status + '.');
  } catch (error) {
    ui.alert('Falha ao executar as migrações:\n\n' + error.message);
  }
}

/**
 * Ponte da barra lateral. Diferente do web app, esta superfície roda dentro do
 * editor da planilha e não tem o SemaAPI disponível, então usa google.script.run
 * direto — com a mesma verificação de operador administrativo.
 */
function sidebarRequest(action) {
  assertAdminOperator_();
  switch (action) {
    case 'health':
      return { success: true, data: backendHealth() };
    case 'migrations':
      Migration_Manager.runMigrations();
      return { success: true, message: 'Migrações concluídas.', data: backendHealth() };
    case 'users':
      return { success: true, data: getSafeUsers_() };
    default:
      return { success: false, message: 'Ação desconhecida.' };
  }
}
