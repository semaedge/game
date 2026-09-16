// Validation_User.gs
//
// Funcionalidade Principal: Fornece funções de validação específicas para dados de usuário, como nome de usuário, senha e e-mail.
//
// Integrações:
// - Validation_Core.gs: Utiliza funções de validação genéricas.
//
// Uso:
// Usado antes de criar ou atualizar informações de usuário para garantir a integridade e segurança dos dados.
//
class Validation_User {
  static validateUsername(username) {
    if (!Validation_Core.isNotEmpty(username)) {
      throw new Error("Nome de usuário não pode ser vazio.");
    }
    if (!Validation_Core.isLengthBetween(username, 3, 20)) {
      throw new Error("Nome de usuário deve ter entre 3 e 20 caracteres.");
    }
    // Adicionar outras regras de validação, como caracteres permitidos
    return true;
  }

  static validatePassword(password) {
    if (!Validation_Core.isNotEmpty(password)) {
      throw new Error("Senha não pode ser vazia.");
    }
    if (!Validation_Core.isLengthBetween(password, 6, 30)) {
      throw new Error("Senha deve ter entre 6 e 30 caracteres.");
    }
    // Adicionar outras regras de validação, como complexidade da senha
    return true;
  }

  static validateEmail(email) {
    if (!Validation_Core.isNotEmpty(email)) {
      throw new Error("Email não pode ser vazio.");
    }
    if (!Utils_String.isValidEmail(email)) {
      throw new Error("Formato de email inválido.");
    }
    return true;
  }

  static validateRegistration(username, password, email) {
    Validation_User.validateUsername(username);
    Validation_User.validatePassword(password);
    Validation_User.validateEmail(email);
    return true;
  }

  static validateProfileUpdate(username, email) {
    Validation_User.validateUsername(username);
    Validation_User.validateEmail(email);
    return true;
  }
}
