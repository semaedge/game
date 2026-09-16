// DB_Core.gs
//
// Funcionalidade Principal: Fornece uma camada de abstração para interagir com o Google Sheets, facilitando operações CRUD (Criar, Ler, Atualizar, Deletar) de forma genérica.
//
// Integrações:
// - Config.gs: Utiliza o ID configurado e os nomes de abas definidos em `Config.gs`.
// - Google Sheets API: Interage diretamente com o serviço SpreadsheetApp do Google Apps Script.
//
// Uso:
// Esta classe oferece métodos estáticos para obter uma planilha, uma aba específica, ler todos os dados, adicionar uma nova linha, atualizar uma linha existente e deletar uma linha. É a base para todas as interações com o banco de dados (Google Sheet).
//
class DB_Core {
  static getSpreadsheet() {
    return SpreadsheetApp.openById(getSpreadsheetId_());
  }

  static getSheet(sheetName) {
    const spreadsheet = DB_Core.getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`A aba \'${sheetName}\' não foi encontrada.`);
    }
    return sheet;
  }

  static getAllData(sheetName) {
    const sheet = DB_Core.getSheet(sheetName);
    const range = sheet.getDataRange();
    return range.getValues();
  }

  static appendRow(sheetName, rowData) {
    const sheet = DB_Core.getSheet(sheetName);
    sheet.appendRow(rowData);
  }

  static updateRow(sheetName, rowIndex, rowData) {
    const sheet = DB_Core.getSheet(sheetName);
    const range = sheet.getRange(rowIndex + 1, 1, 1, rowData.length);
    range.setValues([rowData]);
  }

  static deleteRow(sheetName, rowIndex) {
    const sheet = DB_Core.getSheet(sheetName);
    sheet.deleteRow(rowIndex + 1);
  }

  static findRow(sheetName, columnIndex, searchValue) {
    const data = DB_Core.getAllData(sheetName);
    for (let i = 0; i < data.length; i++) {
      if (data[i][columnIndex] == searchValue) {
        return { rowIndex: i, rowData: data[i] };
      }
    }
    return null;
  }
}
