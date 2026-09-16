// Export_PDF.gs
//
// Funcionalidade Principal: Fornece funcionalidades para gerar documentos PDF a partir de conteúdo HTML ou dados de planilhas.
//
// Integrações:
// - Google Drive API: Para salvar os PDFs gerados no Google Drive.
// - HtmlService: Para converter HTML em PDF (indiretamente, via Google Drive).
// - Template_Engine.gs: Para renderizar templates HTML que serão convertidos em PDF.
//
// Uso:
// Pode ser usado para gerar relatórios, certificados ou outros documentos em PDF com base em dados do sistema.
//
class Export_PDF {
  static generatePdfFromHtml(htmlContent, filename = 'documento.pdf') {
    try {
      const blob = HtmlService.createHtmlOutput(htmlContent).getAs('application/pdf');
      blob.setName(filename);
      const folder = DriveApp.getRootFolder(); // Ou uma pasta específica
      const file = folder.createFile(blob);
      Middleware_Logger.log(`PDF gerado e salvo: ${filename} (ID: ${file.getId()})`);
      return { success: true, fileId: file.getId(), fileUrl: file.getUrl() };
    } catch (e) {
      Middleware_Logger.error(`Erro ao gerar PDF: ${e.message}`);
      return { success: false, message: 'Erro ao gerar PDF.' };
    }
  }

  static generatePdfFromSheet(sheetName, filename = 'relatorio.pdf') {
    try {
      const sheet = DB_Core.getSheet(sheetName);
      const blob = sheet.getAs('application/pdf');
      blob.setName(filename);
      const folder = DriveApp.getRootFolder();
      const file = folder.createFile(blob);
      Middleware_Logger.log(`PDF da planilha gerado e salvo: ${filename} (ID: ${file.getId()})`);
      return { success: true, fileId: file.getId(), fileUrl: file.getUrl() };
    } catch (e) {
      Middleware_Logger.error(`Erro ao gerar PDF da planilha ${sheetName}: ${e.message}`);
      return { success: false, message: 'Erro ao gerar PDF da planilha.' };
    }
  }
}
