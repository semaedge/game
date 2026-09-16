class Cache_Manager {
  static namespace_() {
    return 'semaedge:v1:';
  }

  static physicalKey_(key) {
    const normalized = String(key || '').trim();
    if (!normalized) throw new Error('Chave de cache não pode ser vazia.');
    return Cache_Manager.namespace_() + normalized.slice(0, 180);
  }

  static get(key, fallback) {
    const physicalKey = Cache_Manager.physicalKey_(key);
    const raw = CacheService.getScriptCache().get(physicalKey);
    if (raw === null) return fallback === undefined ? null : fallback;
    try {
      const envelope = JSON.parse(raw);
      const expiresAt = envelope && Number(envelope.expiresAt);
      if (!envelope || envelope.version !== 1 || !isFinite(expiresAt)) {
        Cache_Manager.remove(key);
        return fallback === undefined ? null : fallback;
      }
      if (expiresAt <= new Date().getTime()) {
        Cache_Manager.remove(key);
        return fallback === undefined ? null : fallback;
      }
      return envelope.value;
    } catch (error) {
      Cache_Manager.remove(key);
      return fallback === undefined ? null : fallback;
    }
  }

  static put(key, value, expirationInSeconds) {
    const ttl = Math.max(1, Math.min(Number(expirationInSeconds) || 300, 21600));
    const now = new Date().getTime();
    const envelope = {
      version: 1,
      createdAt: now,
      expiresAt: now + ttl * 1000,
      value: value
    };
    const serialized = JSON.stringify(envelope);
    if (serialized.length > 95000) {
      throw new Error('Valor excede o limite seguro do CacheService.');
    }
    const physicalKey = Cache_Manager.physicalKey_(key);
    CacheService.getScriptCache().put(physicalKey, serialized, ttl);
    Cache_Manager.indexPut_(String(key), physicalKey, envelope.expiresAt);
    return value;
  }

  static remember(key, expirationInSeconds, producer) {
    const cached = Cache_Manager.get(key);
    if (cached !== null) return cached;
    if (typeof producer !== 'function') {
      throw new Error('Producer de cache inválido.');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const doubleChecked = Cache_Manager.get(key);
      if (doubleChecked !== null) return doubleChecked;
      const value = producer();
      Cache_Manager.put(key, value, expirationInSeconds);
      return value;
    } finally {
      lock.releaseLock();
    }
  }

  static remove(key) {
    const logicalKey = String(key);
    CacheService.getScriptCache().remove(Cache_Manager.physicalKey_(logicalKey));
    Cache_Manager.indexRemove_(logicalKey);
  }

  static removeMany(keys) {
    const logicalKeys = (keys || []).map(String);
    if (!logicalKeys.length) return;
    CacheService.getScriptCache().removeAll(logicalKeys.map(Cache_Manager.physicalKey_));
    logicalKeys.forEach(Cache_Manager.indexRemove_);
  }

  static invalidatePrefix(prefix) {
    const normalizedPrefix = String(prefix || '');
    const index = Cache_Manager.readIndex_();
    const keys = Object.keys(index).filter(function(key) {
      return key.indexOf(normalizedPrefix) === 0;
    });
    Cache_Manager.removeMany(keys);
    return keys.length;
  }

  static clearExpiredCache() {
    const now = new Date().getTime();
    const index = Cache_Manager.readIndex_();
    const expired = Object.keys(index).filter(function(key) {
      return Number(index[key].expiresAt) <= now;
    });
    Cache_Manager.removeMany(expired);
    return { removed: expired.length, remaining: Object.keys(Cache_Manager.readIndex_()).length };
  }

  static getAllUsersCached() {
    return Cache_Manager.remember('users:all', 600, function() {
      return DB_Users.getAllUsers().map(function(user) {
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };
      });
    });
  }

  static stats() {
    const index = Cache_Manager.readIndex_();
    return {
      namespace: Cache_Manager.namespace_(),
      indexedKeys: Object.keys(index).length,
      keys: Object.keys(index).sort()
    };
  }

  static readIndex_() {
    try {
      const raw = PropertiesService.getScriptProperties().getProperty('CACHE_INDEX_V1');
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  static writeIndex_(index) {
    PropertiesService.getScriptProperties().setProperty(
      'CACHE_INDEX_V1',
      JSON.stringify(index)
    );
  }

  static indexPut_(logicalKey, physicalKey, expiresAt) {
    const index = Cache_Manager.readIndex_();
    index[logicalKey] = { physicalKey: physicalKey, expiresAt: expiresAt };
    Cache_Manager.writeIndex_(index);
  }

  static indexRemove_(logicalKey) {
    const index = Cache_Manager.readIndex_();
    if (index[logicalKey]) {
      delete index[logicalKey];
      Cache_Manager.writeIndex_(index);
    }
  }
}
