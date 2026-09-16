/** Backup operacional do Sema Edge.
 *
 * A restauração é sempre uma nova cópia, preservando a planilha ativa. O
 * teste de verificação compara a assinatura das abas e não altera produção.
 */
var SEMA_BACKUP_PREFIX_ = 'SemaEdge-backup-';
var SEMA_BACKUP_RETENTION_DAYS_ = 30;
var SEMA_MAX_BACKUPS_ = 20;

function semaBackupFolder_(sourceFile) {
  var configured = PropertiesService.getScriptProperties().getProperty('BACKUP_FOLDER_ID');
  if (configured) return DriveApp.getFolderById(configured);
  var parents = sourceFile.getParents();
  return parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
}

function semaSpreadsheetSignature_(spreadsheet) {
  return spreadsheet.getSheets().map(function(sheet) {
    return { name: sheet.getName(), rows: sheet.getLastRow(), columns: sheet.getLastColumn() };
  }).sort(function(left, right) { return left.name.localeCompare(right.name); });
}

function createSemaBackup_(metadata) {
  metadata = metadata || {};
  var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
  var source = DriveApp.getFileById(spreadsheet.getId());
  var timestamp = Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd-HHmmss');
  var backupName = SEMA_BACKUP_PREFIX_ + timestamp;
  
  if (metadata.type) {
    backupName += '-' + metadata.type;
  }
  
  var backup = source.makeCopy(backupName, semaBackupFolder_(source));
  
  // Adiciona descrição ao backup
  if (metadata.description) {
    backup.setDescription('Backup automático: ' + metadata.description + ' | ' + timestamp);
  }
  
  Middleware_Logger.log('Backup criado', {
    backupId: backup.getId(),
    backupName: backupName,
    type: metadata.type || 'manual',
    size: backup.getSize()
  });
  
  return backup;
}

/**
 * Serviço de backup aprimorado com múltiplas funcionalidades
 */
class BackupService {
  /**
   * Cria um backup manual da planilha
   */
  static createManualBackup(description) {
    assertAdminOperator_();
    
    var backup = createSemaBackup_({
      type: 'manual',
      description: description || 'Backup manual solicitado por administrador'
    });
    
    return {
      success: true,
      backupId: backup.getId(),
      backupName: backup.getName(),
      url: backup.getUrl(),
      message: 'Backup criado com sucesso'
    };
  }

  /**
   * Cria backup automático (chamado por triggers)
   */
  static createScheduledBackup() {
    var backup = createSemaBackup_({
      type: 'scheduled',
      description: 'Backup automático agendado'
    });
    
    // Remove backups antigos para não acumular
    BackupService.cleanOldBackups_();
    
    return {
      success: true,
      backupId: backup.getId(),
      backupName: backup.getName()
    };
  }

  /**
   * Lista todos os backups existentes
   */
  static listBackups(limit) {
    assertAdminOperator_();
    
    var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
    var source = DriveApp.getFileById(spreadsheet.getId());
    var folder = semaBackupFolder_(source);
    
    var files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
    var backups = [];
    
    while (files.hasNext() && (!limit || backups.length < limit)) {
      var file = files.next();
      var name = file.getName();
      
      if (name.indexOf(SEMA_BACKUP_PREFIX_) === 0) {
        backups.push({
          id: file.getId(),
          name: name,
          created: file.getDateCreated().toISOString(),
          lastModified: file.getLastUpdated().toISOString(),
          size: file.getSize(),
          url: file.getUrl(),
          description: file.getDescription()
        });
      }
    }
    
    // Ordena por data de criação (mais recente primeiro)
    backups.sort(function(a, b) {
      return new Date(b.created) - new Date(a.created);
    });
    
    return {
      success: true,
      count: backups.length,
      backups: backups
    };
  }

  /**
   * Remove backups antigos baseado em política de retenção
   */
  static cleanOldBackups_() {
    var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
    var source = DriveApp.getFileById(spreadsheet.getId());
    var folder = semaBackupFolder_(source);
    
    var files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
    var backups = [];
    
    while (files.hasNext()) {
      var file = files.next();
      if (file.getName().indexOf(SEMA_BACKUP_PREFIX_) === 0) {
        backups.push({
          file: file,
          created: file.getDateCreated()
        });
      }
    }
    
    // Ordena por data (mais antigo primeiro)
    backups.sort(function(a, b) {
      return a.created - b.created;
    });
    
    var now = new Date();
    var retentionMillis = SEMA_BACKUP_RETENTION_DAYS_ * 24 * 60 * 60 * 1000;
    var removed = 0;
    
    // Remove backups que excedem o limite ou são muito antigos
    for (var i = 0; i < backups.length; i++) {
      var shouldRemove = false;
      
      // Remove se exceder o número máximo
      if (backups.length - removed > SEMA_MAX_BACKUPS_) {
        shouldRemove = true;
      }
      
      // Remove se for mais antigo que o período de retenção
      var age = now - backups[i].created;
      if (age > retentionMillis) {
        shouldRemove = true;
      }
      
      if (shouldRemove) {
        backups[i].file.setTrashed(true);
        removed++;
        
        Middleware_Logger.log('Backup antigo removido', {
          backupName: backups[i].file.getName(),
          age: Math.floor(age / (24 * 60 * 60 * 1000)) + ' dias'
        });
      }
    }
    
    return removed;
  }

  /**
   * Restaura um backup específico (cria nova cópia)
   */
  static restoreBackup(backupId, newName) {
    assertAdminOperator_();
    
    try {
      var backupFile = DriveApp.getFileById(backupId);
      var targetName = newName || 'SemaEdge-restaurado-' + Date.now();
      
      var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
      var source = DriveApp.getFileById(spreadsheet.getId());
      var folder = semaBackupFolder_(source);
      
      var restored = backupFile.makeCopy(targetName, folder);
      
      Middleware_Logger.log('Backup restaurado', {
        backupId: backupId,
        restoredId: restored.getId(),
        restoredName: restored.getName()
      });
      
      return {
        success: true,
        restoredId: restored.getId(),
        restoredName: restored.getName(),
        url: restored.getUrl(),
        message: 'Backup restaurado com sucesso. Verifique a nova planilha criada.'
      };
    } catch (e) {
      Middleware_Logger.error('Erro ao restaurar backup: ' + e.message);
      return {
        success: false,
        message: 'Erro ao restaurar backup: ' + e.message
      };
    }
  }

  /**
   * Obtém estatísticas sobre o sistema de backup
   */
  static getBackupStats() {
    assertAdminOperator_();
    
    var listResult = BackupService.listBackups();
    
    if (!listResult.success || listResult.count === 0) {
      return {
        totalBackups: 0,
        oldestBackup: null,
        newestBackup: null,
        totalSize: 0
      };
    }
    
    var backups = listResult.backups;
    var totalSize = backups.reduce(function(sum, backup) {
      return sum + backup.size;
    }, 0);
    
    return {
      totalBackups: backups.length,
      oldestBackup: backups[backups.length - 1],
      newestBackup: backups[0],
      totalSize: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      retentionDays: SEMA_BACKUP_RETENTION_DAYS_,
      maxBackups: SEMA_MAX_BACKUPS_
    };
  }

  /**
   * Verifica integridade de um backup
   */
  static verifyBackupIntegrity(backupId) {
    assertAdminOperator_();
    
    try {
      var backupFile = DriveApp.getFileById(backupId);
      var backupSpreadsheet = SpreadsheetApp.openById(backupId);
      
      var signature = semaSpreadsheetSignature_(backupSpreadsheet);
      
      // Verifica se tem todas as abas esperadas
      var expectedSheets = [
        SETTINGS_SHEET_NAME,
        USERS_SHEET_NAME,
        SCORES_SHEET_NAME,
        PROGRESS_SHEET_NAME,
        ACHIEVEMENTS_SHEET_NAME
      ];
      
      var sheetNames = signature.map(function(s) { return s.name; });
      var missingSheets = expectedSheets.filter(function(name) {
        return sheetNames.indexOf(name) === -1;
      });
      
      var isValid = missingSheets.length === 0;
      
      return {
        success: true,
        isValid: isValid,
        backupName: backupFile.getName(),
        sheets: signature,
        missingSheets: missingSheets,
        message: isValid ? 'Backup íntegro' : 'Backup incompleto'
      };
    } catch (e) {
      return {
        success: false,
        isValid: false,
        message: 'Erro ao verificar backup: ' + e.message
      };
    }
  }
}

function verifySemaBackupRestore() {
  assertAdminOperator_();
  var backup = createSemaBackup_({ type: 'verification', description: 'Teste de verificação' });
  var source = SpreadsheetApp.openById(getSpreadsheetId_());
  var restored = backup.makeCopy('SemaEdge-restore-verification-' + Date.now(), semaBackupFolder_(DriveApp.getFileById(source.getId())));
  try {
    var expected = semaSpreadsheetSignature_(SpreadsheetApp.openById(backup.getId()));
    var actual = semaSpreadsheetSignature_(SpreadsheetApp.openById(restored.getId()));
    var valid = JSON.stringify(expected) === JSON.stringify(actual);
    if (!valid) throw new Error('A cópia restaurada diverge da estrutura do snapshot.');
    return { success: true, backupId: backup.getId(), restoredId: restored.getId(), sheets: actual.length };
  } finally {
    restored.setTrashed(true);
  }
}

/**
 * Handler para backup agendado (chamado por trigger)
 */
function scheduledBackupTask() {
  return BackupService.createScheduledBackup();
}

