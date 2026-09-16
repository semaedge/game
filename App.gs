// App.gs
//
// Funcionalidade Principal: Ponto de entrada do web app. doGet() resolve a
// requisição contra a tabela de rotas, aplica o controle de acesso declarado e
// renderiza o template com os dados que a rota fornece.
//
// Integrações:
// - Router_Pages.gs: tabela de rotas (template, acesso e dados de cada tela).
// - Auth_Session.gs: identidade e permissão da requisição.
// - Security_Headers.gs: política aplicada a toda resposta HTML.
//
// Uso:
// Para adicionar ou alterar uma tela, edite Router_Pages.routes(). Esta função
// não precisa mudar: ela é genérica sobre a tabela.
//
function doGet(e) {
  const parameters = e && e.parameter ? e.parameter : {};
  Auth_Session.setRequestToken(parameters.session || '');

  if (parameters.api === 'health') {
    return jsonResponse_(backendHealth());
  }

  try {
    ensureBackendReady_();
  } catch (schemaError) {
    Middleware_Logger.error('Falha ao preparar o esquema: ' + schemaError.message);
    return renderPage_(ROUTER_ERROR_TEMPLATE);
  }

  const page = String(parameters.page || 'home').toLowerCase();
  const user = Auth_Session.getSessionUser();
  Analytics_Service.trackPageView(page, {
    authenticated: Boolean(user),
    admin: Auth_Session.isAdmin()
  });

  const route = Router_Pages.resolve(page);
  if (!route) return renderPage_(ROUTER_NOT_FOUND_TEMPLATE);

  const denial = Router_Pages.denialFor(route, user);
  if (denial) {
    return renderPage_(denial, {
      requestedPage: page,
      requestedLabel: Router_Pages.label(page)
    });
  }

  try {
    const data = route.data ? route.data({ parameters: parameters, user: user }) : {};
    Router_Pages.verifyProvides_(page, route, data);
    return renderPage_(route.template, data);
  } catch (error) {
    Middleware_Logger.error('Erro ao renderizar ' + page + ': ' + error.message);
    return renderPage_(ROUTER_ERROR_TEMPLATE);
  }
}

function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

function includeInlineData(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent().replace(/\s+/g, '');
}

// URL absoluta do /exec. O HTML roda dentro do iframe sandbox do Apps Script,
// cujo documento vive em outro domínio: um destino relativo ("?page=login")
// atribuído a window.top resolveria contra o domínio errado e a navegação
// falharia. Toda navegação de topo precisa desta base.
function getScriptUrl() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (error) {
    return '';
  }
}

function renderPage_(templateName, data) {
  const template = HtmlService.createTemplateFromFile(templateName);
  const viewData = data || {};
  Object.keys(viewData).forEach(function(key) {
    template[key] = viewData[key];
  });
  return applySecurityHeaders(
    template.evaluate()
      .setTitle(APP_NAME)
  );
}
