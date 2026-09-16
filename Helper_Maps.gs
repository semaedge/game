// Helper_Maps.gs
//
// Funcionalidade Principal: Contém dados e lógica para a criação e manipulação dos mapas do jogo.
//
// Integrações:
// - Nenhuma integração direta. Dados estáticos e funções puras.
//
// Uso:
// Fornece as definições dos mapas para o jogo, que podem ser carregadas pelo `Service_Game.gs` ou diretamente pelo frontend.
//
class Helper_Maps {
  static getMapDefinition(stageId) {
    return Helper_Maps.getMaps().find(function(map) { return map.id === stageId; });
  }

  static getMapAssetPaths(stageId) {
    var map = Helper_Maps.getMapDefinition(stageId);
    return map ? map.assetPaths : null;
  }

  static getMaps() {
    return [
      // Stage 0 - Floresta Amazônica
      {
        id: 0,
        name: "Floresta Amazônica",
        theme: "Floresta Amazônica",
        landscapeType: "bioma",
        description: "Planeje uma rota e observe como a floresta reúne rios, árvores, animais e comunidades.",
        inquiry: "O que pode acontecer quando uma estrada divide uma área de floresta?",
        sourceStatus: "curadoria_docente_pendente",
        sourceNote: "Registrar referência externa antes do piloto.",
        preInquiry: "O que você já sabe sobre a floresta e suas comunidades?",
        postInquiry: "Que parte do seu plano você revisaria depois da rota?",
        structure: [
          "#########",
          "#@ $  . #",
          "#   $ . #",
          "#########"
        ],
        assetPaths: { background: "images/background_amazon.jpg", tileset: "images/tileset_forest.png" }
      },
      // Stage 1 - Cerrado
      {
        id: 1,
        name: "Cerrado",
        theme: "Cerrado",
        landscapeType: "bioma",
        description: "Navegue pelo cerrado, conhecido como 'savana brasileira', rico em biodiversidade e nascentes de água.",
        inquiry: "Como as queimadas naturais e antrópicas afetam de formas diferentes o cerrado?",
        structure: [
          "#########",
          "#@  $  .#",
          "#   $ . #",
          "#       #",
          "#########"
        ],
        assetPaths: { background: "images/background_cerrado.jpg", tileset: "images/tileset_cerrado.png" }
      },
      // Stage 2 - Caatinga
      {
        id: 2,
        name: "Caatinga",
        theme: "Caatinga",
        landscapeType: "bioma",
        description: "Explore a caatinga, único bioma exclusivamente brasileiro, adaptado à seca do sertão nordestino.",
        inquiry: "Como plantas e animais da caatinga sobrevivem em períodos de seca prolongada?",
        structure: [
          "############",
          "#@    #    #",
          "#  #  # $  #",
          "#  # $.    #",
          "#  #  #.   #",
          "#     #    #",
          "#  $  # $  #",
          "#  .  # .  #",
          "############"
        ],
        assetPaths: { background: "images/background_caatinga.jpg", tileset: "images/tileset_caatinga.png" }
      },
      // Stage 3 - Mata Atlântica
      {
        id: 3,
        name: "Mata Atlântica",
        theme: "Mata Atlântica",
        landscapeType: "bioma",
        description: "Percorra fragmentos da Mata Atlântica, um dos biomas mais ameaçados e ricos em espécies endêmicas do planeta.",
        inquiry: "Por que a fragmentação florestal representa uma ameaça tão grave à biodiversidade?",
        structure: [
          "##########",
          "#@  $   .#",
          "#   $  . #",
          "#        #",
          "##########"
        ],
        assetPaths: { background: "images/background_mataatlantica.jpg", tileset: "images/tileset_forest.png" }
      },
      // Stage 4 - Pantanal
      {
        id: 4,
        name: "Pantanal",
        theme: "Pantanal",
        landscapeType: "bioma",
        description: "Aventure-se pelo Pantanal, a maior planície alagável do mundo, habitat de onças, jacarés e araras.",
        inquiry: "Como os ciclos de cheia e seca moldam a vida no Pantanal?",
        structure: [
          "###########",
          "#@ $    . #",
          "#  $   .  #",
          "#         #",
          "###########"
        ],
        assetPaths: { background: "images/background_pantanal.jpg", tileset: "images/tileset_wetland.png" }
      },
      // Stage 5 - Pampa
      {
        id: 5,
        name: "Pampa",
        theme: "Pampa",
        landscapeType: "bioma",
        description: "Conheça os campos do Pampa gaúcho, bioma de vegetação rasteira com grande importância pecuária e cultural.",
        inquiry: "Como a agricultura e pecuária intensivas impactam os campos nativos do Pampa?",
        structure: [
          "############",
          "#@ $      .#",
          "#   $    . #",
          "#          #",
          "############"
        ],
        assetPaths: { background: "images/background_pampa.jpg", tileset: "images/tileset_grassland.png" }
      },
      // Stage 6 - Litoral do Nordeste (paisagem costeira)
      {
        id: 6,
        name: "Litoral do Nordeste",
        theme: "Litoral do Nordeste",
        landscapeType: "paisagem costeira",
        description: "Planeje uma rota por uma paisagem de praia. Litoral é uma paisagem; não é um bioma oficial.",
        inquiry: "Que cuidados ajudam a proteger dunas, manguezais, recifes e praias?",
        structure: [
          "##########",
          "#@       #",
          "#  $ #   #",
          "#  . #   #",
          "#  $ #   #",
          "#  . #   #",
          "#  $ #   #",
          "#  . #   #",
          "##########"
        ],
        assetPaths: { background: "images/background_beach.jpg", tileset: "images/tileset_beach.png" }
      }
    ];
  }
}
