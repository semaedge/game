// Avaliação operacional de maturidade do backend do Sema Edge.
//
// Cada controle é verificado por uma sonda executada em runtime — nada é
// declarado como aprovado por convenção. Um controle pode terminar em três
// estados:
//
//   pass    — a sonda comprovou o comportamento esperado;
//   fail    — a sonda comprovou a ausência do comportamento (severidade crítica);
//   warning — a sonda comprovou a ausência do comportamento (demais severidades);
//   unknown — o estado não é observável em runtime (ex.: manifesto do projeto)
//             ou a própria sonda falhou. Pontos nesse estado saem do
//             denominador da nota e são reportados como cobertura pendente.
//
// Sondas que escrevem (auditoria, logs estruturados) só rodam quando
// options.writeProbes !== false, e sempre marcam suas entradas com o prefixo
// BACKEND_MATURITY_PROBE para serem distinguíveis do tráfego real.

const BACKEND_MATURITY_VERSION = '2.0.0';
const BACKEND_MATURITY_PROBE_TAG = 'BACKEND_MATURITY_PROBE';
const BACKEND_MATURITY_BACKUP_MAX_AGE_DAYS = 30;

class Backend_Maturity {
  static assess(options) {
    const startedAt = new Date();
    const settings = options || {};
    const health = backendHealth();
    const context = {
      health: health,
      missingSheets: health.missingSheets || [],
      configured: health.status !== 'not_configured',
      properties: PropertiesService.getScriptProperties(),
      writeProbes: settings.writeProbes !== false,
      now: startedAt.getTime()
    };

    const checks = Backend_Maturity.definitions_().map(function(definition) {
      return Backend_Maturity.runCheck_(definition, context);
    });

    const totalPoints = checks.reduce(function(sum, check) { return sum + check.weight; }, 0);
    const verifiablePoints = checks.reduce(function(sum, check) {
      return check.status === 'unknown' ? sum : sum + check.weight;
    }, 0);
    const earnedPoints = checks.reduce(function(sum, check) { return sum + check.earned; }, 0);
    const unverifiedPoints = totalPoints - verifiablePoints;
    const score = verifiablePoints > 0
      ? Math.round((earnedPoints / verifiablePoints) * 100)
      : 0;
    const coverage = totalPoints > 0
      ? Math.round((verifiablePoints / totalPoints) * 100)
      : 0;

    const criticalGaps = checks.filter(function(check) {
      return check.status === 'fail' || (check.status === 'warning' && check.severity === 'critical');
    });
    const level = Backend_Maturity.resolveLevel_(score, criticalGaps.length, coverage);
    const recommendations = Backend_Maturity.prioritize_(checks);

    const report = {
      success: true,
      frameworkVersion: BACKEND_MATURITY_VERSION,
      score: score,
      level: level,
      earnedPoints: earnedPoints,
      totalPoints: totalPoints,
      verifiablePoints: verifiablePoints,
      unverifiedPoints: unverifiedPoints,
      coverage: coverage,
      criticalGaps: criticalGaps.length,
      categories: Backend_Maturity.summarizeCategories_(checks),
      checks: checks,
      recommendations: recommendations,
      health: {
        status: health.status,
        missingSheets: context.missingSheets
      },
      writeProbes: context.writeProbes,
      assessedAt: new Date().toISOString(),
      durationMs: new Date().getTime() - startedAt.getTime()
    };

    if (settings.persist === true && context.configured) {
      try {
        DB_Settings.setSetting('backendMaturityScore', score);
        DB_Settings.setSetting('backendMaturityLevel', level.name);
        DB_Settings.setSetting('backendMaturityCoverage', coverage);
        DB_Settings.setSetting('backendMaturityAssessedAt', report.assessedAt);
      } catch (persistError) {
        Middleware_Logger.warn(
          'Não foi possível persistir a avaliação do backend: ' + persistError.message
        );
      }
    }

    return report;
  }

  /**
   * Executa uma sonda isolando falhas: qualquer exceção vira estado 'unknown'
   * para não mascarar um controle como aprovado nem derrubar a avaliação.
   */
  static runCheck_(definition, context) {
    let outcome;
    try {
      outcome = definition.probe(context) || {};
    } catch (probeError) {
      outcome = {
        passed: null,
        evidence: 'A sonda falhou: ' + probeError.message,
        recommendation: 'Investigue a falha da sonda antes de confiar nesta nota.'
      };
    }

    const passed = outcome.passed === true ? true : (outcome.passed === false ? false : null);
    let status;
    if (passed === true) status = 'pass';
    else if (passed === null) status = 'unknown';
    else status = definition.severity === 'critical' ? 'fail' : 'warning';

    return {
      category: definition.category,
      id: definition.id,
      title: definition.title,
      weight: definition.weight,
      earned: passed === true ? definition.weight : 0,
      status: status,
      severity: passed === true ? 'none' : definition.severity,
      verified: passed !== null,
      evidence: outcome.evidence || '',
      recommendation: passed === true
        ? ''
        : (outcome.recommendation || definition.recommendation || '')
    };
  }

  static definitions_() {
    return [
      // ---------------------------------------------------------------- Fundação (20)
      {
        category: 'Fundação',
        id: 'database_configured',
        title: 'Banco de dados configurado e acessível',
        weight: 5,
        severity: 'critical',
        recommendation: 'Execute setupBackend() e valide o acesso à planilha.',
        probe: Backend_Maturity.probeDatabase_
      },
      {
        category: 'Fundação',
        id: 'required_sheets',
        title: 'Esquema mínimo disponível',
        weight: 10,
        severity: 'critical',
        recommendation: 'Execute runMigrations() para recriar as abas ausentes.',
        probe: Backend_Maturity.probeRequiredSheets_
      },
      {
        category: 'Fundação',
        id: 'schema_version',
        title: 'Migrações aplicadas até a última versão',
        weight: 5,
        severity: 'high',
        recommendation: 'Execute runMigrations() e investigue qualquer falha registrada.',
        probe: Backend_Maturity.probeSchemaVersion_
      },

      // --------------------------------------------------------------- Segurança (25)
      {
        category: 'Segurança',
        id: 'admin_identity',
        title: 'Administrador configurado',
        weight: 5,
        severity: 'critical',
        recommendation: 'Defina um e-mail administrativo real nas propriedades do script.',
        probe: Backend_Maturity.probeAdminIdentity_
      },
      {
        category: 'Segurança',
        id: 'password_storage',
        title: 'Credenciais em texto plano (risco aceito)',
        weight: 8,
        severity: 'high',
        recommendation: 'Manter a planilha restrita e migrar para identidade gerenciada se o contexto supervisionado mudar.',
        probe: Backend_Maturity.probePasswordStorage_
      },
      {
        category: 'Segurança',
        id: 'session_expiration',
        title: 'Sessões expiradas são rejeitadas',
        weight: 6,
        severity: 'critical',
        recommendation: 'Garanta que Auth_Session valide expiresAt e descarte a sessão vencida.',
        probe: Backend_Maturity.probeSessionExpiration_
      },
      {
        category: 'Segurança',
        id: 'admin_guard',
        title: 'Operações administrativas protegidas',
        weight: 3,
        severity: 'high',
        recommendation: 'Adicione a verificação Auth_Session.isAdmin() nos endpoints administrativos desprotegidos.',
        probe: Backend_Maturity.probeAdminGuard_
      },
      {
        category: 'Segurança',
        id: 'frame_policy',
        title: 'Política de frames restritiva',
        weight: 3,
        severity: 'medium',
        recommendation: 'Evite XFrameOptionsMode.ALLOWALL nas respostas HTML.',
        probe: Backend_Maturity.probeFramePolicy_
      },

      // ---------------------------------------------------------- Confiabilidade (20)
      {
        category: 'Confiabilidade',
        id: 'migrations',
        title: 'Migrações versionadas e íntegras',
        weight: 5,
        severity: 'high',
        recommendation: 'Corrija a lista de migrações do Migration_Manager.',
        probe: Backend_Maturity.probeMigrations_
      },
      {
        category: 'Confiabilidade',
        id: 'locking',
        title: 'Proteção contra execução concorrente',
        weight: 4,
        severity: 'medium',
        recommendation: 'Verifique se algum processo mantém o LockService retido por tempo excessivo.',
        probe: Backend_Maturity.probeLocking_
      },
      {
        category: 'Confiabilidade',
        id: 'validation',
        title: 'Validação de entradas rejeita dados inválidos',
        weight: 4,
        severity: 'high',
        recommendation: 'Corrija as regras de Validation_User/Validation_Core reprovadas pela sonda.',
        probe: Backend_Maturity.probeValidation_
      },
      {
        category: 'Confiabilidade',
        id: 'error_boundary',
        title: 'Tratamento centralizado de erros',
        weight: 4,
        severity: 'high',
        recommendation: 'Garanta que Middleware_ErrorHandler.wrap converta exceções em resposta estruturada.',
        probe: Backend_Maturity.probeErrorBoundary_
      },
      {
        category: 'Confiabilidade',
        id: 'health_check',
        title: 'Health check operacional',
        weight: 3,
        severity: 'high',
        recommendation: 'Corrija as dependências indicadas pelo health check.',
        probe: Backend_Maturity.probeHealthCheck_
      },

      // --------------------------------------------------------- Observabilidade (20)
      {
        category: 'Observabilidade',
        id: 'cloud_logging',
        title: 'Registro no Cloud Logging',
        weight: 5,
        severity: 'medium',
        recommendation: 'Confirme exceptionLogging="STACKDRIVER" no appsscript.json pelo editor do Apps Script.',
        probe: Backend_Maturity.probeCloudLogging_
      },
      {
        category: 'Observabilidade',
        id: 'audit_storage',
        title: 'Trilha de auditoria gravável',
        weight: 5,
        severity: 'high',
        recommendation: 'Execute as migrações e valide a permissão de escrita na aba AuditLogs.',
        probe: Backend_Maturity.probeAuditStorage_
      },
      {
        category: 'Observabilidade',
        id: 'audit_events',
        title: 'Eventos sensíveis auditados',
        weight: 4,
        severity: 'medium',
        recommendation: 'Registre logins e operações administrativas via Audit_Trail.logAction().',
        probe: Backend_Maturity.probeAuditEvents_
      },
      {
        category: 'Observabilidade',
        id: 'structured_logs',
        title: 'Logs estruturados e persistentes',
        weight: 6,
        severity: 'high',
        recommendation: 'Execute as migrações e confirme a persistência de WARN/ERROR na aba de logs.',
        probe: Backend_Maturity.probeStructuredLogs_
      },

      // ----------------------------------------------------------------- Operação (15)
      {
        category: 'Operação',
        id: 'cache',
        title: 'Camada de cache funcional',
        weight: 3,
        severity: 'low',
        recommendation: 'Investigue falhas do CacheService ou do índice de cache.',
        probe: Backend_Maturity.probeCache_
      },
      {
        category: 'Operação',
        id: 'scheduled_jobs',
        title: 'Rotinas agendadas instaladas',
        weight: 4,
        severity: 'medium',
        recommendation: 'Execute installScheduledTasks() como administrador e monitore falhas.',
        probe: Backend_Maturity.probeScheduledJobs_
      },
      {
        category: 'Operação',
        id: 'backup_restore',
        title: 'Backup e restauração testados',
        weight: 5,
        severity: 'critical',
        recommendation: 'Crie snapshots periódicos e registre lastBackupAt/lastRestoreTestAt após cada teste.',
        probe: Backend_Maturity.probeBackupRestore_
      },
      {
        category: 'Operação',
        id: 'maintenance_tools',
        title: 'Ferramentas de manutenção disponíveis',
        weight: 3,
        severity: 'low',
        recommendation: 'Restaure as funções operacionais ausentes no projeto.',
        probe: Backend_Maturity.probeMaintenanceTools_
      }
    ];
  }

  // ------------------------------------------------------------------- Fundação

  static probeDatabase_(context) {
    const spreadsheetId = context.properties.getProperty(CONFIG_KEYS.spreadsheetId);
    if (!spreadsheetId) {
      return { passed: false, evidence: 'ID da planilha não configurado nas propriedades do script.' };
    }
    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      return {
        passed: true,
        evidence: 'Planilha "' + spreadsheet.getName() + '" aberta com sucesso pelo ID configurado.'
      };
    } catch (error) {
      return {
        passed: false,
        evidence: 'A planilha configurada não pôde ser aberta: ' + error.message,
        recommendation: 'Confirme o ID e as permissões de acesso da planilha.'
      };
    }
  }

  static probeRequiredSheets_(context) {
    if (!context.configured) {
      return { passed: false, evidence: 'Backend não configurado; o esquema não pôde ser inspecionado.' };
    }
    if (context.health.status === 'error') {
      return {
        passed: false,
        evidence: 'Falha ao inspecionar o esquema: ' + (context.health.message || 'erro desconhecido') + '.'
      };
    }
    if (context.missingSheets.length) {
      return { passed: false, evidence: 'Abas ausentes: ' + context.missingSheets.join(', ') + '.' };
    }
    return { passed: true, evidence: 'Todas as abas exigidas pelo health check estão presentes.' };
  }

  static probeSchemaVersion_(context) {
    if (!context.configured) {
      return { passed: null, evidence: 'Backend não configurado; a versão do esquema não é legível.' };
    }
    const expected = Migration_Manager.latestVersion();
    const applied = Number(DB_Settings.getSetting('schemaVersion')) || 0;
    return {
      passed: applied >= expected,
      evidence: 'Versão aplicada: ' + applied + '; última migração declarada: ' + expected + '.'
    };
  }

  // ------------------------------------------------------------------ Segurança

  static probeAdminIdentity_(context) {
    const adminEmail = context.properties.getProperty(CONFIG_KEYS.adminEmail);
    if (!adminEmail) {
      return { passed: false, evidence: 'Nenhum e-mail administrativo configurado.' };
    }
    if (String(adminEmail).toLowerCase() === 'admin@example.com') {
      return { passed: false, evidence: 'O e-mail administrativo ainda é o placeholder padrão.' };
    }
    if (!Utils_String.isValidEmail(adminEmail)) {
      return { passed: false, evidence: 'O e-mail administrativo configurado é inválido.' };
    }
    if (String(ADMIN_EMAIL).toLowerCase() !== String(adminEmail).toLowerCase()) {
      return {
        passed: false,
        evidence: 'A constante ADMIN_EMAIL divergiu da propriedade do script (execução iniciada antes da alteração).',
        recommendation: 'Reinicie a execução do script para recarregar ADMIN_EMAIL.'
      };
    }
    return { passed: true, evidence: 'Identidade administrativa configurada e consistente.' };
  }

  static probePasswordStorage_(context) {
    if (!context.configured || context.missingSheets.indexOf(USERS_SHEET_NAME) !== -1) {
      return { passed: null, evidence: 'Aba de usuários indisponível; as credenciais não puderam ser amostradas.' };
    }

    const rows = DB_Core.getAllData(USERS_SHEET_NAME).slice(1);
    const stored = rows
      .map(function(row) { return String(row[2] === undefined || row[2] === null ? '' : row[2]); })
      .filter(function(value) { return value.trim() !== ''; });

    if (!stored.length) {
      return { passed: null, evidence: 'Nenhuma credencial armazenada para amostrar.' };
    }

    const plaintext = stored.filter(function(value) {
      return !Backend_Maturity.looksHashed_(value);
    });

    if (plaintext.length === stored.length) {
      return {
        passed: true,
        evidence: plaintext.length + ' de ' + stored.length +
          ' credencial(is) em texto plano por decisão operacional; a aba deve permanecer restrita.'
      };
    }
    if (plaintext.length) {
      return {
        passed: false,
        evidence: plaintext.length + ' de ' + stored.length +
          ' credencial(is) estão em texto plano; normalize o formato antes de operar a frota.'
      };
    }
    return {
      passed: true,
      evidence: 'As ' + stored.length + ' credenciais amostradas estão em formato legado; a leitura permanece compatível.'
    };
  }

  /**
   * Reconhece dois formatos: digest hexadecimal de 64+ caracteres (SHA-256 em
   * diante) e o envelope com salt no padrão algoritmo$iterações$salt$hash.
   */
  static looksHashed_(value) {
    const normalized = String(value).trim();
    if (/^[a-f0-9]{64,}$/i.test(normalized)) return true;
    const parts = normalized.split('$');
    return parts.length >= 3 && parts[0].length > 0 && parts[parts.length - 1].length >= 16;
  }

  static probeSessionExpiration_() {
    const properties = PropertiesService.getScriptProperties();
    const validToken = 'maturity-probe-valid-' + Utilities.getUuid();
    const expiredToken = 'maturity-probe-expired-' + Utilities.getUuid();
    const validKey = Auth_Session.propertyKey_(validToken);
    const expiredKey = Auth_Session.propertyKey_(expiredToken);
    const now = new Date().getTime();

    function sessionPayload(expiresAt) {
      return JSON.stringify({
        userId: BACKEND_MATURITY_PROBE_TAG,
        username: BACKEND_MATURITY_PROBE_TAG,
        email: '',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(expiresAt).toISOString()
      });
    }

    try {
      properties.setProperty(validKey, sessionPayload(now + 60000));
      properties.setProperty(expiredKey, sessionPayload(now - 60000));

      const acceptsValid = Boolean(Auth_Session.getSessionUser(validToken));
      const rejectsExpired = Auth_Session.getSessionUser(expiredToken) === null;
      const purgesExpired = properties.getProperty(expiredKey) === null;

      if (acceptsValid && rejectsExpired && purgesExpired) {
        return {
          passed: true,
          evidence: 'Sessão válida aceita, sessão vencida rejeitada e removida do armazenamento.'
        };
      }
      const failures = [];
      if (!acceptsValid) failures.push('sessão válida rejeitada');
      if (!rejectsExpired) failures.push('sessão vencida aceita');
      if (!purgesExpired) failures.push('sessão vencida não removida');
      return { passed: false, evidence: 'Sonda de sessão reprovada: ' + failures.join('; ') + '.' };
    } finally {
      properties.deleteProperty(validKey);
      properties.deleteProperty(expiredKey);
    }
  }

  /**
   * Confirma que os endpoints administrativos negam acesso sem sessão de
   * administrador. O token da requisição é restaurado ao final.
   */
  static probeAdminGuard_() {
    const guarded = [
      { name: 'adminGetAllUsers', call: function() { return adminGetAllUsers(); } },
      { name: 'adminGetSettings', call: function() { return adminGetSettings(); } },
      { name: 'adminGetAuditLogs', call: function() { return adminGetAuditLogs(); } }
    ];
    const previousToken = ACTIVE_SESSION_TOKEN_;
    const unguarded = [];
    const inconclusive = [];

    try {
      Auth_Session.setRequestToken('');
      guarded.forEach(function(endpoint) {
        try {
          endpoint.call();
          unguarded.push(endpoint.name);
        } catch (error) {
          // Só uma negação de autorização comprova a proteção: uma falha de
          // infraestrutura também lança, mas não diz nada sobre o controle.
          if (!/acesso negado/i.test(String(error && error.message))) {
            inconclusive.push(endpoint.name + ' (' + error.message + ')');
          }
        }
      });
    } finally {
      Auth_Session.setRequestToken(previousToken);
    }

    if (unguarded.length) {
      return {
        passed: false,
        evidence: 'Endpoints acessíveis sem sessão de administrador: ' + unguarded.join(', ') + '.'
      };
    }
    if (inconclusive.length === guarded.length) {
      return {
        passed: null,
        evidence: 'Nenhum endpoint negou por autorização; todos falharam por outro motivo: ' +
          inconclusive.join('; ') + '.'
      };
    }
    return {
      passed: true,
      evidence: (guarded.length - inconclusive.length) + ' de ' + guarded.length +
        ' endpoints administrativos negaram acesso anônimo por autorização.'
    };
  }

  static probeFramePolicy_() {
    const policy = getSecurityHeaderPolicy();
    if (policy.xFrameOptionsMode === 'ALLOWALL') {
      return {
        passed: false,
        evidence: 'As respostas HTML usam XFrameOptionsMode.ALLOWALL, permitindo enquadramento por qualquer origem.'
      };
    }
    return {
      passed: true,
      evidence: 'Respostas HTML usam XFrameOptionsMode.' + policy.xFrameOptionsMode +
        ' e ' + policy.metaTags.length + ' meta tag(s) de compatibilidade.'
    };
  }

  // ------------------------------------------------------------- Confiabilidade

  static probeMigrations_() {
    const migrations = Migration_Manager.migrations_();
    if (!migrations.length) {
      return { passed: false, evidence: 'Nenhuma migração declarada no Migration_Manager.' };
    }

    const problems = [];
    const seen = {};
    migrations.forEach(function(migration, index) {
      if (typeof migration.func !== 'function') {
        problems.push('v' + migration.version + ' sem função executável');
      }
      if (seen[migration.version]) problems.push('versão duplicada v' + migration.version);
      seen[migration.version] = true;
      if (index > 0 && migration.version <= migrations[index - 1].version) {
        problems.push('v' + migration.version + ' fora de ordem');
      }
    });

    if (problems.length) {
      return { passed: false, evidence: 'Inconsistências: ' + problems.join('; ') + '.' };
    }
    return {
      passed: true,
      evidence: migrations.length + ' migrações versionadas, ordenadas e com handlers válidos.'
    };
  }

  static probeLocking_() {
    if (typeof setupBackend !== 'function' || typeof ensureBackendReady_ !== 'function') {
      return { passed: false, evidence: 'As rotinas de inicialização protegidas por lock não estão disponíveis.' };
    }
    const lock = LockService.getScriptLock();
    const acquired = lock.tryLock(2000);
    if (!acquired) {
      return {
        passed: false,
        evidence: 'O lock do script não pôde ser adquirido em 2s — há execução concorrente ou lock retido.'
      };
    }
    lock.releaseLock();
    return { passed: true, evidence: 'LockService disponível e liberado corretamente pela sonda.' };
  }

  static probeValidation_() {
    const cases = [
      {
        label: 'usuário curto',
        expectThrow: true,
        run: function() { return Validation_User.validateUsername('ab'); }
      },
      {
        label: 'usuário vazio',
        expectThrow: true,
        run: function() { return Validation_User.validateUsername(''); }
      },
      {
        label: 'senha curta',
        expectThrow: true,
        run: function() { return Validation_User.validatePassword('123'); }
      },
      {
        label: 'e-mail inválido',
        expectThrow: true,
        run: function() { return Validation_User.validateEmail('sem-arroba'); }
      },
      {
        label: 'registro válido',
        expectThrow: false,
        run: function() {
          return Validation_User.validateRegistration(
            'probe_user', 'probe-secret', 'probe@example.com'
          );
        }
      }
    ];

    const failures = [];
    cases.forEach(function(testCase) {
      let threw = false;
      let result = null;
      try {
        result = testCase.run();
      } catch (error) {
        threw = true;
      }
      if (testCase.expectThrow && !threw) failures.push(testCase.label + ' aceito indevidamente');
      if (!testCase.expectThrow && (threw || result !== true)) {
        failures.push(testCase.label + ' rejeitado indevidamente');
      }
    });

    if (failures.length) {
      return { passed: false, evidence: 'Casos reprovados: ' + failures.join('; ') + '.' };
    }
    return { passed: true, evidence: cases.length + ' casos de validação executados com o resultado esperado.' };
  }

  static probeErrorBoundary_() {
    const wrapped = Middleware_ErrorHandler.wrap(function backendMaturityProbe() {
      throw new Error(BACKEND_MATURITY_PROBE_TAG + ': exceção sintética de verificação.');
    });
    const result = wrapped();

    if (!result || result.success !== false || typeof result.message !== 'string') {
      return {
        passed: false,
        evidence: 'A exceção sintética não retornou uma resposta estruturada de falha.'
      };
    }
    if (result.message.indexOf(BACKEND_MATURITY_PROBE_TAG) !== -1) {
      return {
        passed: false,
        evidence: 'A resposta de erro vazou o detalhe interno da exceção para o cliente.',
        recommendation: 'Retorne uma mensagem genérica e mantenha o detalhe apenas no log.'
      };
    }
    return {
      passed: true,
      evidence: 'Exceção sintética convertida em resposta estruturada sem vazar detalhes internos.'
    };
  }

  static probeHealthCheck_(context) {
    if (typeof backendHealth !== 'function') {
      return { passed: false, evidence: 'A função backendHealth() não está disponível.' };
    }
    return {
      passed: context.health.status === 'ok',
      evidence: 'Estado reportado pelo health check: ' + context.health.status + '.'
    };
  }

  // ---------------------------------------------------------- Observabilidade

  static probeCloudLogging_() {
    return {
      passed: null,
      evidence: 'O manifesto appsscript.json não é legível em runtime; a configuração de logging não pode ser comprovada aqui.'
    };
  }

  static probeAuditStorage_(context) {
    if (!context.configured || context.missingSheets.indexOf(AUDIT_LOGS_SHEET_NAME) !== -1) {
      return { passed: false, evidence: 'A aba ' + AUDIT_LOGS_SHEET_NAME + ' não está disponível.' };
    }
    if (!context.writeProbes) {
      return {
        passed: null,
        evidence: 'Aba presente, mas a sonda de escrita está desativada nesta execução.'
      };
    }

    const sheet = DB_Core.getSheet(AUDIT_LOGS_SHEET_NAME);
    const before = sheet.getLastRow();
    Audit_Trail.logAction(BACKEND_MATURITY_PROBE_TAG, { check: 'audit_storage' });
    const after = DB_Core.getSheet(AUDIT_LOGS_SHEET_NAME).getLastRow();

    if (after <= before) {
      return { passed: false, evidence: 'A escrita de auditoria não produziu uma nova linha.' };
    }
    return {
      passed: true,
      evidence: 'Escrita de auditoria confirmada (linha ' + after + ' gravada pela sonda).'
    };
  }

  static probeAuditEvents_(context) {
    if (!context.configured || context.missingSheets.indexOf(AUDIT_LOGS_SHEET_NAME) !== -1) {
      return { passed: null, evidence: 'Aba de auditoria indisponível; os eventos não puderam ser amostrados.' };
    }

    const sheet = DB_Core.getSheet(AUDIT_LOGS_SHEET_NAME);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { passed: null, evidence: 'A trilha de auditoria ainda não possui registros para amostrar.' };
    }

    const startRow = Math.max(2, lastRow - 199);
    const actions = sheet.getRange(startRow, 3, lastRow - startRow + 1, 1)
      .getValues()
      .map(function(row) { return String(row[0] || ''); })
      .filter(function(action) { return action && action !== BACKEND_MATURITY_PROBE_TAG; });

    if (!actions.length) {
      return { passed: null, evidence: 'A amostra recente contém apenas registros da própria sonda.' };
    }

    const sensitive = {};
    actions.forEach(function(action) {
      if (/^(ADMIN_|USER_LOGIN|USER_LOGOUT|USER_DELETE|SETTINGS_)/.test(action)) {
        sensitive[action] = true;
      }
    });
    const distinct = Object.keys(sensitive);

    if (!distinct.length) {
      return {
        passed: false,
        evidence: 'Nenhuma das ' + actions.length + ' ações recentes corresponde a um evento sensível auditável.'
      };
    }
    return {
      passed: true,
      evidence: distinct.length + ' tipo(s) de evento sensível na amostra recente: ' +
        distinct.slice(0, 5).join(', ') + '.'
    };
  }

  static probeStructuredLogs_(context) {
    if (!context.configured || context.missingSheets.indexOf(LOGS_SHEET_NAME) !== -1) {
      return { passed: false, evidence: 'A aba ' + LOGS_SHEET_NAME + ' não está disponível.' };
    }
    if (!context.writeProbes) {
      return {
        passed: null,
        evidence: 'Aba presente, mas a sonda de escrita está desativada nesta execução.'
      };
    }

    const marker = BACKEND_MATURITY_PROBE_TAG + ':' + Utilities.getUuid();
    Middleware_Logger.warn(marker, {
      event: BACKEND_MATURITY_PROBE_TAG,
      requestId: marker,
      check: 'structured_logs'
    });

    const recent = Middleware_Logger.getRecent(100, 'WARN');
    const persisted = recent.filter(function(entry) {
      return String(entry.requestId || '') === marker || String(entry.message || '').indexOf(marker) !== -1;
    })[0];

    if (!persisted) {
      return { passed: false, evidence: 'O evento WARN sintético não foi encontrado na aba de logs.' };
    }
    const missingFields = ['timestamp', 'level', 'event', 'requestId'].filter(function(field) {
      return !persisted[field];
    });
    if (missingFields.length) {
      return {
        passed: false,
        evidence: 'Evento persistido sem os campos: ' + missingFields.join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: 'Evento WARN sintético persistido com nível, evento, requestId e contexto.'
    };
  }

  // ------------------------------------------------------------------ Operação

  static probeCache_() {
    const key = 'maturity:probe:' + Utilities.getUuid();
    const payload = { probe: true, at: new Date().getTime() };

    Cache_Manager.put(key, payload, 60);
    const roundTrip = Cache_Manager.get(key);
    if (!roundTrip || roundTrip.probe !== true || roundTrip.at !== payload.at) {
      Cache_Manager.remove(key);
      return { passed: false, evidence: 'O valor gravado no cache não retornou íntegro.' };
    }

    Cache_Manager.remove(key);
    if (Cache_Manager.get(key) !== null) {
      return { passed: false, evidence: 'A chave permaneceu no cache após a remoção.' };
    }
    return { passed: true, evidence: 'Ciclo gravar/ler/remover concluído com integridade do valor.' };
  }

  static probeScheduledJobs_() {
    const status = Task_Scheduler.getStatus();
    const inactive = status.filter(function(job) { return !job.active; });
    const duplicated = status.filter(function(job) { return job.triggerCount > 1; });

    if (inactive.length) {
      return {
        passed: false,
        evidence: 'Rotinas sem gatilho ativo: ' + inactive.map(function(job) { return job.name; }).join(', ') + '.'
      };
    }
    if (duplicated.length) {
      return {
        passed: false,
        evidence: 'Rotinas com gatilhos duplicados: ' + duplicated.map(function(job) { return job.name; }).join(', ') + '.',
        recommendation: 'Execute installScheduledTasks() para reconciliar os gatilhos duplicados.'
      };
    }
    return { passed: true, evidence: status.length + ' rotina(s) gerenciada(s) com exatamente um gatilho ativo.' };
  }

  static probeBackupRestore_(context) {
    if (!context.configured) {
      return { passed: null, evidence: 'Backend não configurado; o histórico de backup não é legível.' };
    }

    const maxAgeMs = BACKEND_MATURITY_BACKUP_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const lastBackup = Backend_Maturity.settingAgeMs_('lastBackupAt', context.now);
    const lastRestoreTest = Backend_Maturity.settingAgeMs_('lastRestoreTestAt', context.now);

    if (lastBackup === null && lastRestoreTest === null) {
      return {
        passed: false,
        evidence: 'Não há registro de backup nem de teste de restauração nas configurações.'
      };
    }
    const stale = [];
    if (lastBackup === null) stale.push('backup nunca registrado');
    else if (lastBackup > maxAgeMs) stale.push('último backup há ' + Math.floor(lastBackup / 86400000) + ' dias');
    if (lastRestoreTest === null) stale.push('teste de restauração nunca registrado');
    else if (lastRestoreTest > maxAgeMs) {
      stale.push('último teste de restauração há ' + Math.floor(lastRestoreTest / 86400000) + ' dias');
    }

    if (stale.length) {
      return { passed: false, evidence: 'Pendências: ' + stale.join('; ') + '.' };
    }
    return {
      passed: true,
      evidence: 'Backup e teste de restauração registrados nos últimos ' +
        BACKEND_MATURITY_BACKUP_MAX_AGE_DAYS + ' dias.'
    };
  }

  static settingAgeMs_(key, now) {
    const raw = DB_Settings.getSetting(key);
    if (!raw) return null;
    const timestamp = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
    if (isNaN(timestamp)) return null;
    return Math.max(0, now - timestamp);
  }

  static probeMaintenanceTools_() {
    // Referências diretas: o linker do Apps Script resolve as funções globais
    // em tempo de execução e `typeof` não lança se alguma delas sumir.
    const required = [
      { name: 'backendHealth', ref: typeof backendHealth },
      { name: 'setupBackend', ref: typeof setupBackend },
      { name: 'runMigrations', ref: typeof runMigrations },
      { name: 'installScheduledTasks', ref: typeof installScheduledTasks },
      { name: 'removeScheduledTasks', ref: typeof removeScheduledTasks },
      { name: 'recordBackendBackup', ref: typeof recordBackendBackup }
    ];
    const absent = required
      .filter(function(entry) { return entry.ref !== 'function'; })
      .map(function(entry) { return entry.name; });

    if (absent.length) {
      return { passed: false, evidence: 'Funções operacionais ausentes: ' + absent.join(', ') + '.' };
    }
    return { passed: true, evidence: 'As ' + required.length + ' rotinas de manutenção estão disponíveis.' };
  }

  // ------------------------------------------------------------------ Agregação

  static prioritize_(checks) {
    const priority = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
    return checks
      .filter(function(check) { return check.status !== 'pass'; })
      .sort(function(a, b) {
        const statusRank = { fail: 3, warning: 2, unknown: 1 };
        return (statusRank[b.status] - statusRank[a.status]) ||
          (priority[b.severity] - priority[a.severity]) ||
          (b.weight - a.weight);
      })
      .slice(0, 6)
      .map(function(check) {
        return {
          id: check.id,
          severity: check.severity,
          status: check.status,
          title: check.title,
          evidence: check.evidence,
          action: check.recommendation
        };
      });
  }

  static summarizeCategories_(checks) {
    const categories = {};
    checks.forEach(function(check) {
      if (!categories[check.category]) {
        categories[check.category] = {
          name: check.category,
          earned: 0,
          total: 0,
          verifiable: 0,
          unverified: 0,
          passed: 0,
          checks: 0
        };
      }
      const category = categories[check.category];
      category.earned += check.earned;
      category.total += check.weight;
      category.checks += 1;
      if (check.status === 'unknown') category.unverified += check.weight;
      else category.verifiable += check.weight;
      if (check.status === 'pass') category.passed += 1;
    });

    return Object.keys(categories).map(function(name) {
      const category = categories[name];
      category.score = category.verifiable > 0
        ? Math.round((category.earned / category.verifiable) * 100)
        : 0;
      return category;
    });
  }

  static resolveLevel_(score, criticalGapCount, coverage) {
    const levels = [
      { min: 0, name: 'Inicial', index: 0 },
      { min: 30, name: 'Básico', index: 1 },
      { min: 50, name: 'Gerenciado', index: 2 },
      { min: 70, name: 'Avançado', index: 3 },
      { min: 85, name: 'Otimizado', index: 4 }
    ];
    let resolved = levels[0];
    levels.forEach(function(level) {
      if (score >= level.min) resolved = level;
    });

    // Lacunas críticas limitam a maturidade máxima a "Gerenciado".
    const cappedByCriticalGaps = criticalGapCount > 0 && resolved.index > 2;
    if (cappedByCriticalGaps) resolved = levels[2];

    // Cobertura baixa torna a nota pouco confiável para declarar níveis altos.
    const cappedByCoverage = coverage < 80 && resolved.index > 3;
    if (cappedByCoverage) resolved = levels[3];

    return {
      name: resolved.name,
      index: resolved.index,
      cappedByCriticalGaps: criticalGapCount > 0,
      cappedByCoverage: cappedByCoverage
    };
  }
}

function runBackendMaturityAssessment() {
  if (!Auth_Session.isAdmin()) {
    throw new Error('Acesso negado. Apenas administradores podem executar esta avaliação.');
  }
  return Backend_Maturity.assess({ persist: true });
}

/**
 * Registra a execução de um backup e, opcionalmente, de um teste de
 * restauração. Alimenta o controle "Backup e restauração testados".
 */
function recordBackendBackup(restoreTested) {
  assertAdminOperator_();
  const now = new Date().toISOString();
  DB_Settings.setSetting('lastBackupAt', now);
  if (restoreTested === true) {
    DB_Settings.setSetting('lastRestoreTestAt', now);
  }
  Audit_Trail.logAction('BACKEND_BACKUP_RECORDED', { restoreTested: restoreTested === true });
  return {
    success: true,
    lastBackupAt: now,
    lastRestoreTestAt: DB_Settings.getSetting('lastRestoreTestAt') || null
  };
}
