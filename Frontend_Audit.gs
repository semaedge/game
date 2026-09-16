// Coleta e armazenamento das amostras de auditoria de interface.
//
// SemaFrontendAudit (Scripts_Frontend_Audit.html) mede o DOM já renderizado de
// cada tela: rótulos de campo, nomes acessíveis, alvos de toque, overflow
// horizontal, hierarquia de títulos e ação primária. Este módulo recebe essas
// medições e as guarda para que Frontend_Maturity avalie a intuitividade com
// base em telas reais, e não em afirmações sobre elas.
//
// As amostras são deduplicadas por tela + faixa de viewport: cada combinação
// mantém apenas a medição mais recente.

const FRONTEND_AUDIT_SETTING_KEY = 'frontendAuditSamples';
const FRONTEND_AUDIT_MAX_SAMPLES = 24;
const FRONTEND_AUDIT_FRESH_DAYS = 30;

class Frontend_Audit {
  static viewportBucket(width) {
    const value = Number(width) || 0;
    if (value <= 0) return 'desconhecido';
    if (value < 700) return 'mobile';
    if (value < 1100) return 'tablet';
    return 'desktop';
  }

  static load() {
    try {
      const raw = DB_Settings.getSetting(FRONTEND_AUDIT_SETTING_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  static save_(samples) {
    DB_Settings.setSetting(FRONTEND_AUDIT_SETTING_KEY, JSON.stringify(samples));
  }

  /**
   * Normaliza o relatório vindo do cliente. Nada é gravado sem passar por aqui:
   * o payload é dado externo e não pode definir a forma do que é armazenado.
   */
  static normalize_(report) {
    if (!report || typeof report !== 'object') {
      throw new Error('Relatório de auditoria inválido.');
    }

    const metrics = report.metrics || {};
    const viewportWidth = Number(metrics.viewportWidth) || 0;
    const checks = {};
    const rawChecks = Array.isArray(report.checks) ? report.checks.slice(0, 40) : [];

    rawChecks.forEach(function(check) {
      if (!check || !check.id) return;
      const id = String(check.id).slice(0, 40);
      const weight = Number(check.weight) || 0;
      const earned = Math.max(0, Math.min(Number(check.earned) || 0, weight));
      if (weight <= 0) return;
      checks[id] = {
        earned: earned,
        weight: weight,
        details: String(check.details || '').slice(0, 240)
      };
    });

    if (!Object.keys(checks).length) {
      throw new Error('Relatório de auditoria sem controles válidos.');
    }

    return {
      page: String(report.page || 'desconhecida').slice(0, 40).toLowerCase(),
      viewport: Frontend_Audit.viewportBucket(viewportWidth),
      viewportWidth: viewportWidth,
      score: Math.max(0, Math.min(Number(report.score) || 0, 100)),
      checks: checks,
      auditedAt: new Date().toISOString()
    };
  }

  static record(report) {
    const sample = Frontend_Audit.normalize_(report);
    const samples = Frontend_Audit.load().filter(function(existing) {
      return !(existing.page === sample.page && existing.viewport === sample.viewport);
    });

    samples.push(sample);
    samples.sort(function(a, b) {
      return new Date(b.auditedAt).getTime() - new Date(a.auditedAt).getTime();
    });

    Frontend_Audit.save_(samples.slice(0, FRONTEND_AUDIT_MAX_SAMPLES));
    return sample;
  }

  /**
   * Amostras dentro da janela de frescor. Medições antigas descrevem um
   * frontend que pode não existir mais.
   */
  static freshSamples() {
    const cutoff = new Date().getTime() - FRONTEND_AUDIT_FRESH_DAYS * 24 * 60 * 60 * 1000;
    return Frontend_Audit.load().filter(function(sample) {
      const timestamp = new Date(sample.auditedAt).getTime();
      return !isNaN(timestamp) && timestamp >= cutoff;
    });
  }

  /**
   * Agrega um controle do auditor cliente em todas as amostras frescas.
   */
  static aggregate(checkId) {
    const samples = Frontend_Audit.freshSamples();
    let earned = 0;
    let weight = 0;
    let observed = 0;
    const failing = [];

    samples.forEach(function(sample) {
      const check = sample.checks ? sample.checks[checkId] : null;
      if (!check) return;
      observed += 1;
      earned += check.earned;
      weight += check.weight;
      if (check.earned < check.weight) {
        failing.push(sample.page + ' (' + sample.viewport + ')');
      }
    });

    return {
      observed: observed,
      samples: samples.length,
      earned: earned,
      weight: weight,
      ratio: weight > 0 ? earned / weight : 0,
      failing: failing
    };
  }

  static coverage() {
    const samples = Frontend_Audit.freshSamples();
    const pages = {};
    const viewports = {};
    samples.forEach(function(sample) {
      pages[sample.page] = true;
      viewports[sample.viewport] = true;
    });
    return {
      samples: samples.length,
      pages: Object.keys(pages).sort(),
      viewports: Object.keys(viewports).sort(),
      total: Frontend_Audit.load().length
    };
  }

  static clear() {
    Frontend_Audit.save_([]);
  }
}

/**
 * Recebe uma amostra do auditor de interface do cliente.
 * Exposto ao roteador de API; exige sessão de administrador porque as amostras
 * alimentam um diagnóstico operacional.
 */
function submitFrontendAudit(report) {
  if (!Auth_Session.isAdmin()) {
    throw new Error('Acesso negado. Apenas administradores podem enviar amostras de auditoria.');
  }
  const sample = Frontend_Audit.record(report);
  return {
    success: true,
    data: {
      page: sample.page,
      viewport: sample.viewport,
      score: sample.score,
      coverage: Frontend_Audit.coverage()
    }
  };
}
