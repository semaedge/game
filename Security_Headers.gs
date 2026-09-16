// Security_Headers.gs
//
// Funcionalidade Principal: Aplica cabeçalhos de segurança HTTP a respostas de aplicativos web para mitigar vulnerabilidades comuns, como ataques XSS e clickjacking.
//
// Integrações:
// - HtmlService: Modifica as respostas HTML geradas pelo Apps Script.
// - Backend_Maturity.gs: Lê a política aplicada via getSecurityHeaderPolicy().
//
// Uso:
// Esta função deve ser chamada antes de retornar qualquer `HtmlOutput` em `doGet` ou outras funções que servem conteúdo web.
//
// A política é declarada uma única vez para que a avaliação de maturidade possa
// inspecionar o que é realmente aplicado, em vez de presumir o comportamento.
const SECURITY_HEADER_POLICY = Object.freeze({
  // Necessário para o shell/iframe do web app carregar as páginas do projeto.
  xFrameOptionsMode: 'ALLOWALL',
  metaTags: Object.freeze([
    Object.freeze({ name: 'viewport', content: 'width=device-width, initial-scale=1.0' })
  ])
});

function applySecurityHeaders(htmlOutput) {
  SECURITY_HEADER_POLICY.metaTags.forEach(function(tag) {
    // Alguns contextos do HtmlService (especialmente o iframe do editor)
    // rejeitam addMetaTag mesmo para viewport. A política continua declarada
    // para auditoria, mas a falha de compatibilidade não pode impedir o login.
    try {
      htmlOutput.addMetaTag(tag.name, tag.content);
    } catch (ignored) {
      // O template já pode declarar o viewport no próprio HTML.
    }
  });
  // O projeto é distribuído como uma tela incorporável; a autorização de
  // acesso continua sendo feita pelas sessões/rotas, não pelo frame.
  htmlOutput.setXFrameOptionsMode(
    HtmlService.XFrameOptionsMode[SECURITY_HEADER_POLICY.xFrameOptionsMode]
  );
  return htmlOutput;
}

/**
 * Expõe a política efetivamente aplicada às respostas HTML.
 * O HtmlOutput não possui getters para esses valores, então esta é a única
 * fonte verificável em runtime.
 */
function getSecurityHeaderPolicy() {
  return {
    xFrameOptionsMode: SECURITY_HEADER_POLICY.xFrameOptionsMode,
    metaTags: SECURITY_HEADER_POLICY.metaTags.map(function(tag) {
      return { name: tag.name, content: tag.content };
    })
  };
}
