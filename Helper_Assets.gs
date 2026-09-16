class Helper_Assets {
  static registry_() {
    return {
      'background.jpg': 'images/background.jpg',
      'player.png': 'images/player.png',
      'box.png': 'images/box.png',
      'goal.png': 'images/goal.png',
      'wall.png': 'images/wall.png',
      'key.png': 'images/key.png',
      'powerup.png': 'images/powerup.png',
      'background_amazon.jpg': 'images/background_amazon.jpg',
      'tileset_forest.png': 'images/tileset_forest.png',
      'background_beach.jpg': 'images/background_beach.jpg',
      'tileset_beach.png': 'images/tileset_beach.png',
      'background_cerrado.jpg': 'images/background_cerrado.jpg',
      'tileset_cerrado.png': 'images/tileset_cerrado.png',
      'background_caatinga.jpg': 'images/background_caatinga.jpg',
      'tileset_caatinga.png': 'images/tileset_caatinga.png',
      'background_mataatlantica.jpg': 'images/background_mataatlantica.jpg',
      'background_pantanal.jpg': 'images/background_pantanal.jpg',
      'tileset_wetland.png': 'images/tileset_wetland.png',
      'background_pampa.jpg': 'images/background_pampa.jpg',
      'tileset_grassland.png': 'images/tileset_grassland.png'
    };
  }

  static getAssetUrl(assetPath, manifest) {
    const path = String(assetPath || '').trim();
    const registry = Helper_Assets.registry_();
    const name = Object.keys(registry).find(function(key) { return key === path || registry[key] === path; });
    if (!name) return null;
    const contract = manifest || getGameAssetManifest_();
    return contract.assets[name] || null;
  }

  static getGameImage(imageName) {
    // Nomes são exatos, inclusive maiúsculas e extensão; sem imagens inventadas.
    return Helper_Assets.getAssetUrl(imageName);
  }

  static getMapAssets(stageId) {
    const map = Helper_Maps.getMapDefinition(Number(stageId));
    if (!map || !map.assetPaths) return null;
    const manifest = getGameAssetManifest_();
    const resolved = { tileCrop: Helper_Assets.tileCrop_(map.assetPaths.tileset) };
    Object.keys(map.assetPaths).forEach(function(key) {
      resolved[key] = Helper_Assets.getAssetUrl(map.assetPaths[key], manifest);
    });
    const registry = Helper_Assets.registry_();
    ['player', 'box', 'goal', 'wall'].forEach(function(key) {
      resolved[key] = Helper_Assets.getAssetUrl(registry[key + '.png'], manifest);
    });
    resolved.fallbackBackground = Helper_Assets.getAssetUrl(registry['background.jpg'], manifest);
    return resolved;
  }

  static tileCrop_(path) {
    // Região interna do primeiro piso: x, y, largura, altura normalizados.
    // As folhas têm grades e margens diferentes; nunca desenhar a folha inteira como piso.
    const crops = {
      'tileset_forest.png': [0.065, 0.065, 0.105, 0.105],
      'tileset_cerrado.png': [0.04, 0.04, 0.12, 0.12],
      'tileset_caatinga.png': [0.055, 0.05, 0.14, 0.14],
      'tileset_wetland.png': [0.045, 0.045, 0.12, 0.12],
      'tileset_grassland.png': [0.06, 0.05, 0.11, 0.115],
      'tileset_beach.png': [0.055, 0.055, 0.15, 0.15]
    };
    return crops[String(path || '').split('/').pop()] || null;
  }

  static manifest() {
    const registry = Helper_Assets.registry_();
    const manifest = getGameAssetManifest_();
    return Object.keys(registry).map(function(name) {
      return { name: name, path: registry[name], url: manifest.assets[name] || null,
        configured: Boolean(manifest.assets[name]), folderProperty: 'FOLDER_ID' };
    });
  }
}

function configureAssetBaseUrl(baseUrl) {
  assertAdminOperator_();
  throw new Error('ASSET_BASE_URL não é mais usado. Configure FOLDER_ID nas Propriedades do script.');
}
