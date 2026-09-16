/** Contrato canônico entre a pasta do Drive, o backend e o cenário. */
var GAME_ASSET_PROJECT = 'sema_edge';
var GAME_ASSET_FILES = ['sema_edge_map.svg', 'sema_avatar.png'];
var GAME_ASSET_OPTIONAL_FILES = [
  'background.jpg',
  'player.png',
  'box.png',
  'goal.png',
  'wall.png',
  'key.png',
  'powerup.png',
  'background_amazon.jpg',
  'tileset_forest.png',
  'background_beach.jpg',
  'tileset_beach.png',
  'background_cerrado.jpg',
  'tileset_cerrado.png',
  'background_caatinga.jpg',
  'tileset_caatinga.png',
  'background_mataatlantica.jpg',
  'background_pantanal.jpg',
  'tileset_wetland.png',
  'background_pampa.jpg',
  'tileset_grassland.png',
  'tileset_forest.png',
  'tileset_cerrado.png',
  'tileset_caatinga.png',
  'tileset_wetland.png',
  'tileset_grassland.png',
  'tileset_beach.png'
];

// Função interna: o manifesto é entregue ao frontend somente pela rota
// autenticada game.assets, nunca por uma chamada google.script.run direta.
function getGameAssetManifest_() {
  return GameAssetService_getManifest_(GAME_ASSET_FILES, GAME_ASSET_OPTIONAL_FILES, GAME_ASSET_PROJECT);
}

/** Espelho de webapp/assets no Drive: somente a Script Property FOLDER_ID. */
function GameAssetService_resolveFolder_() {
  var value = String(PropertiesService.getScriptProperties().getProperty('FOLDER_ID') || '').trim();
  return { id: value, configuredBy: value ? 'FOLDER_ID' : '' };
}

function GameAssetService_getManifest_(requiredFiles, optionalFiles, project) {
  requiredFiles = requiredFiles || [];
  optionalFiles = optionalFiles || [];
  var expectedFiles = requiredFiles.concat(optionalFiles);
  var base = {
    project: project || '', folderProperty: 'FOLDER_ID', configuredBy: '',
    requiredFiles: requiredFiles, optionalFiles: optionalFiles, expectedFiles: expectedFiles,
    assets: {}, assetItems: [], missingRequiredFiles: requiredFiles.slice(),
    missingOptionalFiles: optionalFiles.slice(), ignoredFileCount: 0,
    invalidFiles: [], duplicateFiles: [], ok: false
  };
  try {
    var folder = GameAssetService_resolveFolder_();
    base.configuredBy = folder.configuredBy;
    if (!folder.id) {
      base.error = 'Configure a Script Property FOLDER_ID com a pasta de imagens deste jogo.';
      return base;
    }
    var seen = {};
    var files = DriveApp.getFolderById(folder.id).getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      if (expectedFiles.indexOf(name) < 0) { base.ignoredFileCount += 1; continue; }
      if (seen[name]) {
        if (base.duplicateFiles.indexOf(name) < 0) base.duplicateFiles.push(name);
        delete base.assets[name];
        continue;
      }
      seen[name] = true;
      var mime = file.getMimeType();
      // Não basta trocar a extensão: PNG/SVG devem ter o formato correspondente.
      if ((/\.png$/.test(name) && mime !== 'image/png') ||
          (/\.svg$/.test(name) && mime !== 'image/svg+xml')) {
        base.invalidFiles.push({ name: name, mimeType: mime });
        continue;
      }
      var url = 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(file.getId());
      base.assets[name] = url;
      base.assetItems.push({ name: name, url: url, mimeType: mime, required: requiredFiles.indexOf(name) >= 0 });
    }
    base.assetItems = base.assetItems.filter(function(item) { return Boolean(base.assets[item.name]); });
    base.missingRequiredFiles = requiredFiles.filter(function(name) { return !base.assets[name]; });
    base.missingOptionalFiles = optionalFiles.filter(function(name) { return !base.assets[name]; });
    base.ok = base.missingRequiredFiles.length === 0;
    if (!base.ok) base.error = 'Arquivos obrigatórios ausentes ou inválidos em FOLDER_ID: ' + base.missingRequiredFiles.join(', ');
    return base;
  } catch (error) {
    Logger.log('[GameAssetService] ' + error.message);
    // Uma leitura interrompida não deve apresentar um catálogo parcial como completo.
    base.assets = {};
    base.assetItems = [];
    base.error = 'Não foi possível ler a pasta configurada em FOLDER_ID.';
    return base;
  }
}
