// Middleware_ErrorHandler.gs
//
// Funcionalidade Principal: Centraliza o tratamento de erros em todo o aplicativo, fornecendo um mecanismo consistente para capturar, registrar e responder a exceções.
//
// Integrações:
// - Middleware_Logger.gs: Utiliza o logger para registrar detalhes dos erros.
// - API_Router.gs: converte o erro em resposta estruturada para o cliente.
//
// Uso:
// Funções estáticas para envolver blocos de código que podem gerar erros, garantindo que as exceções sejam tratadas de forma graciosa e registradas.
//
class Middleware_ErrorHandler {
  static wrap(func) {
    return function() {
      try {
        return func.apply(this, arguments);
      } catch (e) {
        Middleware_Logger.error(`Erro na função ${func.name}: ${e.message} - Stack: ${e.stack}`);
        // Dependendo do contexto (web app ou função de servidor), pode-se retornar um erro para o cliente ou exibir uma mensagem.
        return { success: false, message: "Ocorreu um erro inesperado. Por favor, tente novamente mais tarde." };
      }
    };
  }

  static handleRpcError(error) {
    Middleware_Logger.error(`Erro RPC: ${error.message} - Stack: ${error.stack}`);
    return { success: false, message: "Ocorreu um erro na comunicação com o servidor." };
  }
}
