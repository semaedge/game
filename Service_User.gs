function getUserProfile(userId) {
  try {
    const sessionUser = Auth_Session.getSessionUser();
    if (!sessionUser) {
      return { success: false, code: 'UNAUTHENTICATED', message: 'Usuário não autenticado.' };
    }
    const targetId = userId || sessionUser.id;
    if (String(targetId) !== String(sessionUser.id) && !Auth_Session.isAdmin()) {
      return { success: false, code: 'FORBIDDEN', message: 'Acesso negado.' };
    }
    const user = DB_Users.getUserById(targetId);
    if (!user) {
      return { success: false, code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' };
    }
    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    };
  } catch (error) {
    Middleware_Logger.error('Erro ao obter perfil: ' + error.message);
    return { success: false, code: 'PROFILE_FAILED', message: 'Não foi possível carregar o perfil.' };
  }
}

function updateProfile(userId, newUsername, newEmail) {
  try {
    const sessionUser = Auth_Session.getSessionUser();
    if (!sessionUser) {
      return { success: false, code: 'UNAUTHENTICATED', message: 'Usuário não autenticado.' };
    }
    const targetId = userId || sessionUser.id;
    if (String(targetId) !== String(sessionUser.id) && !Auth_Session.isAdmin()) {
      return { success: false, code: 'FORBIDDEN', message: 'Acesso negado.' };
    }

    const username = String(newUsername || '').trim();
    const email = String(newEmail || '').trim().toLowerCase();
    Validation_User.validateProfileUpdate(username, email);
    const usernameOwner = DB_Users.getUserByUsername(username);
    const emailOwner = DB_Users.getUserByEmail(email);
    if (usernameOwner && String(usernameOwner.id) !== String(targetId)) {
      return { success: false, code: 'USERNAME_TAKEN', message: 'Este nome de usuário já está em uso.' };
    }
    if (emailOwner && String(emailOwner.id) !== String(targetId)) {
      return { success: false, code: 'EMAIL_TAKEN', message: 'Este e-mail já está em uso.' };
    }

    const user = DB_Users.getUserById(targetId);
    if (!user) {
      return { success: false, code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' };
    }
    DB_Users.updateUser(targetId, username, user.password, email);
    if (String(targetId) === String(sessionUser.id)) {
      Auth_Session.updateCurrentSession(username, email);
    }
    Audit_Trail.logAction('USER_PROFILE_UPDATED', { userId: targetId });
    return {
      success: true,
      message: 'Perfil atualizado com sucesso.',
      data: { id: targetId, username: username, email: email }
    };
  } catch (error) {
    Middleware_Logger.error('Erro ao atualizar perfil: ' + error.message);
    return { success: false, code: 'INVALID_PROFILE', message: error.message };
  }
}

function changePassword(userId, oldPassword, newPassword) {
  try {
    const sessionUser = Auth_Session.getSessionUser();
    if (!sessionUser) {
      return { success: false, code: 'UNAUTHENTICATED', message: 'Usuário não autenticado.' };
    }
    const targetId = userId || sessionUser.id;
    if (String(targetId) !== String(sessionUser.id)) {
      return { success: false, code: 'FORBIDDEN', message: 'A senha só pode ser alterada pelo titular.' };
    }
    const user = DB_Users.getUserById(targetId);
    if (!user) {
      return { success: false, code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' };
    }
    if (!Auth_Core.verifyPassword(user.password, oldPassword)) {
      return { success: false, code: 'INVALID_PASSWORD', message: 'A senha atual está incorreta.' };
    }
    Validation_User.validatePassword(newPassword);
    DB_Users.updateUser(targetId, user.username, Auth_Core.hashPassword(newPassword), user.email);
    Audit_Trail.logAction('USER_PASSWORD_CHANGED', { userId: targetId });
    return { success: true, message: 'Senha alterada com sucesso.' };
  } catch (error) {
    Middleware_Logger.error('Erro ao alterar senha: ' + error.message);
    return { success: false, code: 'PASSWORD_CHANGE_FAILED', message: error.message };
  }
}

function updateMyProfile(newUsername, newEmail) {
  return updateProfile(null, newUsername, newEmail);
}

function changeMyPassword(oldPassword, newPassword) {
  return changePassword(null, oldPassword, newPassword);
}
