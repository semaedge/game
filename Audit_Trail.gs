// Audit_Trail.gs
//
// Funcionalidade Principal: Registra todas as ações significativas realizadas no sistema, como logins, alterações de dados e eventos do jogo, para fins de auditoria e segurança.
//
// Integrações:
// - DB_Core.gs: Utiliza para armazenar os registros de auditoria em uma planilha dedicada.
// - Auth_Session.gs: Para registrar qual usuário realizou a ação.
//
// Uso:
// Chamado por outras partes do sistema sempre que uma ação importante ocorre, fornecendo um histórico detalhado das operações.
//
class Audit_Trail {
  static logAction(action, details = {}) {
    const user = Auth_Session.getSessionUser();
    const username = user ? user.username : 'Sistema/Anônimo';
    const rowData = [
      new Date().toISOString(),
      username,
      action,
      JSON.stringify(details)
    ];
    // Assumindo que existe uma aba 'AuditLogs' na planilha
    try {
      DB_Core.appendRow('AuditLogs', rowData);
    } catch (e) {
      Middleware_Logger.error(`Erro ao registrar trilha de auditoria: ${e.message}`);
    }
  }
}
