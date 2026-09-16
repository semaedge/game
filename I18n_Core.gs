// I18n_Core.gs
//
// Funcionalidade Principal: Fornece suporte a internacionalização (i18n) para o aplicativo, permitindo que a interface seja exibida em diferentes idiomas.
//
// Integrações:
// - DB_Settings.gs: Pode ser usado para armazenar a preferência de idioma do usuário.
// - Template_Engine.gs: Para injetar strings traduzidas nos templates HTML.
//
// Uso:
// Funções para obter strings traduzidas com base em uma chave e no idioma atual.
//
class I18n_Core {
  static getTranslations(lang = DEFAULT_LANGUAGE) {
    const translations = {
      'pt_BR': {
        'login_title': 'Entrar',
        'username': 'Nome de Usuário',
        'password': 'Senha',
        'login_button': 'Entrar',
        'register_link': 'Não tem uma conta? Registre-se',
        'dashboard_title': 'Painel de Controle',
        'game_title': 'Sema Edge',
        // Adicione mais traduções aqui
      },
      'en_US': {
        'login_title': 'Login',
        'username': 'Username',
        'password': 'Password',
        'login_button': 'Login',
        'register_link': 'Don\'t have an account? Register',
        'dashboard_title': 'Dashboard',
        'game_title': 'Brazilian Natural Beauties',
        // Adicione mais traduções aqui
      }
    };
    return translations[lang] || translations[DEFAULT_LANGUAGE];
  }

  static t(key, lang = DEFAULT_LANGUAGE) {
    const trans = I18n_Core.getTranslations(lang);
    return trans[key] || key;
  }
}
