// Validation_Core.gs
//
// Funcionalidade Principal: Fornece funções de validação genéricas que podem ser usadas em várias partes do aplicativo.
//
// Integrações:
// - Nenhuma integração direta. Funções puras.
//
// Uso:
// Usado para validar entradas de usuário, dados de formulário e outros valores para garantir que atendam aos critérios esperados.
//
class Validation_Core {
  static isNotEmpty(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
  }

  static isNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  static isPositiveNumber(value) {
    return Validation_Core.isNumber(value) && value > 0;
  }

  static isString(value) {
    return typeof value === 'string';
  }

  static isLengthBetween(value, min, max) {
    if (!Validation_Core.isString(value)) return false;
    const len = value.length;
    return len >= min && len <= max;
  }
}
