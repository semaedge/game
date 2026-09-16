// Template_Engine.gs
//
// Funcionalidade Principal: Um motor de template simples para renderizar arquivos HTML com dados dinâmicos.
//
// Integrações:
// - HtmlService: Utiliza para criar objetos HtmlTemplate a partir de arquivos HTML.
//
// Uso:
// Permite a criação de páginas HTML dinâmicas ou corpos de e-mail HTML, injetando variáveis no template.
//
const TEMPLATE_ENGINE_ALLOWED_TEMPLATES = Object.freeze([
  'Template_Email_Alert',
  'Template_Email_Welcome'
]);

class Template_Engine {
  static render(templateName, data = {}) {
    if (TEMPLATE_ENGINE_ALLOWED_TEMPLATES.indexOf(templateName) === -1) {
      throw new Error('Template de e-mail não permitido.');
    }
    const template = HtmlService.createTemplateFromFile(templateName);
    // Copia os dados para o objeto template para que possam ser acessados no HTML
    for (const key in data) {
      template[key] = data[key];
    }
    return template.evaluate().getContent();
  }
}
