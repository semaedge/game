// Tabela de rotas do web app.
//
// Fonte única de verdade sobre as telas: qual template renderiza cada página,
// que nível de acesso ela exige e quais dados o servidor injeta nela. Antes
// isso vivia espalhado num switch, numa lista solta de páginas privadas e em
// verificações de admin repetidas caso a caso — três lugares que precisavam
// concordar entre si.
//
// Consumidores:
// - App.gs (doGet) resolve, autoriza e renderiza a partir daqui;
// - Frontend_Source.gs deriva daqui os pontos de entrada e os dados de rota
//   usados na avaliação de maturidade do frontend.
//
// Níveis de acesso:
//   public — qualquer visitante;
//   user   — exige sessão ativa; sem sessão, cai no login;
//   admin  — exige sessão administrativa; sem sessão vai ao login e, com
//            sessão não administrativa, recebe 403.

const ROUTER_LOGIN_TEMPLATE = 'View_Login';
const ROUTER_FORBIDDEN_TEMPLATE = 'Error_403';
const ROUTER_NOT_FOUND_TEMPLATE = 'Error_404';
const ROUTER_ERROR_TEMPLATE = 'Error_500';

class Router_Pages {
  /**
   * `provides` declara as variáveis que o template recebe. É verificado contra
   * o retorno real de `data` a cada renderização, então a declaração não pode
   * silenciosamente divergir da implementação.
   */
  static routes() {
    return {
      'home': {
        template: 'Index',
        access: 'public'
      },
      'login': {
        template: ROUTER_LOGIN_TEMPLATE,
        access: 'public'
      },
      'register': {
        template: 'View_Register',
        access: 'public'
      },
      'about': {
        template: 'View_About',
        access: 'public',
        provides: ['appInfo'],
        data: function() {
          return { appInfo: About.getAppInfo() };
        }
      },
      'leaderboard': {
        template: 'View_Leaderboard',
        access: 'public',
        provides: ['leaderboard', 'selectedStage', 'vizinhanca', 'maps'],
        data: function(context) {
          const ranking = getLeaderboard(context.parameters.stage || null);
          const lista = ranking.success ? ranking.data : [];
          // Menos movimentos e melhor colocacao: menorMelhor inverte a ordem.
          const vizinhanca = rankingVizinhanca(
            lista.map(function(entrada) {
              return { id: entrada.userId, nome: entrada.username, pontuacao: entrada.score };
            }),
            context.user ? context.user.id : null,
            { menorMelhor: true });
          return {
            leaderboard: lista,
            selectedStage: context.parameters.stage || '',
            vizinhanca: vizinhanca,
            maps: Helper_Maps.getMaps()
          };
        }
      },
      'dashboard': {
        template: 'View_Dashboard',
        access: 'user',
        provides: ['user', 'progress', 'scores'],
        data: function(context) {
          const progressResult = getUserGameProgress();
          return {
            user: context.user,
            progress: progressResult.success ? progressResult.data : {},
            scores: DB_Scores.getScoresByUserId(context.user.id)
          };
        }
      },
      'maps': {
        template: 'View_MapSelection',
        access: 'user',
        provides: ['maps'],
        data: function() {
          return { maps: getAvailableMaps().data || [] };
        }
      },
      'profile': {
        template: 'View_Profile',
        access: 'user',
        provides: ['user'],
        data: function(context) {
          const profile = getUserProfile(context.user.id);
          return { user: profile.success ? profile.data : context.user };
        }
      },
      'achievements': {
        template: 'View_Achievements',
        access: 'user',
        provides: ['achievements'],
        data: function(context) {
          return {
            achievements: Logic_Rewards.getPlayerAchievements(context.user.id).achievements
          };
        }
      },
      'game': {
        template: 'View_Game',
        access: 'user',
        provides: ['initialStage', 'mapData', 'assets', 'journalKey'],
        data: function(context) {
          const stage = Router_Pages.resolveGameStage_(context);
          return {
            initialStage: stage,
            mapData: JSON.stringify(Helper_Maps.getMapDefinition(stage)),
            assets: JSON.stringify(Helper_Assets.getMapAssets(stage)),
            // O navegador recebe apenas uma impressão não reversível do
            // principal; o ID da sessão nunca vira chave de armazenamento.
            journalKey: Router_Pages.journalKey_(context.user)
          };
        }
      },
      'backend-maturity': {
        template: 'View_Backend_Maturity',
        access: 'admin',
        provides: ['maturity'],
        data: function() {
          return { maturity: Backend_Maturity.assess({ persist: false }) };
        }
      },
      'frontend-maturity': {
        template: 'View_Frontend_Maturity',
        access: 'admin',
        provides: ['frontendReport'],
        data: function() {
          return { frontendReport: Frontend_Maturity.assess({ persist: false }) };
        }
      },
      'admin-users': {
        template: 'View_Admin_Users',
        access: 'admin',
        provides: ['users'],
        data: function() {
          return { users: adminGetAllUsers().data };
        }
      },
      'admin-logs': {
        template: 'View_Admin_Logs',
        access: 'admin'
      },
      'admin-settings': {
        template: 'View_Admin_Settings',
        access: 'admin',
        provides: ['settings'],
        data: function() {
          return { settings: adminGetSettings().data };
        }
      }
    };
  }

  /**
   * Telas sem rota própria: erros servidos diretamente pelo roteador.
   */
  static systemTemplates() {
    return [ROUTER_FORBIDDEN_TEMPLATE, ROUTER_NOT_FOUND_TEMPLATE, ROUTER_ERROR_TEMPLATE];
  }

  /**
   * Nome legível da rota, usado pela tela de acesso negado para dizer o que
   * foi recusado em vez de apresentar uma mensagem genérica.
   */
  static label(page) {
    const labels = {
      'home': 'Início',
      'login': 'Entrar',
      'register': 'Criar conta',
      'about': 'Sobre',
      'leaderboard': 'Ranking',
      'dashboard': 'Painel',
      'maps': 'Mapas',
      'profile': 'Perfil',
      'achievements': 'Conquistas',
      'game': 'Jogo',
      'backend-maturity': 'Maturidade do backend',
      'frontend-maturity': 'Maturidade do frontend',
      'admin-users': 'Gerenciamento de usuários',
      'admin-logs': 'Logs e auditoria',
      'admin-settings': 'Configurações do sistema'
    };
    const normalized = String(page || '').toLowerCase();
    return labels[normalized] || '';
  }

  static resolve(page) {
    const normalized = String(page || 'home').toLowerCase();
    const routes = Router_Pages.routes();
    return Object.prototype.hasOwnProperty.call(routes, normalized)
      ? routes[normalized]
      : null;
  }

  /**
   * Template de negação para a rota, ou null quando o acesso é permitido.
   * Concentra numa única regra o que antes eram duas checagens independentes.
   */
  static denialFor(route, user) {
    if (route.access === 'public') return null;
    if (!user) return ROUTER_LOGIN_TEMPLATE;
    if (route.access === 'admin' && !Auth_Session.isAdmin()) return ROUTER_FORBIDDEN_TEMPLATE;
    return null;
  }

  static resolveGameStage_(context) {
    const progress = Logic_GameProgress.getLatestProgress(context.user.id);
    let stage = context.parameters.stage !== undefined
      ? Number(context.parameters.stage)
      : Number(progress.currentStage || 0);

    if (!Number.isInteger(stage) || !Helper_Maps.getMapDefinition(stage)) stage = 0;
    if (!Logic_GameProgress.isStageUnlocked(context.user.id, stage)) {
      stage = Number(progress.currentStage) || 0;
    }
    return stage;
  }

  /** Escopo estável e não identificável para rascunhos locais do diário. */
  static journalKey_(user) {
    const subject = user && user.id;
    if (!subject) return 'unscoped';
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(subject),
      Utilities.Charset.UTF_8
    );
    return digest.map(function(byte) {
      return ('0' + (byte & 255).toString(16)).slice(-2);
    }).join('').slice(0, 32);
  }

  /**
   * Compara o que a rota declara entregar com o que ela realmente entregou.
   * Uma divergência não quebra a página, mas vira alerta: é sinal de que a
   * declaração usada pela avaliação de maturidade ficou desatualizada.
   */
  static verifyProvides_(page, route, data) {
    const declared = route.provides || [];
    const delivered = Object.keys(data || {});
    const missing = declared.filter(function(key) {
      return delivered.indexOf(key) === -1;
    });
    const undeclared = delivered.filter(function(key) {
      return declared.indexOf(key) === -1;
    });

    if (missing.length || undeclared.length) {
      Middleware_Logger.warn('Rota com dados divergentes do declarado', {
        event: 'ROUTE_CONTRACT_MISMATCH',
        page: page,
        missing: missing,
        undeclared: undeclared
      });
    }
  }

  /**
   * Dados de rota por template. Consumido pela avaliação de maturidade do
   * frontend para conferir se a view usa o que o roteador injeta.
   */
  static dataByTemplate() {
    const routes = Router_Pages.routes();
    const map = {};
    Object.keys(routes).forEach(function(page) {
      const route = routes[page];
      if (route.provides && route.provides.length) {
        map[route.template] = route.provides.slice();
      }
    });
    return map;
  }

  /**
   * Todos os templates servidos pelo web app, sem repetição.
   */
  static templates() {
    const routes = Router_Pages.routes();
    const names = Object.keys(routes).map(function(page) {
      return routes[page].template;
    }).concat(Router_Pages.systemTemplates());

    const seen = {};
    return names.filter(function(name) {
      if (seen[name]) return false;
      seen[name] = true;
      return true;
    });
  }
}
