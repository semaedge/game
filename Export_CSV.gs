// Export_CSV.gs
//
// Funcionalidade Principal: Serialização de dados tabulares em CSV.
//
// Integrações:
// - DB_Core.gs: leitura das abas exportadas.
// - Service_Admin.gs: exportação administrativa de usuários.
// - Report_Generator.gs: monta relatórios sobre este serializador.
//
// Notas de correção nesta revisão:
// - Injeção de fórmula: uma célula iniciada por = + - @ (ou tab/CR) é
//   executada como fórmula ao abrir o arquivo no Excel ou no Sheets. Como a
//   exportação inclui campos preenchidos pelo usuário (nome, e-mail), um
//   cadastro com `=HYPERLINK(...)` virava fórmula ativa na máquina de quem
//   abrisse o relatório. Agora esses valores recebem um apóstrofo à frente.
// - Aspas: o código escapava as aspas internas mas só envolvia o campo quando
//   havia vírgula ou quebra de linha. Um valor com aspas e sem vírgula saía
//   malformado e desalinhava a coluna.
// - Terminador de linha: RFC 4180 exige CRLF.
// - Acentuação: sem BOM, o Excel lê UTF-8 como Latin-1 e "João" vira "JoÃ£o".
//
const EXPORT_CSV_DELIMITER = ',';
const EXPORT_CSV_LINE_BREAK = '\r\n';
const EXPORT_CSV_BOM = '﻿';
const EXPORT_CSV_FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

class Export_CSV {
  /**
   * Neutraliza a célula como fórmula sem alterar o texto lido pela pessoa.
   * O apóstrofo inicial é a mitigação padrão: Excel e Sheets passam a tratar
   * o conteúdo como texto literal.
   */
  static neutralizeFormula_(text) {
    if (!text) return text;
    const firstChar = text.charAt(0);
    return EXPORT_CSV_FORMULA_PREFIXES.indexOf(firstChar) === -1 ? text : "'" + text;
  }

  /**
   * Serializa uma célula conforme a RFC 4180.
   */
  static formatCell(value, delimiter) {
    const separator = delimiter || EXPORT_CSV_DELIMITER;
    const raw = value instanceof Date
      ? Utils_Date.formatTimestamp(value)
      : Utils_String.toText(value);
    const text = Export_CSV.neutralizeFormula_(raw);

    const needsQuotes = text.indexOf('"') !== -1 ||
      text.indexOf(separator) !== -1 ||
      text.indexOf('\n') !== -1 ||
      text.indexOf('\r') !== -1 ||
      text !== text.trim();

    return needsQuotes ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  /**
   * Converte uma matriz em texto CSV. Base de toda exportação do sistema.
   */
  static fromRows(rows, options) {
    const settings = options || {};
    const delimiter = settings.delimiter || EXPORT_CSV_DELIMITER;
    const matrix = Array.isArray(rows) ? rows : [];
    const body = matrix.map(function(row) {
      const cells = Array.isArray(row) ? row : [row];
      return cells.map(function(cell) {
        return Export_CSV.formatCell(cell, delimiter);
      }).join(delimiter);
    }).join(EXPORT_CSV_LINE_BREAK);

    const content = body ? body + EXPORT_CSV_LINE_BREAK : '';
    return settings.bom === false ? content : EXPORT_CSV_BOM + content;
  }

  static safeFilename(name, extension) {
    const slug = Utils_String.slugify(name) || 'exportacao';
    return slug + (extension || '.csv');
  }

  /**
   * Exporta uma aba inteira.
   */
  static exportSheetToCsv(sheetName, options) {
    try {
      const sheet = DB_Core.getSheet(sheetName);
      const values = sheet.getDataRange().getValues();
      return {
        success: true,
        data: Export_CSV.fromRows(values, options),
        filename: Export_CSV.safeFilename(sheetName),
        rows: Math.max(0, values.length - 1)
      };
    } catch (error) {
      Middleware_Logger.error('Erro ao exportar ' + sheetName + ' para CSV: ' + error.message);
      return { success: false, code: 'CSV_EXPORT_FAILED', message: 'Erro ao gerar CSV.' };
    }
  }

  /**
   * Exporta uma coleção de objetos usando um mapa de colunas explícito.
   * Evita vazar campos não previstos — uma exportação nunca deve carregar
   * colunas que ninguém declarou, como hash de senha.
   */
  static exportRecords(records, columns, filename, options) {
    try {
      const list = Array.isArray(records) ? records : [];
      const definitions = Array.isArray(columns) ? columns : [];
      if (!definitions.length) {
        throw new Error('Nenhuma coluna declarada para a exportação.');
      }

      const header = definitions.map(function(column) { return column.label || column.key; });
      const body = list.map(function(record) {
        return definitions.map(function(column) {
          const value = record ? record[column.key] : '';
          return typeof column.format === 'function' ? column.format(value, record) : value;
        });
      });

      return {
        success: true,
        data: Export_CSV.fromRows([header].concat(body), options),
        filename: Export_CSV.safeFilename(filename),
        rows: body.length
      };
    } catch (error) {
      Middleware_Logger.error('Erro ao exportar registros para CSV: ' + error.message);
      return { success: false, code: 'CSV_EXPORT_FAILED', message: 'Erro ao gerar CSV.' };
    }
  }
}
