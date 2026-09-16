/**
 * codex-frontend-backend-healthcheck
 * Sonda de saude leve: confirma que o frontend alcanca o backend via
 * google.script.run e recebe o envelope padrao do projeto.
 *
 * - Sem efeitos colaterais, sem dependencia de sessao ou planilha. E por isso
 *   que existe separado de backendHealth() (Backend_Setup.gs), que abre a
 *   planilha e conta abas: aquele diagnostica o esquema, este so responde.
 * - Arquivo isolado de proposito: nao altera nenhuma rota existente.
 */
function ping() {
  try {
    return {
      success: true,
      data: {
        status: 'ok',
        service: 'backend',
        time: new Date().toISOString()
      }
    };
  } catch (error) {
    Middleware_Logger.error('Erro em ping: ' + error.message);
    throw error;
  }
}
