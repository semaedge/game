// DB_Settings.gs
//
// Funcionalidade Principal: Gerencia as configurações gerais do aplicativo armazenadas em uma planilha Google.
//
// Integrações:
// - DB_Core.gs: Utiliza as funções genéricas de CRUD da camada de banco de dados.
// - Config.gs: Obtém o nome da aba de configurações (SETTINGS_SHEET_NAME).
//
// Uso:
// Permite ler e atualizar configurações como o status do jogo, mensagens de boas-vindas, etc.
//
class DB_Settings {
  static getSetting(key) {
    const result = DB_Core.findRow(SETTINGS_SHEET_NAME, 0, key); // Coluna 0 para a chave da configuração
    if (result) {
      return result.rowData[1]; // Coluna 1 para o valor da configuração
    }
    return null;
  }

  static setSetting(key, value) {
    const result = DB_Core.findRow(SETTINGS_SHEET_NAME, 0, key);
    if (result) {
      const rowData = result.rowData;
      rowData[1] = value;
      DB_Core.updateRow(SETTINGS_SHEET_NAME, result.rowIndex, rowData);
    } else {
      DB_Core.appendRow(SETTINGS_SHEET_NAME, [key, value]);
    }
  }
}
