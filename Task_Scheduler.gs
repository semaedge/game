/**
 * Gerencia apenas os gatilhos internos do Sema Edge.
 *
 * Os handlers precisam ser funções globais para que o Apps Script consiga
 * executá-los. A lista explícita evita gatilhos para funções arbitrárias.
 */
class Task_Scheduler {
  static managedJobs_() {
    return {
      scheduledCacheMaintenance: {
        name: 'cache_maintenance',
        description: 'Remove entradas expiradas e sessões antigas.',
        hour: 1
      },
      scheduledAnalyticsRetention: {
        name: 'analytics_retention',
        description: 'Aplica a política de retenção dos eventos analíticos.',
        hour: 2
      },
      scheduledBackupTask: {
        name: 'backup_task',
        description: 'Cria backup automático da planilha e limpa backups antigos.',
        hour: 3
      }
    };
  }

  static assertManagedHandler_(functionName) {
    const handler = String(functionName || '').trim();
    if (!Object.prototype.hasOwnProperty.call(this.managedJobs_(), handler)) {
      throw new Error('Tarefa agendada não reconhecida: ' + handler);
    }
    return handler;
  }

  static normalizeHour_(hour) {
    const parsed = Number(hour);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) {
      throw new Error('A hora do gatilho deve estar entre 0 e 23.');
    }
    return parsed;
  }

  static findTriggers_(functionName) {
    return ScriptApp.getProjectTriggers().filter(function(trigger) {
      return trigger.getHandlerFunction() === functionName;
    });
  }

  static describeTrigger_(trigger) {
    return {
      id: typeof trigger.getUniqueId === 'function' ? trigger.getUniqueId() : '',
      handler: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType ? trigger.getEventType() : ''),
      source: String(trigger.getTriggerSource ? trigger.getTriggerSource() : '')
    };
  }

  static createDailyTrigger(functionName, hour) {
    const handler = this.assertManagedHandler_(functionName);
    const normalizedHour = this.normalizeHour_(hour);
    const existing = this.findTriggers_(handler);

    if (existing.length > 0) {
      existing.slice(1).forEach(function(trigger) {
        ScriptApp.deleteTrigger(trigger);
      });
      return {
        created: false,
        trigger: this.describeTrigger_(existing[0]),
        duplicatesRemoved: Math.max(0, existing.length - 1)
      };
    }

    const trigger = ScriptApp.newTrigger(handler)
      .timeBased()
      .everyDays(1)
      .atHour(normalizedHour)
      .create();

    Middleware_Logger.log('Gatilho diário criado', {
      handler: handler,
      hour: normalizedHour
    });

    return {
      created: true,
      trigger: this.describeTrigger_(trigger),
      duplicatesRemoved: 0
    };
  }

  static createHourlyTrigger(functionName, intervalHours) {
    const handler = this.assertManagedHandler_(functionName);
    const interval = Number(intervalHours || 1);
    const supportedIntervals = [1, 2, 4, 6, 8, 12];

    if (supportedIntervals.indexOf(interval) === -1) {
      throw new Error('Intervalo inválido. Use 1, 2, 4, 6, 8 ou 12 horas.');
    }

    const existing = this.findTriggers_(handler);
    if (existing.length > 0) {
      existing.slice(1).forEach(function(trigger) {
        ScriptApp.deleteTrigger(trigger);
      });
      return {
        created: false,
        trigger: this.describeTrigger_(existing[0]),
        duplicatesRemoved: Math.max(0, existing.length - 1)
      };
    }

    const trigger = ScriptApp.newTrigger(handler)
      .timeBased()
      .everyHours(interval)
      .create();

    return {
      created: true,
      trigger: this.describeTrigger_(trigger),
      duplicatesRemoved: 0
    };
  }

  static setupInitialTriggers() {
    const jobs = this.managedJobs_();
    const results = Object.keys(jobs).map(function(handler) {
      const job = jobs[handler];
      return {
        name: job.name,
        handler: handler,
        result: Task_Scheduler.createDailyTrigger(handler, job.hour)
      };
    });

    return {
      configured: results.length,
      created: results.filter(function(item) {
        return item.result.created;
      }).length,
      jobs: results
    };
  }

  static listTriggers() {
    const jobs = this.managedJobs_();
    return ScriptApp.getProjectTriggers()
      .filter(function(trigger) {
        return Object.prototype.hasOwnProperty.call(
          jobs,
          trigger.getHandlerFunction()
        );
      })
      .map(this.describeTrigger_);
  }

  static deleteTrigger(functionName) {
    const handler = this.assertManagedHandler_(functionName);
    const triggers = this.findTriggers_(handler);
    triggers.forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
    return triggers.length;
  }

  static deleteAllTriggers() {
    const jobs = this.managedJobs_();
    const managedTriggers = ScriptApp.getProjectTriggers().filter(function(trigger) {
      return Object.prototype.hasOwnProperty.call(
        jobs,
        trigger.getHandlerFunction()
      );
    });

    managedTriggers.forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
    return managedTriggers.length;
  }

  static getStatus() {
    const jobs = this.managedJobs_();
    const active = this.listTriggers();
    const byHandler = {};
    active.forEach(function(trigger) {
      byHandler[trigger.handler] = (byHandler[trigger.handler] || 0) + 1;
    });

    return Object.keys(jobs).map(function(handler) {
      return {
        name: jobs[handler].name,
        handler: handler,
        description: jobs[handler].description,
        active: Boolean(byHandler[handler]),
        triggerCount: byHandler[handler] || 0
      };
    });
  }
}

/**
 * Handler global exigido pelos gatilhos do Apps Script.
 */
function scheduledCacheMaintenance() {
  const cacheResult = Cache_Manager.clearExpiredCache();
  const sessionsRemoved = Auth_Session.cleanupExpiredSessions_();
  Middleware_Logger.log('Manutenção agendada concluída', {
    cache: cacheResult,
    sessionsRemoved: sessionsRemoved
  });
  return {
    cache: cacheResult,
    sessionsRemoved: sessionsRemoved
  };
}

/**
 * Handler global de retenção de telemetria.
 */
function scheduledAnalyticsRetention() {
  const configuredDays = Number(
    PropertiesService.getScriptProperties().getProperty(
      'ANALYTICS_RETENTION_DAYS'
    ) || 180
  );
  const retentionDays = Math.max(30, Math.min(configuredDays || 180, 730));
  const result = Analytics_Service.pruneOlderThan(retentionDays);
  Middleware_Logger.log('Retenção de analytics concluída', {
    retentionDays: retentionDays,
    removed: result.removed
  });
  return result;
}

/**
 * Instala ou repara as tarefas. Execute manualmente uma vez no editor.
 */
function installScheduledTasks() {
  assertAdminOperator_();
  return Task_Scheduler.setupInitialTriggers();
}

function removeScheduledTasks() {
  assertAdminOperator_();
  return {
    removed: Task_Scheduler.deleteAllTriggers()
  };
}
