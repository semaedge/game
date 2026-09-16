var LOGGER_CONTEXT_ = {};

class Middleware_Logger {
  static setContext(context) {
    LOGGER_CONTEXT_ = Middleware_Logger.sanitize_(context || {});
  }

  static clearContext() {
    LOGGER_CONTEXT_ = {};
  }

  static log(message, context) {
    return Middleware_Logger.write_('INFO', message, context);
  }

  static warn(message, context) {
    return Middleware_Logger.write_('WARN', message, context);
  }

  static error(message, context) {
    return Middleware_Logger.write_('ERROR', message, context);
  }

  static write_(level, message, context) {
    const parsed = Middleware_Logger.normalizeMessage_(message);
    const mergedContext = Object.assign(
      {},
      LOGGER_CONTEXT_,
      parsed.context || {},
      Middleware_Logger.sanitize_(context || {})
    );
    const entry = {
      timestamp: new Date().toISOString(),
      level: level,
      event: parsed.event || mergedContext.event || 'APPLICATION_LOG',
      message: Middleware_Logger.sanitizeText_(parsed.message).slice(0, 2000),
      requestId: mergedContext.requestId || '',
      userId: mergedContext.userId || '',
      context: mergedContext
    };

    const serialized = JSON.stringify(entry);
    if (level === 'ERROR') console.error(serialized);
    else if (level === 'WARN') console.warn(serialized);
    else console.log(serialized);

    if (Middleware_Logger.shouldPersist_(level)) {
      Middleware_Logger.persist_(entry);
    }
    return entry;
  }

  static normalizeMessage_(message) {
    if (message instanceof Error) {
      return {
        event: message.name || 'ERROR',
        message: message.message,
        context: { stack: String(message.stack || '').slice(0, 4000) }
      };
    }
    if (message && typeof message === 'object') {
      const sanitized = Middleware_Logger.sanitize_(message);
      return {
        event: sanitized.event || 'APPLICATION_LOG',
        message: sanitized.message || sanitized.event || JSON.stringify(sanitized),
        context: sanitized
      };
    }
    const text = Middleware_Logger.sanitizeText_(
      message === undefined || message === null ? '' : message
    );
    if (text.charAt(0) === '{') {
      try {
        return Middleware_Logger.normalizeMessage_(JSON.parse(text));
      } catch (error) {
        // Mantém o texto original quando não for JSON válido.
      }
    }
    return { event: 'APPLICATION_LOG', message: text, context: {} };
  }

  static shouldPersist_(level) {
    if (level === 'WARN' || level === 'ERROR') return true;
    try {
      return PropertiesService.getScriptProperties()
        .getProperty('PERSIST_INFO_LOGS') === 'true';
    } catch (error) {
      return false;
    }
  }

  static persist_(entry) {
    try {
      const properties = PropertiesService.getScriptProperties();
      const spreadsheetId = properties.getProperty(CONFIG_KEYS.spreadsheetId);
      if (!spreadsheetId) return false;
      const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(LOGS_SHEET_NAME);
      if (!sheet) return false;
      sheet.appendRow([
        entry.timestamp,
        entry.level,
        entry.event,
        entry.message,
        entry.requestId,
        entry.userId,
        JSON.stringify(entry.context).slice(0, 10000)
      ]);
      return true;
    } catch (error) {
      // Logging nunca deve interromper o fluxo principal nem gerar recursão.
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        event: 'LOGGER_PERSIST_FAILED',
        message: error.message
      }));
      return false;
    }
  }

  static getRecent(limit, level) {
    const size = Math.max(1, Math.min(Number(limit) || 100, 500));
    const sheet = DB_Core.getSheet(LOGS_SHEET_NAME);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    const startRow = Math.max(2, lastRow - size + 1);
    const rows = sheet.getRange(startRow, 1, lastRow - startRow + 1, 7).getValues();
    return rows.reverse().map(function(row) {
      return {
        timestamp: row[0],
        level: row[1],
        event: row[2],
        message: row[3],
        requestId: row[4],
        userId: row[5],
        context: row[6]
      };
    }).filter(function(entry) {
      return !level || entry.level === String(level).toUpperCase();
    });
  }

  static sanitize_(value, depth) {
    const currentDepth = depth || 0;
    if (currentDepth > 4) return '[MAX_DEPTH]';
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) {
      return value.slice(0, 50).map(function(item) {
        return Middleware_Logger.sanitize_(item, currentDepth + 1);
      });
    }
    if (typeof value === 'string') return Middleware_Logger.sanitizeText_(value);
    if (typeof value !== 'object') return value;
    const sanitized = {};
    Object.keys(value).slice(0, 50).forEach(function(key) {
      if (/password|token|secret|authorization|cookie/i.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = Middleware_Logger.sanitize_(value[key], currentDepth + 1);
      }
    });
    return sanitized;
  }

  static sanitizeText_(value) {
    return String(value || '')
      .replace(
        /\b(password|token|secret|authorization|cookie)\s*([:=])\s*[^\s,;]+/gi,
        '$1$2[REDACTED]'
      )
      .replace(/\bBearer\s+[A-Za-z0-9._~+\/=-]+/gi, 'Bearer [REDACTED]');
  }
}
