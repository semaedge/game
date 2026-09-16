// SchemaService.gs
//
// Funcionalidade Principal: Gerencia migrações de esquema de dados para as planilhas Google, garantindo que a estrutura das abas esteja sempre atualizada com a versão esperada do aplicativo.
//
// Integrações:
// - DB_Core.gs: Utiliza para acessar e modificar as planilhas.
// - DB_Settings.gs: Para armazenar a versão atual do esquema de dados.
// - Middleware_Logger.gs: Para registrar o status das migrações.
//
// Uso:
// Chamado na inicialização do aplicativo para verificar e aplicar migrações pendentes, como adicionar novas colunas ou abas.
//
class Migration_Manager {
  /**
   * Lista canônica de migrações. Também é lida pela avaliação de maturidade,
   * que compara a última versão declarada com a versão aplicada no esquema.
   */
  static migrations_() {
    return [
      { version: 1, description: "Criar aba de Configurações", func: Migration_Manager.createSettingsSheet },
      { version: 2, description: "Criar aba de Usuários", func: Migration_Manager.createUsersSheet },
      { version: 3, description: "Criar aba de Scores", func: Migration_Manager.createScoresSheet },
      { version: 4, description: "Criar aba de Logs de Auditoria", func: Migration_Manager.createAuditLogsSheet },
      { version: 5, description: "Criar aba de Progresso", func: Migration_Manager.createProgressSheet },
      { version: 6, description: "Criar aba de Conquistas", func: Migration_Manager.createAchievementsSheet },
      { version: 7, description: "Criar aba de Logs Estruturados", func: Migration_Manager.createSystemLogsSheet },
      { version: 8, description: "Criar aba de Analytics", func: Migration_Manager.createAnalyticsSheet },
      { version: 9, description: "Adicionar evidências de aprendizagem aos scores", func: Migration_Manager.addLearningEvidenceToScores },
      { version: 10, description: "Adicionar coluna de inventário aos usuários", func: Migration_Manager.addInventoryToUsers },
      { version: 11, description: "Adicionar duração das tentativas aos scores", func: Migration_Manager.addDurationToScores },
      { version: 12, description: "Adicionar coluna de esclarecimento do estudante aos scores", func: Migration_Manager.addExplanationToScores },
      { version: 13, description: "Adicionar coluna de revisão docente aos scores", func: Migration_Manager.addTeacherReviewToScores },
      { version: 14, description: "Adicionar coluna de devolutiva pedagógica aos scores", func: Migration_Manager.addStrategyFeedbackToScores },
    ];
  }

  static latestVersion() {
    return Migration_Manager.migrations_().reduce(function(highest, migration) {
      return Math.max(highest, migration.version);
    }, 0);
  }

  static runMigrations() {
    // Settings precisa existir antes de consultarmos a versão do esquema.
    Migration_Manager.createSettingsSheet();
    const currentSchemaVersion = Number(DB_Settings.getSetting("schemaVersion")) || 0;
    Middleware_Logger.log(`Versão atual do esquema: ${currentSchemaVersion}`);

    const migrations = Migration_Manager.migrations_();

    migrations.forEach(migration => {
      if (migration.version > currentSchemaVersion) {
        try {
          Middleware_Logger.log(`Executando migração v${migration.version}: ${migration.description}`);
          migration.func();
          DB_Settings.setSetting("schemaVersion", migration.version);
          Middleware_Logger.log(`Migração v${migration.version} concluída com sucesso.`);
        } catch (e) {
          Middleware_Logger.error(`Erro na migração v${migration.version}: ${e.message}`);
          throw new Error(`Falha na migração v${migration.version}.`);
        }
      }
    });
  }

  static createUsersSheet() {
    const spreadsheet = DB_Core.getSpreadsheet();
    if (!spreadsheet.getSheetByName(USERS_SHEET_NAME)) {
      const sheet = spreadsheet.insertSheet(USERS_SHEET_NAME);
      sheet.appendRow(["ID", "Username", "Password", "Email", "CreatedAt", "UpdatedAt"]);
    }
  }

  static createScoresSheet() {
    const spreadsheet = DB_Core.getSpreadsheet();
    if (!spreadsheet.getSheetByName(SCORES_SHEET_NAME)) {
      const sheet = spreadsheet.insertSheet(SCORES_SHEET_NAME);
       sheet.appendRow(["ID", "UserID", "Stage", "Score", "CreatedAt", "Plan", "Reflection", "Route", "Restarts", "DurationSeconds", "Explanation", "TeacherReview", "StrategyFeedback"]);
    }
  }

  static addLearningEvidenceToScores() {
    Migration_Manager.createScoresSheet();
    const sheet = DB_Core.getSpreadsheet().getSheetByName(SCORES_SHEET_NAME);
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missing = ["Plan", "Reflection", "Route", "Restarts"].filter(function(header) { return current.indexOf(header) === -1; });
    if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }

  static addInventoryToUsers() {
    Migration_Manager.createUsersSheet();
    const sheet = DB_Core.getSpreadsheet().getSheetByName(USERS_SHEET_NAME);
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Adiciona coluna Inventory se não existir
    if (current.indexOf('Inventory') === -1) {
      const newColumnIndex = current.length + 1;
      sheet.getRange(1, newColumnIndex).setValue('Inventory');
      
      // Inicializa inventário para usuários existentes
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const defaultInventory = JSON.stringify({ totalPoints: 0, items: [], badges: [], hints: 3 });
        const inventoryData = [];
        for (let i = 2; i <= lastRow; i++) {
          inventoryData.push([defaultInventory]);
        }
        sheet.getRange(2, newColumnIndex, inventoryData.length, 1).setValues(inventoryData);
      }
      
      Middleware_Logger.log('Coluna Inventory adicionada à aba Users', {
        rowsUpdated: lastRow - 1
      });
    }
  }

  static addDurationToScores() {
    Migration_Manager.createScoresSheet();
    const sheet = DB_Core.getSpreadsheet().getSheetByName(SCORES_SHEET_NAME);
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (current.indexOf('DurationSeconds') === -1) {
      sheet.getRange(1, current.length + 1).setValue('DurationSeconds');
    }
  }

  static addExplanationToScores() {
    Migration_Manager.createScoresSheet();
    const sheet = DB_Core.getSpreadsheet().getSheetByName(SCORES_SHEET_NAME);
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (current.indexOf('Explanation') === -1) {
      sheet.getRange(1, current.length + 1).setValue('Explanation');
    }
  }

  static addTeacherReviewToScores() {
    Migration_Manager.createScoresSheet();
    const sheet = DB_Core.getSpreadsheet().getSheetByName(SCORES_SHEET_NAME);
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (current.indexOf('TeacherReview') === -1) {
      sheet.getRange(1, current.length + 1).setValue('TeacherReview');
    }
  }

  static addStrategyFeedbackToScores() {
    Migration_Manager.createScoresSheet();
    const sheet = DB_Core.getSpreadsheet().getSheetByName(SCORES_SHEET_NAME);
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (current.indexOf('StrategyFeedback') === -1) {
      sheet.getRange(1, current.length + 1).setValue('StrategyFeedback');
    }
  }

  static createSettingsSheet() {
    const spreadsheet = DB_Core.getSpreadsheet();
    if (!spreadsheet.getSheetByName(SETTINGS_SHEET_NAME)) {
      const sheet = spreadsheet.insertSheet(SETTINGS_SHEET_NAME);
      sheet.appendRow(["Key", "Value"]);
    }
  }

  static createAuditLogsSheet() {
    const spreadsheet = DB_Core.getSpreadsheet();
    if (!spreadsheet.getSheetByName(AUDIT_LOGS_SHEET_NAME)) {
      const sheet = spreadsheet.insertSheet(AUDIT_LOGS_SHEET_NAME);
      sheet.appendRow(["Timestamp", "Username", "Action", "Details"]);
    }
  }

  static createProgressSheet() {
    const spreadsheet = DB_Core.getSpreadsheet();
    if (!spreadsheet.getSheetByName(PROGRESS_SHEET_NAME)) {
      const sheet = spreadsheet.insertSheet(PROGRESS_SHEET_NAME);
      sheet.appendRow(["UserID", "CurrentStage", "UnlockedStages", "UpdatedAt"]);
    }
  }

  static createAchievementsSheet() {
    const spreadsheet = DB_Core.getSpreadsheet();
    if (!spreadsheet.getSheetByName(ACHIEVEMENTS_SHEET_NAME)) {
      const sheet = spreadsheet.insertSheet(ACHIEVEMENTS_SHEET_NAME);
      sheet.appendRow(["UserID", "AchievementID", "Label", "UnlockedAt"]);
    }
  }

  static createSystemLogsSheet() {
    const spreadsheet = DB_Core.getSpreadsheet();
    if (!spreadsheet.getSheetByName(LOGS_SHEET_NAME)) {
      const sheet = spreadsheet.insertSheet(LOGS_SHEET_NAME);
      sheet.appendRow([
        "Timestamp",
        "Level",
        "Event",
        "Message",
        "RequestID",
        "UserID",
        "Context"
      ]);
    }
  }

  static createAnalyticsSheet() {
    const spreadsheet = DB_Core.getSpreadsheet();
    if (!spreadsheet.getSheetByName(ANALYTICS_SHEET_NAME)) {
      const sheet = spreadsheet.insertSheet(ANALYTICS_SHEET_NAME);
      sheet.appendRow([
        "Timestamp",
        "UserID",
        "EventType",
        "Category",
        "Action",
        "Label",
        "Value",
        "Metadata"
      ]);
    }
  }
}

var SchemaService = {
  montarOuRemontarPlanilhas: function(options) {
    options = options || {};
    var remount = options.mode === 'remontar' || options.remount === true;
    if (remount && options.confirmation !== 'REMONTAR_PLANILHAS') throw new Error('Confirme com REMONTAR_PLANILHAS.');
    var spreadsheet = DB_Core.getSpreadsheet();
    var definitions = [
      [SETTINGS_SHEET_NAME, ['Key', 'Value']],
      [USERS_SHEET_NAME, ['ID', 'Username', 'Password', 'Email', 'CreatedAt', 'UpdatedAt', 'Inventory']],
      [SCORES_SHEET_NAME, ['ID', 'UserID', 'Stage', 'Score', 'CreatedAt', 'Plan', 'Reflection', 'Route', 'Restarts', 'DurationSeconds', 'Explanation', 'TeacherReview', 'StrategyFeedback']],
      [AUDIT_LOGS_SHEET_NAME, ['Timestamp', 'Username', 'Action', 'Details']],
      [PROGRESS_SHEET_NAME, ['UserID', 'CurrentStage', 'UnlockedStages', 'UpdatedAt']],
      [ACHIEVEMENTS_SHEET_NAME, ['UserID', 'AchievementID', 'Label', 'UnlockedAt']],
      [LOGS_SHEET_NAME, ['Timestamp', 'Level', 'Event', 'Message', 'RequestID', 'UserID', 'Context']],
      [ANALYTICS_SHEET_NAME, ['Timestamp', 'UserID', 'EventType', 'Category', 'Action', 'Label', 'Value', 'Metadata']]
    ];
    var results = definitions.map(function(definition) {
      var sheet = spreadsheet.getSheetByName(definition[0]);
      var created = !sheet;
      if (!sheet) sheet = spreadsheet.insertSheet(definition[0]);
      if (remount) sheet.clear();
      var current = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
      var missing = definition[1].filter(function(header) { return current.indexOf(header) === -1; });
      if (remount || !current.length) sheet.getRange(1, 1, 1, definition[1].length).setValues([definition[1]]);
      else if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
      sheet.setFrozenRows(1);
      return { sheetName: definition[0], created: created, remounted: remount, columns: definition[1].length };
    });
    return { ok: true, mode: remount ? 'remontar' : 'montar', sheets: results };
  }
};

/** Executa diretamente a criação/migração das abas do Sema Edge. */
function setupSemaEdgeSchema(options) {
  return SchemaService.montarOuRemontarPlanilhas(options || {});
}

/** Popula duas linhas de demonstração por aba, sem substituir dados reais. */
function popularDadosSinteticosSemaEdge(options) {
  options = options || {};
  setupSemaEdgeSchema(options.schema || {});
  var ss = DB_Core.getSpreadsheet();
  var now = new Date().toISOString();
  var users = [
    { ID: 'synthetic-sema-user-01', Username: 'aluno01', Password: Auth_Core.hashPassword('senhafacil', 'seed-aluno01'), Email: 'aluno01@example.edu', CreatedAt: now, UpdatedAt: now },
    { ID: 'synthetic-sema-user-02', Username: 'aluno02', Password: Auth_Core.hashPassword('senhafacil2', 'seed-aluno02'), Email: 'aluno02@example.edu', CreatedAt: now, UpdatedAt: now }
  ];
  var rows = {};
  rows[USERS_SHEET_NAME] = users;
  rows[SCORES_SHEET_NAME] = users.map(function (u, i) { return { ID: 'synthetic-sema-score-0' + (i + 1), UserID: u.ID, Stage: i + 1, Score: 70 + i * 12, CreatedAt: now }; });
  rows[AUDIT_LOGS_SHEET_NAME] = [{ Timestamp: now, Username: 'aluno01', Action: 'SEED', Details: 'synthetic-1' }, { Timestamp: now, Username: 'aluno02', Action: 'SEED', Details: 'synthetic-2' }];
  rows[PROGRESS_SHEET_NAME] = users.map(function (u, i) { return { UserID: u.ID, CurrentStage: i + 1, UnlockedStages: JSON.stringify([1, i + 1]), UpdatedAt: now }; });
  rows[ACHIEVEMENTS_SHEET_NAME] = users.map(function (u, i) { return { UserID: u.ID, AchievementID: 'first-stage', Label: 'Primeiro passo', UnlockedAt: now }; });
  rows[LOGS_SHEET_NAME] = [{ Timestamp: now, Level: 'INFO', Event: 'SEED', Message: 'Linha sintética 1', RequestID: 'synthetic-1', UserID: users[0].ID, Context: '{}' }, { Timestamp: now, Level: 'INFO', Event: 'SEED', Message: 'Linha sintética 2', RequestID: 'synthetic-2', UserID: users[1].ID, Context: '{}' }];
  rows[ANALYTICS_SHEET_NAME] = users.map(function (u, i) { return { Timestamp: now, UserID: u.ID, EventType: 'lesson', Category: 'synthetic', Action: 'complete', Label: 'stage-' + (i + 1), Value: 1, Metadata: '{}' }; });
  rows[SETTINGS_SHEET_NAME] = [{ Key: 'seed_mode', Value: 'synthetic' }, { Key: 'default_stage', Value: '1' }];
  var definitions = [
    [SETTINGS_SHEET_NAME, ['Key', 'Value']], [USERS_SHEET_NAME, ['ID', 'Username', 'Password', 'Email', 'CreatedAt', 'UpdatedAt', 'Inventory']],
    [SCORES_SHEET_NAME, ['ID', 'UserID', 'Stage', 'Score', 'CreatedAt', 'Plan', 'Reflection', 'Route', 'Restarts', 'DurationSeconds', 'Explanation', 'TeacherReview', 'StrategyFeedback']], [AUDIT_LOGS_SHEET_NAME, ['Timestamp', 'Username', 'Action', 'Details']],
    [PROGRESS_SHEET_NAME, ['UserID', 'CurrentStage', 'UnlockedStages', 'UpdatedAt']], [ACHIEVEMENTS_SHEET_NAME, ['UserID', 'AchievementID', 'Label', 'UnlockedAt']],
    [LOGS_SHEET_NAME, ['Timestamp', 'Level', 'Event', 'Message', 'RequestID', 'UserID', 'Context']], [ANALYTICS_SHEET_NAME, ['Timestamp', 'UserID', 'EventType', 'Category', 'Action', 'Label', 'Value', 'Metadata']]
  ];
  var seeded = {};
  definitions.forEach(function (definition) {
    var name = definition[0], headers = definition[1], sheet = ss.getSheetByName(name);
    var keyIndex = 0, existing = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues() : [], known = {};
    existing.forEach(function (row) { known[String(row[keyIndex] || '')] = true; });
    var pending = (rows[name] || [{ ID: 'synthetic-sema-' + name + '-01' }, { ID: 'synthetic-sema-' + name + '-02' }]).filter(function (item, i) {
      var key = item[headers[keyIndex]] || ('synthetic-sema-' + name + '-0' + (i + 1));
      return !known[String(key)];
    }).map(function (item, i) { return headers.map(function (header) { return item[header] === undefined ? ('synthetic' + (i + 1)) : item[header]; }); });
    if (pending.length) sheet.getRange(sheet.getLastRow() + 1, 1, pending.length, headers.length).setValues(pending);
    seeded[name] = pending.length;
  });
  return { ok: true, synthetic: true, credentials: users.map(function (u) { return { username: u.Username, password: u.Password }; }), seeded: seeded };
}
