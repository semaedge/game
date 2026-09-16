// About.gs
//
// Funcionalidade Principal: Fornece informações sobre o aplicativo, sua versão, desenvolvedores e links úteis.
//
// Integrações:
// - Nenhuma integração direta. Contém dados estáticos.
//
// Uso:
// Usado para exibir a página "Sobre" do aplicativo, geralmente acessível a partir do menu principal.
//
class About {
  static getAppInfo() {
    return {
      name: APP_NAME,
      version: "1.0.0",
      developer: "Equipe Sema Edge",
      description: "Um jogo estratégico sobre os biomas e as belezas naturais brasileiras, desenvolvido com Google Apps Script.",
      contact: ADMIN_EMAIL,
      github: ""
    };
  }
}
