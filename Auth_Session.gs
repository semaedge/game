var ACTIVE_SESSION_TOKEN_ = '';

class Auth_Session {
  static setRequestToken(token) {
    ACTIVE_SESSION_TOKEN_ = Auth_Session.normalizeToken_(token);
  }

  static createSession(userId, username, email) {
    Auth_Session.cleanupExpiredSessions_();
    const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    const now = new Date().getTime();
    const session = {
      userId: userId,
      username: username,
      email: email || '',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 12 * 60 * 60 * 1000).toISOString()
    };
    PropertiesService.getScriptProperties().setProperty(
      Auth_Session.propertyKey_(token),
      JSON.stringify(session)
    );
    ACTIVE_SESSION_TOKEN_ = token;
    return {
      token: token,
      user: {
        id: userId,
        username: username,
        email: email || ''
      },
      expiresAt: session.expiresAt
    };
  }

  static isLoggedIn(token) {
    return Boolean(Auth_Session.getSessionUser(token));
  }

  static getSessionUser(token) {
    const resolvedToken = token === undefined || token === null
      ? Auth_Session.normalizeToken_(ACTIVE_SESSION_TOKEN_)
      : Auth_Session.normalizeToken_(token);
    if (!resolvedToken) return null;

    const properties = PropertiesService.getScriptProperties();
    const key = Auth_Session.propertyKey_(resolvedToken);
    const raw = properties.getProperty(key);
    if (!raw) return null;

    try {
      const session = JSON.parse(raw);
      const expiresAt = session && new Date(session.expiresAt).getTime();
      if (!session || typeof session !== 'object' ||
          !String(session.userId == null ? '' : session.userId).trim() ||
          !isFinite(expiresAt) || expiresAt <= new Date().getTime()) {
        properties.deleteProperty(key);
        return null;
      }
      return {
        id: session.userId,
        username: session.username,
        email: session.email,
        expiresAt: session.expiresAt
      };
    } catch (error) {
      properties.deleteProperty(key);
      return null;
    }
  }

  static isAdmin(token) {
    const user = Auth_Session.getSessionUser(token);
    if (!user) return false;
    return String(user.email || '').toLowerCase() === String(ADMIN_EMAIL).toLowerCase();
  }

  static logout(token) {
    const resolvedToken = token === undefined || token === null
      ? Auth_Session.normalizeToken_(ACTIVE_SESSION_TOKEN_)
      : Auth_Session.normalizeToken_(token);
    if (resolvedToken) {
      PropertiesService.getScriptProperties().deleteProperty(
        Auth_Session.propertyKey_(resolvedToken)
      );
    }
    ACTIVE_SESSION_TOKEN_ = '';
  }

  static updateCurrentSession(username, email) {
    const token = Auth_Session.normalizeToken_(ACTIVE_SESSION_TOKEN_);
    if (!token) return false;
    const properties = PropertiesService.getScriptProperties();
    const key = Auth_Session.propertyKey_(token);
    const raw = properties.getProperty(key);
    if (!raw) return false;
    let session;
    try {
      session = JSON.parse(raw);
    } catch (error) {
      properties.deleteProperty(key);
      return false;
    }
    if (!session || typeof session !== 'object' || !String(session.userId == null ? '' : session.userId).trim()) {
      properties.deleteProperty(key);
      return false;
    }
    session.username = username;
    session.email = email || '';
    properties.setProperty(key, JSON.stringify(session));
    return true;
  }

  static propertyKey_(token) {
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(token),
      Utilities.Charset.UTF_8
    );
    const hash = digest.map(function(value) {
      const normalized = value < 0 ? value + 256 : value;
      return ('0' + normalized.toString(16)).slice(-2);
    }).join('');
    return 'SESSION_' + hash;
  }

  static normalizeToken_(token) {
    return typeof token === 'string' ? token.trim() : '';
  }

  static cleanupExpiredSessions_() {
    const properties = PropertiesService.getScriptProperties();
    const all = properties.getProperties();
    const now = new Date().getTime();
    let removed = 0;
    Object.keys(all).forEach(function(key) {
      if (key.indexOf('SESSION_') !== 0) return;
      try {
        const session = JSON.parse(all[key]);
        const expiresAt = session && new Date(session.expiresAt).getTime();
        if (!session || typeof session !== 'object' ||
            !String(session.userId == null ? '' : session.userId).trim() ||
            !isFinite(expiresAt) || expiresAt <= now) {
          properties.deleteProperty(key);
          removed += 1;
        }
      } catch (error) {
        properties.deleteProperty(key);
        removed += 1;
      }
    });
    return removed;
  }
}
