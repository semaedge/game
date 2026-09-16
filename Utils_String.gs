// Utils_String.gs
//
// Funcionalidade Principal: Manipulação, escape e validação de strings.
//
// Integrações:
// - Validation_User.gs: valida o formato de e-mail no registro e no perfil.
// - Backend_Maturity.gs: valida a identidade administrativa configurada.
// - Report_Generator.gs: escapa dados de usuário antes de montar HTML.
//
// Notas de correção nesta revisão:
// - sanitizeInput escapava apenas < e >, deixando passar &, aspas e apóstrofo.
//   Escapar < e > sem escapar & antes também corrompe entidades já existentes.
//   O escape agora é completo e na ordem correta.
// - A regex de e-mail rejeitava endereços válidos: local part com '+' (muito
//   usado em rótulos de inbox) e TLDs com mais de 6 letras (.technology,
//   .photography). Registro legítimo era barrado.
// - As funções lançavam TypeError para null/undefined/números.
//
const UTILS_STRING_MAX_EMAIL_LENGTH = 254;
const UTILS_STRING_MAX_EMAIL_LOCAL_LENGTH = 64;

class Utils_String {
  /**
   * Representação textual segura de qualquer valor, sem lançar.
   */
  static toText(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    }
    return String(value);
  }

  static isBlank(value) {
    return Utils_String.toText(value).trim() === '';
  }

  /**
   * Escapa os cinco caracteres que mudam o significado do HTML.
   * O & precisa vir primeiro: escapá-lo depois transformaria o '&' das
   * entidades recém-criadas em '&amp;amp;'.
   */
  static escapeHtml(value) {
    return Utils_String.toText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Mantido pelo nome antigo; delega ao escape completo.
   */
  static sanitizeInput(input) {
    return Utils_String.escapeHtml(input);
  }

  static capitalizeFirstLetter(value) {
    const text = Utils_String.toText(value);
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  static normalizeEmail(email) {
    return Utils_String.toText(email).trim().toLowerCase();
  }

  /**
   * Validação pragmática de e-mail: aceita os endereços que a RFC 5322 permite
   * na prática e rejeita o que quebraria o envio. Não tenta implementar a RFC
   * inteira — a confirmação real de um endereço é o envio.
   */
  static isValidEmail(email) {
    const normalized = Utils_String.normalizeEmail(email);
    if (!normalized || normalized.length > UTILS_STRING_MAX_EMAIL_LENGTH) return false;

    const separator = normalized.lastIndexOf('@');
    if (separator <= 0 || separator === normalized.length - 1) return false;

    const local = normalized.slice(0, separator);
    const domain = normalized.slice(separator + 1);
    if (local.length > UTILS_STRING_MAX_EMAIL_LOCAL_LENGTH) return false;
    if (normalized.indexOf('..') !== -1) return false;

    const localPattern = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
    const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/;
    return localPattern.test(local) && domainPattern.test(domain);
  }

  /**
   * Encurta preservando palavras quando possível. Usado em rótulos e
   * evidências, onde texto cortado no meio de uma palavra atrapalha a leitura.
   */
  static truncate(value, maxLength, suffix) {
    const text = Utils_String.toText(value);
    const limit = Math.max(1, Number(maxLength) || 80);
    if (text.length <= limit) return text;

    const ellipsis = suffix === undefined ? '…' : suffix;
    const cut = text.slice(0, limit);
    const lastSpace = cut.lastIndexOf(' ');
    const base = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut;
    return base.replace(/[\s.,;:]+$/, '') + ellipsis;
  }

  /**
   * Identificador estável a partir de texto livre.
   * NFD separa a letra do diacrítico; remover os não-ASCII em seguida deixa a
   * letra base, então "Ação" vira "acao" e não "a-o".
   */
  static slugify(value) {
    return Utils_String.toText(value)
      .normalize('NFD')
      .replace(/[^\x00-\x7F]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
}
