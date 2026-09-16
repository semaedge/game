// Utils_Date.gs
//
// Funcionalidade Principal: Formatação e cálculo de datas para exibição.
//
// Integrações:
// - Config.gs: usa DEFAULT_LANGUAGE apenas como preferência de idioma; o
//   fuso vem do projeto (Session.getScriptTimeZone).
// - Views: View_Dashboard e View_Admin_Users formatam timestamps com estas
//   funções durante a renderização do template.
//
// Nota de correção: a versão anterior chamava toLocaleString(DEFAULT_LANGUAGE)
// com a tag 'pt_BR'. Underscore não é BCP-47 válido, e o ECMA-402 lança
// RangeError para tags estruturalmente inválidas — o que derrubava a
// renderização das telas que formatam datas. A formatação agora usa
// Utilities.formatDate, que é determinística, respeita o fuso do projeto e não
// depende do ICU do runtime.
//
const UTILS_DATE_FALLBACK_TIMEZONE = 'America/Sao_Paulo';
const UTILS_DATE_EMPTY_LABEL = '—';

class Utils_Date {
  /**
   * Fuso do projeto. Sem ele, formatações caem no fuso do servidor e mostram
   * horários deslocados para o usuário.
   */
  static timeZone() {
    try {
      return Session.getScriptTimeZone() || UTILS_DATE_FALLBACK_TIMEZONE;
    } catch (error) {
      return UTILS_DATE_FALLBACK_TIMEZONE;
    }
  }

  /**
   * Normaliza uma tag de idioma para BCP-47 ('pt_BR' → 'pt-BR').
   * Mantida porque DEFAULT_LANGUAGE usa underscore e é chave do catálogo de
   * traduções — corrigir lá quebraria o catálogo.
   */
  static locale(language) {
    const tag = String(language || DEFAULT_LANGUAGE || 'pt-BR').replace(/_/g, '-');
    return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(tag) ? tag : 'pt-BR';
  }

  /**
   * Converte qualquer entrada em Date válida, ou null.
   * Aceita Date, ISO string, milissegundos e valores de célula do Sheets.
   */
  static toDate(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

    if (typeof value === 'number') {
      const fromNumber = new Date(value);
      return isNaN(fromNumber.getTime()) ? null : fromNumber;
    }

    const parsed = new Date(String(value));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  static format_(value, pattern) {
    const date = Utils_Date.toDate(value);
    if (!date) return UTILS_DATE_EMPTY_LABEL;
    try {
      return Utilities.formatDate(date, Utils_Date.timeZone(), pattern);
    } catch (error) {
      // Última linha de defesa: formatar nunca deve derrubar uma renderização.
      return date.toISOString();
    }
  }

  static formatTimestamp(value) {
    return Utils_Date.format_(value, 'dd/MM/yyyy HH:mm:ss');
  }

  static formatDate(value) {
    return Utils_Date.format_(value, 'dd/MM/yyyy');
  }

  static formatTime(value) {
    return Utils_Date.format_(value, 'HH:mm');
  }

  /**
   * ISO 8601 em UTC — formato para persistência e APIs, não para exibição.
   */
  static toIso(value) {
    const date = Utils_Date.toDate(value);
    return date ? date.toISOString() : '';
  }

  static elapsedMs(startTime, endTime) {
    const start = Utils_Date.toDate(startTime);
    const end = endTime === undefined ? new Date() : Utils_Date.toDate(endTime);
    if (!start || !end) return null;
    return end.getTime() - start.getTime();
  }

  /**
   * Duração legível. Diferente da versão anterior, lida com intervalos
   * negativos, inclui dias e não devolve "NaNh NaNm" para entradas inválidas.
   */
  static getElapsedTime(startTime, endTime) {
    const elapsed = Utils_Date.elapsedMs(startTime, endTime);
    if (elapsed === null) return UTILS_DATE_EMPTY_LABEL;

    const negative = elapsed < 0;
    const totalSeconds = Math.floor(Math.abs(elapsed) / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days) parts.push(days + 'd');
    if (days || hours) parts.push(hours + 'h');
    if (days || hours || minutes) parts.push(minutes + 'm');
    parts.push(seconds + 's');

    return (negative ? '-' : '') + parts.join(' ');
  }

  /**
   * Idade de um registro em dias inteiros. Usado por rotinas de retenção e
   * pelas avaliações de maturidade que cobram recência.
   */
  static ageInDays(value, reference) {
    const elapsed = Utils_Date.elapsedMs(value, reference);
    if (elapsed === null) return null;
    return Math.floor(elapsed / 86400000);
  }

  static isOlderThanDays(value, days) {
    const age = Utils_Date.ageInDays(value);
    return age === null ? true : age > Number(days);
  }
}
