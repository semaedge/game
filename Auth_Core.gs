// Auth_Core.gs
//
// Funcionalidade Principal: Contém as funções centrais para o processo de autenticação de usuários, como verificação de credenciais e registro de novos usuários.
//
// Integrações:
// - DB_Users.gs: Interage com a camada de banco de dados para buscar e armazenar informações de usuários.
// - Auth_Session.gs: Utiliza as funções de sessão para gerenciar o estado de login do usuário.
// - Validation_User.gs: Valida os dados de entrada do usuário (e.g., formato de email, força da senha).
//
// Uso:
// Esta biblioteca é chamada pelo Service_Auth.gs, que por sua vez é acionado pelas ações `auth.*` do API_Router.gs.
//
class Auth_Core {
  static hashPassword(password, salt) {
    const normalizedSalt = salt || Utilities.getUuid().replace(/-/g, '');
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      normalizedSalt + ':' + String(password === undefined || password === null ? '' : password),
      Utilities.Charset.UTF_8
    );
    const hex = digest.map(function(byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ('0' + value.toString(16)).slice(-2);
    }).join('');
    return 'sha256$' + normalizedSalt + '$' + hex;
  }

  static isPasswordHash(value) {
    return /^sha256\$[^$]+\$[0-9a-f]{64}$/i.test(String(value || ''));
  }

  static constantTimeEquals(left, right) {
    const first = String(left || '');
    const second = String(right || '');
    let mismatch = first.length ^ second.length;
    const length = Math.max(first.length, second.length);
    for (let index = 0; index < length; index += 1) {
      mismatch |= (first.charCodeAt(index) || 0) ^ (second.charCodeAt(index) || 0);
    }
    return mismatch === 0;
  }

  static verifyPassword(storedPassword, candidatePassword) {
    const stored = String(storedPassword || '');
    const match = stored.match(/^sha256\$([^$]+)\$([0-9a-f]{64})$/i);
    if (match) return Auth_Core.constantTimeEquals(Auth_Core.hashPassword(candidatePassword, match[1]), stored);
    // Compatibilidade de migração: uma credencial antiga só permanece válida
    // durante esta chamada e é convertida para hash em verifyCredentials().
    return Auth_Core.constantTimeEquals(stored, String(candidatePassword || ''));
  }

  static verifyCredentials(username, password) {
    const user = DB_Users.getUserByUsername(username);
    if (user && Auth_Core.verifyPassword(user.password, password)) {
      if (!Auth_Core.isPasswordHash(user.password)) {
        DB_Users.updateUser(user.id, user.username, Auth_Core.hashPassword(password), user.email);
      }
      return Auth_Session.createSession(user.id, user.username, user.email);
    }
    return null;
  }

  static registerUser(username, password, email) {
    if (Validation_User.validateRegistration(username, password, email)) {
      if (DB_Users.getUserByUsername(username)) {
        throw new Error("Nome de usuário já existe.");
      }
      if (DB_Users.getUserByEmail(email)) {
        throw new Error("Email já registrado.");
      }
      const newUser = DB_Users.createUser(username, Auth_Core.hashPassword(password), email);
      Logic_GameProgress.getLatestProgress(newUser.id);
      return newUser;
    }
    return null;
  }
}
