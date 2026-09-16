// Service_Auth.gs
//
// Funcionalidade Principal: Implementa as operações de autenticação usadas
// pelas ações `auth.*` do API_Router.
//
// Integrações:
// - Auth_Core.gs: Chama as funções de verificação de credenciais e registro de usuários.
// - Auth_Session.gs: Utiliza para gerenciar o estado da sessão.
// - Middleware_Logger.gs: Registra eventos de login e logout.
//
// Uso:
// Estas funções são privadas do servidor — o sufixo `_` impede que o Apps
// Script as exponha a `google.script.run`. O frontend chega até elas somente
// por apiRequest(), que é onde ficam o requestId, o log estruturado e a
// verificação de esquema. Sem isso, o cliente poderia autenticar por um
// caminho paralelo, sem nenhum desses controles.
//
function doLogin_(username, password) {
  try {
    const session = Auth_Core.verifyCredentials(username, password);
    if (session) {
      Middleware_Logger.log("Login bem-sucedido para: " + username);
      Audit_Trail.logAction("USER_LOGIN", { username: username });
      Analytics_Service.trackEvent('auth', 'login_success', '', 1);
      return {
        success: true,
        message: "Login bem-sucedido!",
        data: {
          sessionToken: session.token,
          expiresAt: session.expiresAt,
          user: session.user
        }
      };
    } else {
      Middleware_Logger.log("Tentativa de login falhou para: " + username);
      Analytics_Service.trackEvent('auth', 'login_failed', '', 1);
      return { success: false, message: "Usuário ou senha inválidos." };
    }
  } catch (e) {
    Middleware_Logger.error("Erro durante o login: " + e.message);
    return { success: false, message: "Erro interno no servidor." };
  }
}

function doRegister_(username, password, email) {
  try {
    const newUser = Auth_Core.registerUser(username, password, email);
    if (newUser) {
      Middleware_Logger.log("Novo usuário registrado: " + username);
      Analytics_Service.trackEvent('auth', 'registration', '', 1);
      return { success: true, message: "Registro bem-sucedido!" };
    } else {
      return { success: false, message: "Falha no registro." };
    }
  } catch (e) {
    Middleware_Logger.error("Erro durante o registro: " + e.message);
    return { success: false, message: e.message };
  }
}

function doLogout_() {
  try {
    const user = Auth_Session.getSessionUser();
    Auth_Session.logout();
    if (user) {
      Middleware_Logger.log("Logout do usuário: " + user.username);
    }
    return { success: true, message: "Logout concluído." };
  } catch (e) {
    Middleware_Logger.error("Erro durante o logout: " + e.message);
    return { success: false, message: "Erro interno no servidor." };
  }
}
