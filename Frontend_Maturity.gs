// Avaliação de maturidade e intuitividade do frontend do Sema Edge.
//
// Duas fontes de evidência, nenhuma delas declarativa:
//
//   1. Análise estática dos templates realmente servidos. O Apps Script lê os
//      próprios arquivos .html (Frontend_Source), então a avaliação inspeciona
//      o markup que o navegador recebe — incluindo o grafo de includes.
//   2. Medições de DOM coletadas das telas em execução (Frontend_Audit), com
//      rótulos de campo, nomes acessíveis, alvos de toque e overflow reais.
//
// Os estados seguem o mesmo contrato da avaliação do backend: pass, fail,
// warning e unknown. Pontos em 'unknown' — julgamento editorial, suíte
// automatizada inexistente ou tela ainda não amostrada — saem do denominador
// em vez de virarem falso positivo.

const FRONTEND_MATURITY_VERSION = '2.0.0';

class Frontend_Maturity {
  static assess(options) {
    const startedAt = new Date();
    const settings = options || {};
    Frontend_Source.resetCache();

    const context = {
      corpus: Frontend_Source.corpus(),
      audit: {
        coverage: Frontend_Audit.coverage(),
        aggregate: function(id) { return Frontend_Audit.aggregate(id); }
      }
    };

    const checks = Frontend_Maturity.definitions_().map(function(definition) {
      return Frontend_Maturity.runCheck_(definition, context);
    });

    const maturity = Frontend_Maturity.dimensionSummary_(checks, 'Maturidade');
    const intuitiveness = Frontend_Maturity.dimensionSummary_(checks, 'Intuitividade');
    const overallScore = Math.round((maturity.score + intuitiveness.score) / 2);
    const coverage = Frontend_Maturity.coverageOf_(checks);
    const level = Frontend_Maturity.resolveLevel_(
      Math.min(maturity.score, intuitiveness.score),
      coverage
    );

    const report = {
      success: true,
      frameworkVersion: FRONTEND_MATURITY_VERSION,
      overallScore: overallScore,
      level: level,
      maturity: maturity,
      intuitiveness: intuitiveness,
      coverage: coverage,
      categories: Frontend_Maturity.categorySummary_(checks),
      checks: checks,
      recommendations: Frontend_Maturity.prioritize_(checks),
      source: {
        templates: context.corpus.names.length,
        entryPoints: context.corpus.entryPoints.length,
        missingIncludes: context.corpus.missing.length,
        unreadableEntryPoints: context.corpus.unreadableEntryPoints
      },
      domSamples: context.audit.coverage,
      assessedAt: new Date().toISOString(),
      durationMs: new Date().getTime() - startedAt.getTime()
    };

    if (settings.persist === true) {
      try {
        DB_Settings.setSetting('frontendMaturityScore', maturity.score);
        DB_Settings.setSetting('frontendIntuitivenessScore', intuitiveness.score);
        DB_Settings.setSetting('frontendAssessmentLevel', level.name);
        DB_Settings.setSetting('frontendAssessmentCoverage', coverage);
        DB_Settings.setSetting('frontendAssessedAt', report.assessedAt);
      } catch (persistError) {
        Middleware_Logger.warn(
          'Não foi possível persistir a avaliação do frontend: ' + persistError.message
        );
      }
    }

    return report;
  }

  /**
   * Remove repetições preservando a ordem. Uma tela com cinco botões fora do
   * padrão deve aparecer uma vez na evidência, não cinco.
   */
  static distinct_(values) {
    const seen = {};
    return values.filter(function(value) {
      if (seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

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
      dimension: definition.dimension,
      category: definition.category,
      id: definition.id,
      title: definition.title,
      weight: definition.weight,
      earned: passed === true ? definition.weight : 0,
      status: status,
      severity: passed === true ? 'none' : definition.severity,
      verified: passed !== null,
      source: definition.source,
      evidence: outcome.evidence || '',
      recommendation: passed === true
        ? ''
        : (outcome.recommendation || definition.recommendation || '')
    };
  }

  // =================================================================== controles

  static definitions_() {
    return [
      // ------------------------------------------- Maturidade / Design system (20)
      {
        dimension: 'Maturidade', category: 'Design system', id: 'design_tokens',
        title: 'Tokens visuais centralizados', weight: 7, severity: 'medium', source: 'estático',
        recommendation: 'Mova as cores literais restantes para variáveis CSS em Styles_Main.',
        probe: Frontend_Maturity.probeDesignTokens_
      },
      {
        dimension: 'Maturidade', category: 'Design system', id: 'shared_components',
        title: 'Componentes visuais compartilhados', weight: 7, severity: 'medium', source: 'estático',
        recommendation: 'Extraia markup repetido para componentes incluídos por várias telas.',
        probe: Frontend_Maturity.probeSharedComponents_
      },
      {
        dimension: 'Maturidade', category: 'Design system', id: 'responsive_breakpoints',
        title: 'Breakpoints responsivos', weight: 6, severity: 'high', source: 'estático',
        recommendation: 'Defina adaptações para desktop, tablet e mobile nas folhas de estilo.',
        probe: Frontend_Maturity.probeBreakpoints_
      },

      // -------------------------------------------- Maturidade / Arquitetura (20)
      {
        dimension: 'Maturidade', category: 'Arquitetura', id: 'shared_shell',
        title: 'Shell de página compartilhado', weight: 6, severity: 'high', source: 'estático',
        recommendation: 'Faça todas as telas abrirem com include("Layout") e fecharem com Layout_End.',
        probe: Frontend_Maturity.probeSharedShell_
      },
      {
        dimension: 'Maturidade', category: 'Arquitetura', id: 'data_aware_router',
        title: 'Views consomem os dados do roteador', weight: 6, severity: 'high', source: 'estático',
        recommendation: 'Alinhe as variáveis injetadas por App.gs com as usadas no template.',
        probe: Frontend_Maturity.probeRouterData_
      },
      {
        dimension: 'Maturidade', category: 'Arquitetura', id: 'central_client_runtime',
        title: 'Runtime cliente centralizado', weight: 4, severity: 'medium', source: 'estático',
        recommendation: 'Mantenha os helpers globais definidos apenas em Scripts_Main.',
        probe: Frontend_Maturity.probeClientRuntime_
      },
      {
        dimension: 'Maturidade', category: 'Arquitetura', id: 'page_duplication',
        title: 'Baixa duplicação entre páginas', weight: 4, severity: 'medium', source: 'estático',
        recommendation: 'Extraia os blocos <style> embutidos das views para folhas compartilhadas.',
        probe: Frontend_Maturity.probePageDuplication_
      },

      // ----------------------------------------- Maturidade / Acessibilidade (25)
      {
        dimension: 'Maturidade', category: 'Acessibilidade', id: 'document_language',
        title: 'Idioma do documento definido', weight: 4, severity: 'high', source: 'estático',
        recommendation: 'Declare lang="pt-BR" no elemento html do shell.',
        probe: Frontend_Maturity.probeDocumentLanguage_
      },
      {
        dimension: 'Maturidade', category: 'Acessibilidade', id: 'skip_navigation',
        title: 'Atalho para conteúdo', weight: 4, severity: 'high', source: 'estático',
        recommendation: 'Inclua um skip-link apontando para o container principal.',
        probe: Frontend_Maturity.probeSkipLink_
      },
      {
        dimension: 'Maturidade', category: 'Acessibilidade', id: 'semantic_landmarks',
        title: 'Landmarks semânticos', weight: 5, severity: 'high', source: 'estático',
        recommendation: 'Use nav, main e footer no shell e seções semânticas nas telas.',
        probe: Frontend_Maturity.probeLandmarks_
      },
      {
        dimension: 'Maturidade', category: 'Acessibilidade', id: 'form_labels',
        title: 'Campos com rótulos explícitos', weight: 5, severity: 'high', source: 'estático + DOM',
        recommendation: 'Associe cada campo a um label[for] ou forneça aria-label.',
        probe: Frontend_Maturity.probeFormLabels_
      },
      {
        dimension: 'Maturidade', category: 'Acessibilidade', id: 'reduced_motion',
        title: 'Preferência de movimento reduzido', weight: 3, severity: 'medium', source: 'estático',
        recommendation: 'Respeite prefers-reduced-motion na folha global.',
        probe: Frontend_Maturity.probeReducedMotion_
      },
      {
        dimension: 'Maturidade', category: 'Acessibilidade', id: 'contrast_regression',
        title: 'Teste automatizado de contraste', weight: 4, severity: 'high', source: 'não observável',
        recommendation: 'Adicionar teste automatizado WCAG AA para texto, controles e estados interativos.',
        probe: Frontend_Maturity.probeContrastRegression_
      },

      // ---------------------------------------------- Maturidade / Qualidade (20)
      {
        dimension: 'Maturidade', category: 'Qualidade', id: 'loading_states',
        title: 'Estados de carregamento', weight: 4, severity: 'medium', source: 'estático',
        recommendation: 'Use setButtonLoading em toda tela que dispara chamadas assíncronas.',
        probe: Frontend_Maturity.probeLoadingStates_
      },
      {
        dimension: 'Maturidade', category: 'Qualidade', id: 'error_states',
        title: 'Estados de erro dedicados', weight: 4, severity: 'high', source: 'estático',
        recommendation: 'Mantenha telas 403, 404 e 500 com orientação de saída.',
        probe: Frontend_Maturity.probeErrorStates_
      },
      {
        dimension: 'Maturidade', category: 'Qualidade', id: 'empty_states',
        title: 'Estados vazios orientativos', weight: 4, severity: 'medium', source: 'estático',
        recommendation: 'Trate a lista vazia em toda tela que itera coleções.',
        probe: Frontend_Maturity.probeEmptyStates_
      },
      {
        dimension: 'Maturidade', category: 'Qualidade', id: 'template_integrity',
        title: 'Templates íntegros', weight: 4, severity: 'critical', source: 'estático',
        recommendation: 'Corrija os includes quebrados e os scriptlets desbalanceados.',
        probe: Frontend_Maturity.probeTemplateIntegrity_
      },
      {
        dimension: 'Maturidade', category: 'Qualidade', id: 'visual_regression',
        title: 'Regressão visual automatizada', weight: 4, severity: 'high', source: 'não observável',
        recommendation: 'Criar snapshots das rotas principais em desktop e mobile.',
        probe: Frontend_Maturity.probeVisualRegression_
      },

      // --------------------------------------- Maturidade / Manutenibilidade (15)
      {
        dimension: 'Maturidade', category: 'Manutenibilidade', id: 'modular_styles',
        title: 'Estilos organizados por responsabilidade', weight: 5, severity: 'medium', source: 'estático',
        recommendation: 'Separe os estilos em módulos por área da aplicação.',
        probe: Frontend_Maturity.probeModularStyles_
      },
      {
        dimension: 'Maturidade', category: 'Manutenibilidade', id: 'shared_utilities',
        title: 'Utilitários compartilhados', weight: 5, severity: 'medium', source: 'estático',
        recommendation: 'Centralize feedback, loading e navegação em utilitários reutilizados.',
        probe: Frontend_Maturity.probeSharedUtilities_
      },
      {
        dimension: 'Maturidade', category: 'Manutenibilidade', id: 'frontend_documentation',
        title: 'Documentação de componentes', weight: 5, severity: 'medium', source: 'estático',
        recommendation: 'Documentar tokens, componentes, variantes e exemplos de interação.',
        probe: Frontend_Maturity.probeDocumentation_
      },

      // ------------------------------------------ Intuitividade / Navegação (25)
      {
        dimension: 'Intuitividade', category: 'Navegação', id: 'global_navigation',
        title: 'Navegação global previsível', weight: 8, severity: 'high', source: 'estático',
        recommendation: 'Garanta que todas as telas carreguem a navegação principal.',
        probe: Frontend_Maturity.probeGlobalNavigation_
      },
      {
        dimension: 'Intuitividade', category: 'Navegação', id: 'current_location',
        title: 'Localização atual identificável', weight: 5, severity: 'medium', source: 'DOM',
        recommendation: 'Marque o item de menu da rota atual com aria-current="page".',
        probe: Frontend_Maturity.probeCurrentLocation_
      },
      {
        dimension: 'Intuitividade', category: 'Navegação', id: 'mobile_navigation',
        title: 'Menu móvel direto', weight: 5, severity: 'high', source: 'estático',
        recommendation: 'Ofereça um menu compacto com controle acessível em telas pequenas.',
        probe: Frontend_Maturity.probeMobileNavigation_
      },
      {
        dimension: 'Intuitividade', category: 'Navegação', id: 'protected_route_guidance',
        title: 'Rotas protegidas orientam o usuário', weight: 4, severity: 'high', source: 'estático',
        recommendation: 'Leve o usuário sem sessão ao login e mostre 403 em acesso negado.',
        probe: Frontend_Maturity.probeProtectedRoutes_
      },
      {
        dimension: 'Intuitividade', category: 'Navegação', id: 'breadcrumbs',
        title: 'Contexto em fluxos profundos', weight: 3, severity: 'low', source: 'estático',
        recommendation: 'Adicionar breadcrumb em administração, perfil e fluxos com mais de dois níveis.',
        probe: Frontend_Maturity.probeBreadcrumbs_
      },

      // -------------------------------------------- Intuitividade / Clareza (25)
      {
        dimension: 'Intuitividade', category: 'Clareza', id: 'clear_ctas',
        title: 'Ações principais evidentes', weight: 5, severity: 'high', source: 'DOM',
        recommendation: 'Destaque uma ação primária por tela.',
        probe: Frontend_Maturity.probeClearCtas_
      },
      {
        dimension: 'Intuitividade', category: 'Clareza', id: 'visual_hierarchy',
        title: 'Hierarquia visual consistente', weight: 5, severity: 'medium', source: 'DOM',
        recommendation: 'Inicie cada tela em H1 e evite saltos de nível de título.',
        probe: Frontend_Maturity.probeVisualHierarchy_
      },
      {
        dimension: 'Intuitividade', category: 'Clareza', id: 'page_context',
        title: 'Contexto textual da tela', weight: 5, severity: 'medium', source: 'DOM',
        recommendation: 'Inclua um texto curto explicando o objetivo de cada tela.',
        probe: Frontend_Maturity.probePageContext_
      },
      {
        dimension: 'Intuitividade', category: 'Clareza', id: 'plain_language',
        title: 'Mensagens em linguagem simples', weight: 5, severity: 'medium', source: 'editorial',
        recommendation: 'Revisar textos com usuários e registrar o resultado da revisão.',
        probe: Frontend_Maturity.probeEditorialReview_
      },
      {
        dimension: 'Intuitividade', category: 'Clareza', id: 'first_run_onboarding',
        title: 'Onboarding de primeira utilização', weight: 5, severity: 'high', source: 'estático',
        recommendation: 'Criar uma introdução curta ao objetivo, controles e sistema de pontuação.',
        probe: Frontend_Maturity.probeOnboarding_
      },

      // ---------------------------------------- Intuitividade / Consistência (20)
      {
        dimension: 'Intuitividade', category: 'Consistência', id: 'color_consistency',
        title: 'Cores com significado estável', weight: 5, severity: 'medium', source: 'estático',
        recommendation: 'Use os tokens semânticos de estado em vez de cores literais.',
        probe: Frontend_Maturity.probeColorConsistency_
      },
      {
        dimension: 'Intuitividade', category: 'Consistência', id: 'button_consistency',
        title: 'Botões e ações consistentes', weight: 5, severity: 'medium', source: 'estático',
        recommendation: 'Aplique as classes de botão padronizadas a todos os controles.',
        probe: Frontend_Maturity.probeButtonConsistency_
      },
      {
        dimension: 'Intuitividade', category: 'Consistência', id: 'form_consistency',
        title: 'Formulários consistentes', weight: 5, severity: 'medium', source: 'estático',
        recommendation: 'Padronize form-group, label e ação primária em todos os formulários.',
        probe: Frontend_Maturity.probeFormConsistency_
      },
      {
        dimension: 'Intuitividade', category: 'Consistência', id: 'theme_consistency',
        title: 'Identidade visual contínua', weight: 5, severity: 'medium', source: 'estático',
        recommendation: 'Faça todas as telas carregarem a folha de estilo global do shell.',
        probe: Frontend_Maturity.probeThemeConsistency_
      },

      // ------------------------------------------- Intuitividade / Feedback (15)
      {
        dimension: 'Intuitividade', category: 'Feedback', id: 'action_loading',
        title: 'Feedback durante ações', weight: 4, severity: 'high', source: 'DOM',
        recommendation: 'Garanta que o helper de carregamento esteja disponível em todas as telas.',
        probe: Frontend_Maturity.probeActionLoading_
      },
      {
        dimension: 'Intuitividade', category: 'Feedback', id: 'toast_feedback',
        title: 'Confirmação de resultado', weight: 4, severity: 'high', source: 'estático',
        recommendation: 'Use showServerMessage para confirmar sucesso e falha das ações.',
        probe: Frontend_Maturity.probeToastFeedback_
      },
      {
        dimension: 'Intuitividade', category: 'Feedback', id: 'inline_validation',
        title: 'Validação contextual no campo', weight: 4, severity: 'high', source: 'estático',
        recommendation: 'Exibir o erro junto ao campo e mover o foco para a primeira inconsistência.',
        probe: Frontend_Maturity.probeInlineValidation_
      },
      {
        dimension: 'Intuitividade', category: 'Feedback', id: 'required_fields',
        title: 'Obrigatoriedade evidente nos campos', weight: 3, severity: 'medium', source: 'DOM',
        recommendation: 'Marque os campos obrigatórios de forma perceptível antes do envio.',
        probe: Frontend_Maturity.probeRequiredFields_
      },

      // ------------------------------------------ Intuitividade / Eficiência (15)
      {
        dimension: 'Intuitividade', category: 'Eficiência', id: 'no_horizontal_overflow',
        title: 'Sem rolagem horizontal', weight: 5, severity: 'high', source: 'DOM',
        recommendation: 'Corrija os elementos que excedem a largura da viewport.',
        probe: Frontend_Maturity.probeOverflow_
      },
      {
        dimension: 'Intuitividade', category: 'Eficiência', id: 'keyboard_support',
        title: 'Atalhos de teclado relevantes', weight: 5, severity: 'medium', source: 'estático',
        recommendation: 'Aceite setas e WASD no jogo, além dos controles de toque.',
        probe: Frontend_Maturity.probeKeyboardSupport_
      },
      {
        dimension: 'Intuitividade', category: 'Eficiência', id: 'responsive_actions',
        title: 'Ações acessíveis em qualquer tela', weight: 5, severity: 'high', source: 'DOM',
        recommendation: 'Garanta alvos de toque de ao menos 40×40px nos controles visíveis.',
        probe: Frontend_Maturity.probeTouchTargets_
      }
    ];
  }

  // ============================================================ sondas estáticas

  static probeDesignTokens_(context) {
    const styles = Frontend_Source.read('Styles_Main');
    if (!styles) {
      return { passed: false, evidence: 'Styles_Main não pôde ser lido.' };
    }
    const tokens = Frontend_Source.allMatches(styles, /--([a-z0-9-]+)\s*:/gi);
    const unique = {};
    tokens.forEach(function(token) { unique[token.toLowerCase()] = true; });
    const tokenCount = Object.keys(unique).length;

    const usage = Frontend_Source.countMatches(Frontend_Source.combined(), /var\(--[a-z0-9-]+\)/gi);
    if (tokenCount < 8) {
      return {
        passed: false,
        evidence: 'Apenas ' + tokenCount + ' token(s) definidos em :root; o mínimo esperado é 8.'
      };
    }
    return {
      passed: true,
      evidence: tokenCount + ' tokens declarados em Styles_Main e ' + usage +
        ' referência(s) var(--token) no corpus.'
    };
  }

  static probeSharedComponents_(context) {
    const includedBy = context.corpus.includedBy;
    const reused = Object.keys(includedBy).filter(function(name) {
      return includedBy[name].length >= 2;
    });
    if (reused.length < 3) {
      return {
        passed: false,
        evidence: 'Apenas ' + reused.length + ' arquivo(s) são incluídos por mais de uma tela.'
      };
    }
    return {
      passed: true,
      evidence: reused.length + ' arquivos reutilizados por 2+ telas: ' +
        reused.slice(0, 6).join(', ') + '.'
    };
  }

  static probeBreakpoints_() {
    const widths = Frontend_Source.allMatches(
      Frontend_Source.combined(),
      /@media[^{]*\(\s*(?:max|min)-width\s*:\s*(\d+)px/gi
    );
    const unique = {};
    widths.forEach(function(width) { unique[width] = true; });
    const distinct = Object.keys(unique);

    if (distinct.length < 3) {
      return {
        passed: false,
        evidence: 'Apenas ' + distinct.length + ' breakpoint(s) distintos encontrados: ' +
          distinct.join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: distinct.length + ' breakpoints distintos em ' + widths.length +
        ' media queries: ' + distinct.sort(function(a, b) { return a - b; }).join('px, ') + 'px.'
    };
  }

  static probeSharedShell_(context) {
    const offenders = [];
    Frontend_Source.views().forEach(function(name) {
      const includes = context.corpus.includes[name] || [];
      if (includes.indexOf('Layout') === -1 || includes.indexOf('Layout_End') === -1) {
        offenders.push(name);
      }
    });

    if (offenders.length) {
      return {
        passed: false,
        evidence: 'Telas fora do shell padrão: ' + offenders.join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: 'As ' + Frontend_Source.views().length + ' telas abrem com Layout e fecham com Layout_End.'
    };
  }

  static probeRouterData_(context) {
    const routeData = Frontend_Source.routeData();
    const unused = [];
    let inspected = 0;

    Object.keys(routeData).forEach(function(template) {
      const content = context.corpus.files[template];
      if (!content) return;
      inspected += 1;
      routeData[template].forEach(function(variable) {
        const pattern = new RegExp('<\\?[^?]*\\b' + variable + '\\b');
        if (!pattern.test(content)) unused.push(template + '.' + variable);
      });
    });

    if (!inspected) {
      return { passed: null, evidence: 'Nenhum template com dados de rota pôde ser lido.' };
    }
    if (unused.length) {
      return {
        passed: false,
        evidence: 'Dados injetados e não consumidos pelo template: ' + unused.join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: inspected + ' templates consomem todas as variáveis que App.gs injeta.'
    };
  }

  static probeClientRuntime_(context) {
    const helpers = ['showServerMessage', 'setButtonLoading', 'redirectTo'];
    const runtime = Frontend_Source.read('Scripts_Main') || '';
    const missing = helpers.filter(function(helper) {
      return !new RegExp('function\\s+' + helper + '\\s*\\(').test(runtime);
    });

    if (missing.length) {
      return {
        passed: false,
        evidence: 'Helpers ausentes em Scripts_Main: ' + missing.join(', ') + '.'
      };
    }

    const redefinitions = [];
    context.corpus.names.forEach(function(name) {
      if (name === 'Scripts_Main') return;
      const content = context.corpus.files[name] || '';
      helpers.forEach(function(helper) {
        if (new RegExp('function\\s+' + helper + '\\s*\\(').test(content)) {
          redefinitions.push(name + ':' + helper);
        }
      });
    });

    if (redefinitions.length) {
      return {
        passed: false,
        evidence: 'Helpers redefinidos fora do runtime central: ' + redefinitions.join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: 'Os ' + helpers.length + ' helpers globais são definidos apenas em Scripts_Main.'
    };
  }

  static probePageDuplication_(context) {
    const views = Frontend_Source.views();
    const withInlineStyles = views.filter(function(name) {
      return Frontend_Source.blocks(context.corpus.files[name], 'style').length > 0;
    });
    const ratio = views.length ? withInlineStyles.length / views.length : 0;

    if (ratio > 0.5) {
      return {
        passed: false,
        evidence: withInlineStyles.length + ' de ' + views.length +
          ' telas trazem CSS embutido (' + Math.round(ratio * 100) + '%).'
      };
    }
    return {
      passed: true,
      evidence: 'Apenas ' + withInlineStyles.length + ' de ' + views.length +
        ' telas trazem CSS embutido (' + Math.round(ratio * 100) + '%).'
    };
  }

  static probeDocumentLanguage_() {
    const layout = Frontend_Source.read('Layout');
    if (!layout) return { passed: false, evidence: 'Layout não pôde ser lido.' };
    const match = layout.match(/<html[^>]*\slang\s*=\s*["']([^"']+)["']/i);
    if (!match) {
      return { passed: false, evidence: 'O elemento html do shell não declara lang.' };
    }
    return { passed: true, evidence: 'O shell declara lang="' + match[1] + '".' };
  }

  static probeSkipLink_() {
    const layout = Frontend_Source.read('Layout') || '';
    const skip = layout.match(/class\s*=\s*["'][^"']*skip-link[^"']*["'][^>]*href\s*=\s*["']#([^"']+)["']/i);
    if (!skip) {
      return { passed: false, evidence: 'Nenhum skip-link encontrado no shell.' };
    }
    const targetId = skip[1];
    if (!new RegExp('id\\s*=\\s*["\']' + targetId + '["\']').test(layout)) {
      return {
        passed: false,
        evidence: 'O skip-link aponta para #' + targetId + ', que não existe no shell.'
      };
    }
    return { passed: true, evidence: 'Skip-link do shell aponta para #' + targetId + ', presente na página.' };
  }

  static probeLandmarks_() {
    const shell = Frontend_Source.flatten('Index');
    const required = ['nav', 'main', 'footer'];
    const missing = required.filter(function(tag) {
      return !new RegExp('<' + tag + '[\\s>]', 'i').test(shell);
    });

    if (missing.length) {
      return { passed: false, evidence: 'Landmarks ausentes no shell: ' + missing.join(', ') + '.' };
    }
    return { passed: true, evidence: 'O shell renderiza nav, main e footer.' };
  }

  static probeFormLabels_(context) {
    const offenders = [];
    let totalFields = 0;
    let labeled = 0;

    Frontend_Source.views().forEach(function(name) {
      const content = Frontend_Source.withoutComments(context.corpus.files[name] || '');
      const fields = content.match(/<(?:input|select|textarea)\b[^>]*>/gi) || [];

      fields.forEach(function(field) {
        if (/type\s*=\s*["']hidden["']/i.test(field)) return;
        totalFields += 1;
        const idMatch = field.match(/\sid\s*=\s*["']([^"']+)["']/i);
        const hasAria = /\saria-label(?:ledby)?\s*=/i.test(field);
        const hasLabel = idMatch &&
          new RegExp('<label[^>]*\\sfor\\s*=\\s*["\']' + idMatch[1] + '["\']', 'i').test(content);
        if (hasAria || hasLabel) labeled += 1;
        else offenders.push(name + (idMatch ? '#' + idMatch[1] : ''));
      });
    });

    if (!totalFields) {
      return { passed: null, evidence: 'Nenhum campo de formulário encontrado nas telas.' };
    }
    if (offenders.length) {
      return {
        passed: false,
        evidence: labeled + ' de ' + totalFields + ' campos rotulados. Sem rótulo: ' +
          Frontend_Maturity.distinct_(offenders).slice(0, 6).join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: 'Os ' + totalFields + ' campos das telas possuem label[for] ou aria-label.'
    };
  }

  static probeReducedMotion_() {
    const combined = Frontend_Source.combined('Styles_');
    if (!/prefers-reduced-motion/i.test(combined)) {
      return { passed: false, evidence: 'Nenhuma regra prefers-reduced-motion nas folhas de estilo.' };
    }
    return { passed: true, evidence: 'As folhas de estilo respeitam prefers-reduced-motion.' };
  }

  static probeContrastRegression_() {
    return {
      passed: null,
      evidence: 'A existência de uma suíte automatizada de contraste não é observável pelo runtime do Apps Script.'
    };
  }

  static probeLoadingStates_(context) {
    const offenders = [];
    let asyncViews = 0;

    Frontend_Source.views().forEach(function(name) {
      const flattened = Frontend_Source.flatten(name);
      // Só as telas que disparam ações assíncronas precisam de estado de carregamento.
      const ownScripts = (context.corpus.includes[name] || [])
        .filter(function(target) { return target.indexOf('Scripts_') === 0; })
        .map(function(target) { return context.corpus.files[target] || ''; })
        .join('\n') + (context.corpus.files[name] || '');

      if (!/SemaAPI\.call\(/.test(ownScripts)) return;
      asyncViews += 1;
      // A capacidade é "comunicar carregamento", não uma grafia específica:
      // aceitar apenas setButtonLoading penalizaria quem usa o utilitário
      // compartilhado que já encapsula essa chamada.
      if (!/setButtonLoading\(|SemaUI\.withButton\(/.test(ownScripts)) offenders.push(name);
    });

    if (!asyncViews) {
      return { passed: null, evidence: 'Nenhuma tela dispara chamadas assíncronas para avaliar.' };
    }
    if (offenders.length) {
      return {
        passed: false,
        evidence: offenders.length + ' de ' + asyncViews +
          ' telas assíncronas não usam setButtonLoading: ' + offenders.join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: 'As ' + asyncViews + ' telas com chamadas assíncronas usam setButtonLoading.'
    };
  }

  static probeErrorStates_(context) {
    const pages = ['Error_403', 'Error_404', 'Error_500'];
    const missing = pages.filter(function(name) { return !context.corpus.files[name]; });
    if (missing.length) {
      return { passed: false, evidence: 'Telas de erro ausentes: ' + missing.join(', ') + '.' };
    }

    const withoutExit = pages.filter(function(name) {
      return !/<a\b[^>]*href/i.test(context.corpus.files[name]);
    });
    if (withoutExit.length) {
      return {
        passed: false,
        evidence: 'Telas de erro sem link de saída: ' + withoutExit.join(', ') + '.'
      };
    }
    return { passed: true, evidence: 'As telas 403, 404 e 500 existem e oferecem um caminho de volta.' };
  }

  static probeEmptyStates_(context) {
    const offenders = [];
    let listViews = 0;

    Frontend_Source.views().forEach(function(name) {
      const content = context.corpus.files[name] || '';
      if (!/\.forEach\s*\(/.test(content)) return;
      listViews += 1;
      const handlesEmpty = /\.length\s*===?\s*0|\.length\s*<\s*1|!\s*\w+\.length/.test(content) ||
        /Nenhum|Ainda não|vazio/i.test(content);
      if (!handlesEmpty) offenders.push(name);
    });

    if (!listViews) {
      return { passed: null, evidence: 'Nenhuma tela itera coleções para avaliar estado vazio.' };
    }
    if (offenders.length) {
      return {
        passed: false,
        evidence: offenders.length + ' de ' + listViews + ' telas com listas não tratam o caso vazio: ' +
          offenders.join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: 'As ' + listViews + ' telas que iteram coleções tratam a lista vazia.'
    };
  }

  static probeTemplateIntegrity_(context) {
    const problems = [];

    if (context.corpus.unreadableEntryPoints.length) {
      problems.push('telas do roteador ilegíveis: ' + context.corpus.unreadableEntryPoints.join(', '));
    }
    if (context.corpus.missing.length) {
      problems.push('includes quebrados: ' + context.corpus.missing.map(function(entry) {
        return entry.from + ' → ' + entry.target;
      }).join(', '));
    }

    const unbalanced = [];
    context.corpus.names.forEach(function(name) {
      const content = context.corpus.files[name] || '';
      const opening = Frontend_Source.countMatches(content, /<\?/g);
      const closing = Frontend_Source.countMatches(content, /\?>/g);
      if (opening !== closing) {
        unbalanced.push(name + ' (' + opening + ' aberturas / ' + closing + ' fechamentos)');
      }
    });
    if (unbalanced.length) problems.push('scriptlets desbalanceados: ' + unbalanced.join(', '));

    if (problems.length) {
      return { passed: false, evidence: problems.join('; ') + '.' };
    }
    return {
      passed: true,
      evidence: context.corpus.names.length + ' templates lidos, todos os includes resolvidos e scriptlets balanceados.'
    };
  }

  static probeVisualRegression_() {
    return {
      passed: null,
      evidence: 'A existência de uma suíte de screenshots por viewport não é observável pelo runtime do Apps Script.'
    };
  }

  static probeModularStyles_(context) {
    const styleFiles = context.corpus.names.filter(function(name) {
      return name.indexOf('Styles_') === 0;
    });
    if (styleFiles.length < 3) {
      return {
        passed: false,
        evidence: 'Apenas ' + styleFiles.length + ' módulo(s) de estilo alcançáveis pelo shell.'
      };
    }
    return {
      passed: true,
      evidence: styleFiles.length + ' módulos de estilo por responsabilidade: ' + styleFiles.join(', ') + '.'
    };
  }

  static probeSharedUtilities_(context) {
    const helpers = ['showServerMessage', 'setButtonLoading', 'redirectTo', 'SemaAPI'];
    const consumers = {};

    context.corpus.names.forEach(function(name) {
      if (name === 'Scripts_Main' || name === 'Scripts_Api_Client') return;
      const content = context.corpus.files[name] || '';
      helpers.forEach(function(helper) {
        if (content.indexOf(helper) !== -1) {
          consumers[helper] = (consumers[helper] || 0) + 1;
        }
      });
    });

    const unused = helpers.filter(function(helper) { return !consumers[helper]; });
    if (unused.length) {
      return { passed: false, evidence: 'Utilitários sem consumidores: ' + unused.join(', ') + '.' };
    }
    return {
      passed: true,
      evidence: helpers.map(function(helper) {
        return helper + ' (' + consumers[helper] + ')';
      }).join(', ') + ' — arquivos que consomem cada utilitário.'
    };
  }

  static probeDocumentation_() {
    const catalog = Frontend_Source.read('Docs_Components');
    if (!catalog) {
      return {
        passed: false,
        evidence: 'Nenhum catálogo de componentes (Docs_Components) encontrado no projeto.'
      };
    }
    return {
      passed: true,
      evidence: 'Catálogo de componentes disponível com ' + catalog.length + ' caracteres.'
    };
  }

  static probeGlobalNavigation_(context) {
    const offenders = Frontend_Source.views().filter(function(name) {
      return Frontend_Source.flatten(name).indexOf('class="navbar"') === -1;
    });
    if (offenders.length) {
      return {
        passed: false,
        evidence: 'Telas sem a navegação principal: ' + offenders.join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: 'As ' + Frontend_Source.views().length + ' telas carregam a mesma navegação global.'
    };
  }

  static probeMobileNavigation_() {
    const navbar = Frontend_Source.read('Component_Navbar') || '';
    const runtime = Frontend_Source.read('Scripts_Main') || '';
    const hasToggle = /class\s*=\s*["'][^"']*nav-toggle/i.test(navbar);
    const hasAria = /aria-expanded/i.test(navbar) && /aria-controls/i.test(navbar);
    const hasBreakpoint = /@media[^{]*max-width/i.test(navbar);
    const hasHandler = /nav-toggle/.test(runtime) && /addEventListener/.test(runtime);

    const missing = [];
    if (!hasToggle) missing.push('botão de menu');
    if (!hasAria) missing.push('aria-expanded/aria-controls');
    if (!hasBreakpoint) missing.push('media query para telas pequenas');
    if (!hasHandler) missing.push('handler de abertura no runtime');

    if (missing.length) {
      return { passed: false, evidence: 'Menu móvel incompleto: ' + missing.join(', ') + '.' };
    }
    return {
      passed: true,
      evidence: 'Menu compacto com botão acessível, breakpoint dedicado e handler de abertura.'
    };
  }

  static probeProtectedRoutes_(context) {
    const forbidden = context.corpus.files['Error_403'];
    const apiClient = Frontend_Source.read('Scripts_Api_Client') || '';
    const redirectsOnAuth = /redirectOnAuth|page=login/.test(apiClient);

    if (!forbidden) {
      return { passed: false, evidence: 'A tela 403 não existe.' };
    }
    if (!redirectsOnAuth) {
      return {
        passed: false,
        evidence: 'O cliente de API não redireciona ao login quando a sessão expira.'
      };
    }
    return {
      passed: true,
      evidence: 'Tela 403 disponível e o cliente de API leva ao login quando a sessão expira.'
    };
  }

  static probeBreadcrumbs_() {
    const combined = Frontend_Source.combined();
    if (!/breadcrumb/i.test(combined)) {
      return { passed: false, evidence: 'Nenhuma trilha de navegação encontrada no corpus.' };
    }
    return { passed: true, evidence: 'Trilha de navegação presente nas telas profundas.' };
  }

  static probeOnboarding_() {
    const combined = Frontend_Source.combined();
    if (!/onboarding|tutorial|primeiros-passos|first-run/i.test(combined)) {
      return {
        passed: false,
        evidence: 'Nenhum fluxo de introdução encontrado nos templates.'
      };
    }
    return { passed: true, evidence: 'Fluxo de introdução presente no frontend.' };
  }

  static probeColorConsistency_(context) {
    const stateTokens = ['--accent', '--warning', '--danger'];
    const styles = Frontend_Source.read('Styles_Main') || '';
    const undefinedTokens = stateTokens.filter(function(token) {
      return styles.indexOf(token + ':') === -1;
    });
    if (undefinedTokens.length) {
      return {
        passed: false,
        evidence: 'Tokens de estado não declarados: ' + undefinedTokens.join(', ') + '.'
      };
    }

    let literals = 0;
    const offenders = [];
    Frontend_Source.views().forEach(function(name) {
      const inline = Frontend_Source.blocks(context.corpus.files[name], 'style').join('\n');
      const found = Frontend_Source.countMatches(inline, /#[0-9a-f]{3,8}\b/gi);
      if (found > 0) {
        literals += found;
        offenders.push(name + ' (' + found + ')');
      }
    });

    if (literals > 12) {
      return {
        passed: false,
        evidence: literals + ' cores literais no CSS embutido das telas: ' + offenders.join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: 'Tokens de estado declarados e apenas ' + literals +
        ' cor(es) literal(is) no CSS embutido das telas.'
    };
  }

  static probeButtonConsistency_(context) {
    const offenders = [];
    let total = 0;
    let standardized = 0;

    Frontend_Source.views().forEach(function(name) {
      const content = Frontend_Source.withoutComments(context.corpus.files[name] || '');
      const buttons = content.match(/<button\b[^>]*>/gi) || [];
      buttons.forEach(function(button) {
        total += 1;
        if (/class\s*=\s*["'][^"']*\bbtn\b/i.test(button)) standardized += 1;
        else offenders.push(name);
      });
    });

    if (!total) {
      return { passed: null, evidence: 'Nenhum botão encontrado nas telas para avaliar.' };
    }
    if (standardized / total < 0.9) {
      return {
        passed: false,
        evidence: standardized + ' de ' + total + ' botões usam a classe padrão. Fora do padrão em: ' +
          Frontend_Maturity.distinct_(offenders).slice(0, 6).join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: standardized + ' de ' + total + ' botões das telas usam as classes padronizadas.'
    };
  }

  static probeFormConsistency_(context) {
    const offenders = [];
    let forms = 0;

    Frontend_Source.views().forEach(function(name) {
      const content = Frontend_Source.withoutComments(context.corpus.files[name] || '');
      const found = content.match(/<form\b[\s\S]*?<\/form>/gi) || [];
      found.forEach(function(form) {
        forms += 1;
        const hasGroup = /class\s*=\s*["'][^"']*form-group/i.test(form);
        const hasLabel = /<label\b/i.test(form);
        const hasPrimary = /class\s*=\s*["'][^"']*btn-primary/i.test(form);
        if (!hasGroup || !hasLabel || !hasPrimary) offenders.push(name);
      });
    });

    if (!forms) {
      return { passed: null, evidence: 'Nenhum formulário encontrado nas telas para avaliar.' };
    }
    if (offenders.length) {
      return {
        passed: false,
        evidence: offenders.length + ' de ' + forms +
          ' formulários fogem do padrão form-group + label + ação primária: ' +
          Frontend_Maturity.distinct_(offenders).join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: 'Os ' + forms + ' formulários seguem form-group, label e ação primária.'
    };
  }

  static probeThemeConsistency_(context) {
    const offenders = Frontend_Source.views().filter(function(name) {
      return Frontend_Source.flatten(name).indexOf('--accent') === -1;
    });
    if (offenders.length) {
      return {
        passed: false,
        evidence: 'Telas sem a folha de estilo global: ' + offenders.join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: 'As ' + Frontend_Source.views().length + ' telas carregam o mesmo tema pelo shell.'
    };
  }

  static probeToastFeedback_(context) {
    const consumers = context.corpus.names.filter(function(name) {
      return name !== 'Scripts_Main' &&
        (context.corpus.files[name] || '').indexOf('showServerMessage(') !== -1;
    });
    if (consumers.length < 3) {
      return {
        passed: false,
        evidence: 'Apenas ' + consumers.length + ' arquivo(s) confirmam resultado por toast.'
      };
    }
    return {
      passed: true,
      evidence: consumers.length + ' arquivos usam showServerMessage para confirmar sucesso e falha.'
    };
  }

  static probeInlineValidation_(context) {
    const combined = Frontend_Source.combined();
    const hasFieldError = /class\s*=\s*["'][^"']*field-error|aria-describedby\s*=|setCustomValidity\(/i.test(combined);
    const hasAriaInvalid = /aria-invalid/i.test(combined);

    if (!hasFieldError && !hasAriaInvalid) {
      return {
        passed: false,
        evidence: 'Nenhum mecanismo de erro por campo (field-error, aria-describedby, aria-invalid) encontrado.'
      };
    }
    if (!hasAriaInvalid) {
      return {
        passed: false,
        evidence: 'Há mensagens por campo, mas nenhum aria-invalid marca o campo inconsistente.'
      };
    }
    return { passed: true, evidence: 'Erros são exibidos junto ao campo e marcados com aria-invalid.' };
  }

  static probeKeyboardSupport_() {
    const game = Frontend_Source.read('Scripts_Game') || '';
    if (!/keydown|keyup/i.test(game)) {
      return { passed: false, evidence: 'Nenhum handler de teclado encontrado em Scripts_Game.' };
    }
    const arrows = /Arrow(Up|Down|Left|Right)/.test(game);
    const wasd = /\bKey[WASD]\b|['"][wasd]['"]/i.test(game);

    if (!arrows) {
      return { passed: false, evidence: 'O jogo não responde às teclas de seta.' };
    }
    return {
      passed: true,
      evidence: 'Scripts_Game trata teclado com setas' + (wasd ? ' e WASD' : '') + '.'
    };
  }

  // ================================================================ sondas de DOM

  /**
   * Converte um controle do auditor cliente em resultado, exigindo amostras
   * frescas. Sem amostra não há evidência — e sem evidência não há aprovação.
   */
  static fromDomSamples_(checkId, context, options) {
    const settings = options || {};
    const threshold = settings.threshold === undefined ? 1 : settings.threshold;
    const aggregate = context.audit.aggregate(checkId);

    if (!aggregate.observed) {
      return {
        passed: null,
        evidence: 'Nenhuma amostra de DOM disponível para este controle. ' +
          'Abra as telas como administrador para coletar medições.',
        recommendation: 'Percorra as telas principais com uma sessão administrativa para coletar amostras.'
      };
    }

    const percentage = Math.round(aggregate.ratio * 100);
    if (aggregate.ratio < threshold) {
      return {
        passed: false,
        evidence: percentage + '% de aproveitamento em ' + aggregate.observed +
          ' tela(s) medida(s). Pendências: ' + aggregate.failing.slice(0, 5).join(', ') + '.'
      };
    }
    return {
      passed: true,
      evidence: percentage + '% de aproveitamento em ' + aggregate.observed + ' tela(s) medida(s).'
    };
  }

  static probeCurrentLocation_(context) {
    return Frontend_Maturity.fromDomSamples_('active_navigation', context);
  }

  static probeClearCtas_(context) {
    return Frontend_Maturity.fromDomSamples_('primary_action', context);
  }

  static probeVisualHierarchy_(context) {
    return Frontend_Maturity.fromDomSamples_('heading_order', context);
  }

  static probePageContext_(context) {
    return Frontend_Maturity.fromDomSamples_('page_description', context);
  }

  static probeActionLoading_(context) {
    return Frontend_Maturity.fromDomSamples_('loading_runtime', context);
  }

  static probeRequiredFields_(context) {
    return Frontend_Maturity.fromDomSamples_('required_fields', context, { threshold: 0.9 });
  }

  static probeOverflow_(context) {
    return Frontend_Maturity.fromDomSamples_('overflow', context);
  }

  static probeTouchTargets_(context) {
    return Frontend_Maturity.fromDomSamples_('touch_targets', context, { threshold: 0.9 });
  }

  static probeEditorialReview_() {
    const reviewedAt = DB_Settings.getSetting('frontendCopyReviewAt');
    if (!reviewedAt) {
      return {
        passed: null,
        evidence: 'Clareza de texto exige julgamento humano; nenhuma revisão registrada.',
        recommendation: 'Revisar os textos com usuários e registrar a data com recordFrontendCopyReview().'
      };
    }
    const age = new Date().getTime() - new Date(reviewedAt).getTime();
    const days = Math.floor(age / 86400000);
    if (isNaN(age) || days > 180) {
      return {
        passed: false,
        evidence: 'A última revisão editorial foi há ' + days + ' dias.',
        recommendation: 'Repita a revisão de texto e registre a nova data.'
      };
    }
    return { passed: true, evidence: 'Revisão editorial registrada há ' + days + ' dia(s).' };
  }

  // ================================================================== agregação

  static coverageOf_(checks) {
    const total = checks.reduce(function(sum, check) { return sum + check.weight; }, 0);
    const verifiable = checks.reduce(function(sum, check) {
      return check.status === 'unknown' ? sum : sum + check.weight;
    }, 0);
    return total > 0 ? Math.round((verifiable / total) * 100) : 0;
  }

  static dimensionSummary_(checks, dimension) {
    const filtered = checks.filter(function(check) { return check.dimension === dimension; });
    const total = filtered.reduce(function(sum, check) { return sum + check.weight; }, 0);
    const verifiable = filtered.reduce(function(sum, check) {
      return check.status === 'unknown' ? sum : sum + check.weight;
    }, 0);
    const earned = filtered.reduce(function(sum, check) { return sum + check.earned; }, 0);

    return {
      name: dimension,
      score: verifiable > 0 ? Math.round((earned / verifiable) * 100) : 0,
      earnedPoints: earned,
      totalPoints: total,
      verifiablePoints: verifiable,
      unverifiedPoints: total - verifiable,
      coverage: total > 0 ? Math.round((verifiable / total) * 100) : 0,
      passed: filtered.filter(function(check) { return check.status === 'pass'; }).length,
      unverified: filtered.filter(function(check) { return check.status === 'unknown'; }).length,
      checks: filtered.length
    };
  }

  static categorySummary_(checks) {
    const grouped = {};
    checks.forEach(function(check) {
      const key = check.dimension + ':' + check.category;
      if (!grouped[key]) {
        grouped[key] = {
          dimension: check.dimension,
          name: check.category,
          earned: 0,
          total: 0,
          verifiable: 0
        };
      }
      grouped[key].earned += check.earned;
      grouped[key].total += check.weight;
      if (check.status !== 'unknown') grouped[key].verifiable += check.weight;
    });

    return Object.keys(grouped).map(function(key) {
      const category = grouped[key];
      category.score = category.verifiable > 0
        ? Math.round((category.earned / category.verifiable) * 100)
        : 0;
      return category;
    });
  }

  static prioritize_(checks) {
    const priority = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
    const statusRank = { fail: 3, warning: 2, unknown: 1 };
    return checks
      .filter(function(check) { return check.status !== 'pass'; })
      .sort(function(a, b) {
        return (statusRank[b.status] - statusRank[a.status]) ||
          (priority[b.severity] - priority[a.severity]) ||
          (b.weight - a.weight);
      })
      .map(function(check) {
        return {
          id: check.id,
          dimension: check.dimension,
          severity: check.severity,
          status: check.status,
          title: check.title,
          evidence: check.evidence,
          action: check.recommendation
        };
      });
  }

  static resolveLevel_(score, coverage) {
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

    // Cobertura baixa torna a nota pouco confiável para declarar níveis altos.
    const cappedByCoverage = coverage < 80 && resolved.index > 3;
    if (cappedByCoverage) resolved = levels[3];

    return {
      name: resolved.name,
      index: resolved.index,
      cappedByCoverage: cappedByCoverage
    };
  }
}

function runFrontendMaturityAssessment() {
  if (!Auth_Session.isAdmin()) {
    throw new Error('Acesso negado. Apenas administradores podem executar esta avaliação.');
  }
  return Frontend_Maturity.assess({ persist: true });
}

/**
 * Registra uma revisão editorial dos textos da interface.
 * Alimenta o controle "Mensagens em linguagem simples", que depende de
 * julgamento humano e não pode ser inferido do markup.
 */
function recordFrontendCopyReview() {
  assertAdminOperator_();
  const now = new Date().toISOString();
  DB_Settings.setSetting('frontendCopyReviewAt', now);
  Audit_Trail.logAction('FRONTEND_COPY_REVIEW_RECORDED', { reviewedAt: now });
  return { success: true, reviewedAt: now };
}
