class Analytics_Service {
  static isEnabled() {
    const value = PropertiesService.getScriptProperties().getProperty('ANALYTICS_ENABLED');
    return value !== 'false';
  }

  static trackPageView(pageName, metadata) {
    return Analytics_Service.writeEvent_({
      eventType: 'page_view',
      category: 'navigation',
      action: 'view',
      label: Analytics_Service.normalizeName_(pageName, 'page'),
      value: 1,
      metadata: metadata || {}
    });
  }

  static trackEvent(category, action, label, value, metadata) {
    return Analytics_Service.writeEvent_({
      eventType: 'event',
      category: Analytics_Service.normalizeName_(category, 'general'),
      action: Analytics_Service.normalizeName_(action, 'unknown'),
      label: String(label || '').slice(0, 200),
      value: Number.isFinite(Number(value)) ? Number(value) : 0,
      metadata: metadata || {}
    });
  }

  static writeEvent_(event) {
    if (!Analytics_Service.isEnabled()) return false;
    try {
      const user = Auth_Session.getSessionUser();
      const sheet = DB_Core.getSheet(ANALYTICS_SHEET_NAME);
      sheet.appendRow([
        new Date().toISOString(),
        user ? user.id : 'anonymous',
        event.eventType,
        event.category,
        event.action,
        Analytics_Service.safeCell_(event.label),
        event.value,
        JSON.stringify(Middleware_Logger.sanitize_(event.metadata || {})).slice(0, 10000)
      ]);
      return true;
    } catch (error) {
      Middleware_Logger.warn('Falha ao registrar analytics.', {
        event: 'ANALYTICS_WRITE_FAILED',
        reason: error.message,
        eventType: event.eventType
      });
      return false;
    }
  }

  static getSummary(days) {
    const periodDays = Math.max(1, Math.min(Number(days) || 30, 365));
    const cutoff = new Date().getTime() - periodDays * 24 * 60 * 60 * 1000;
    const data = DB_Core.getAllData(ANALYTICS_SHEET_NAME);
    const summary = {
      periodDays: periodDays,
      totalEvents: 0,
      pageViews: 0,
      uniqueUsers: 0,
      pages: {},
      actions: {}
    };
    const users = {};
    for (let i = 1; i < data.length; i++) {
      if (new Date(data[i][0]).getTime() < cutoff) continue;
      summary.totalEvents += 1;
      users[String(data[i][1])] = true;
      if (data[i][2] === 'page_view') {
        summary.pageViews += 1;
        summary.pages[data[i][5]] = (summary.pages[data[i][5]] || 0) + 1;
      }
      const actionKey = data[i][3] + ':' + data[i][4];
      summary.actions[actionKey] = (summary.actions[actionKey] || 0) + 1;
    }
    summary.uniqueUsers = Object.keys(users).length;
    summary.topPages = Analytics_Service.topEntries_(summary.pages, 10);
    summary.topActions = Analytics_Service.topEntries_(summary.actions, 10);
    return summary;
  }

  static pruneOlderThan(days) {
    const retentionDays = Math.max(30, Math.min(Number(days) || 180, 730));
    const cutoff = new Date().getTime() - retentionDays * 24 * 60 * 60 * 1000;
    const sheet = DB_Core.getSheet(ANALYTICS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let removed = 0;
    const ranges = [];
    let rangeEnd = null;
    let rangeStart = null;

    for (let i = data.length - 1; i >= 1; i--) {
      if (new Date(data[i][0]).getTime() < cutoff) {
        removed += 1;
        rangeStart = i + 1;
        if (rangeEnd === null) rangeEnd = i + 1;
      } else if (rangeStart !== null) {
        ranges.push({ start: rangeStart, count: rangeEnd - rangeStart + 1 });
        rangeStart = null;
        rangeEnd = null;
      }
    }
    if (rangeStart !== null) {
      ranges.push({ start: rangeStart, count: rangeEnd - rangeStart + 1 });
    }
    ranges.forEach(function(range) {
      sheet.deleteRows(range.start, range.count);
    });
    return { removed: removed, retentionDays: retentionDays };
  }

  static topEntries_(entries, limit) {
    return Object.keys(entries).map(function(key) {
      return { key: key, count: entries[key] };
    }).sort(function(a, b) {
      return b.count - a.count;
    }).slice(0, limit);
  }

  static normalizeName_(value, fallback) {
    const normalized = String(value || fallback || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (normalized || fallback || 'unknown').slice(0, 80);
  }

  static safeCell_(value) {
    const text = String(value || '').slice(0, 500);
    return /^[=+\-@]/.test(text) ? "'" + text : text;
  }
}
