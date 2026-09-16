// Email_Service.gs
//
// Funcionalidade Principal: Fornece um serviço para envio de e-mails, utilizando o MailApp do Google Apps Script.
//
// Integrações:
// - MailApp: Serviço nativo do Google Apps Script para envio de e-mails.
// - Template_Engine.gs: Pode ser usado para renderizar templates de e-mail HTML.
//
// Uso:
// Utilizado para enviar notificações aos usuários, como confirmações de registro, redefinições de senha ou alertas do sistema.
//
class Email_Service {
  /**
   * @param {Object=} options Extras do MailApp — hoje `attachments` e `name`.
   */
  static sendEmail(recipient, subject, body, isHtml = false, options = {}) {
    const target = Utils_String.normalizeEmail(recipient);
    if (!Utils_String.isValidEmail(target)) {
      Middleware_Logger.warn('Envio cancelado: destinatário inválido.', {
        event: 'EMAIL_INVALID_RECIPIENT'
      });
      return { success: false, code: 'INVALID_RECIPIENT', message: 'Destinatário inválido.' };
    }

    try {
      const message = {
        to: target,
        subject: String(subject || '').slice(0, 250),
        name: options.name || APP_NAME
      };
      if (isHtml) message.htmlBody = body;
      else message.body = body;
      if (Array.isArray(options.attachments) && options.attachments.length) {
        message.attachments = options.attachments;
      }

      MailApp.sendEmail(message);
      Middleware_Logger.log('E-mail enviado', {
        event: 'EMAIL_SENT',
        subject: message.subject,
        attachments: message.attachments ? message.attachments.length : 0
      });
      return { success: true, message: 'E-mail enviado com sucesso.' };
    } catch (e) {
      Middleware_Logger.error(`Erro ao enviar e-mail: ${e.message}`);
      return { success: false, code: 'EMAIL_FAILED', message: 'Erro ao enviar e-mail.' };
    }
  }

  static sendTemplatedEmail(recipient, subject, templateName, templateData) {
    try {
      const htmlBody = Template_Engine.render(templateName, templateData);
      return Email_Service.sendEmail(recipient, subject, htmlBody, true);
    } catch (e) {
      Middleware_Logger.error(`Erro ao enviar e-mail com template para ${recipient}: ${e.message}`);
      return { success: false, message: "Erro ao enviar e-mail com template." };
    }
  }
}
