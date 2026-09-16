// Leitura e indexação do código-fonte do frontend em runtime.
//
// O Apps Script consegue ler os próprios arquivos .html com
// HtmlService.createTemplateFromFile(name).getRawContent(), o que permite
// analisar os templates realmente servidos em vez de presumir o que eles
// contêm. Este módulo monta o corpus a partir dos pontos de entrada do
// roteador e segue os include() recursivamente.
//
// Todas as leituras são memoizadas por execução: uma avaliação completa lê
// cada arquivo no máximo uma vez.

var FRONTEND_SOURCE_CACHE_ = null;

class Frontend_Source {
  /**
   * Templates servidos pelo web app — raiz do grafo de includes.
   * Derivado da tabela de rotas: uma tela nova entra na avaliação assim que
   * entra no roteador, sem lista paralela para manter em dia.
   */
  static entryPoints() {
    return Router_Pages.templates();
  }

  /**
   * Dados que o roteador injeta em cada template, conforme declarado na rota.
   * Permite verificar se a view realmente consome o que recebe.
   */
  static routeData() {
    return Router_Pages.dataByTemplate();
  }

  static includePattern_() {
    return /<\?!=\s*include\(\s*["']([^"']+)["']\s*\)\s*;?\s*\?>/g;
  }

  /**
   * Conteúdo bruto de um template, ou null se o arquivo não existir.
   */
  static read(name) {
    try {
      return HtmlService.createTemplateFromFile(name).getRawContent();
    } catch (error) {
      return null;
    }
  }

  /**
   * Percorre o grafo de includes a partir dos pontos de entrada.
   * O resultado é memoizado durante a execução.
   */
  static corpus() {
    if (FRONTEND_SOURCE_CACHE_) return FRONTEND_SOURCE_CACHE_;

    const files = {};
    const includes = {};
    const includedBy = {};
    const missing = [];
    const unreadableEntryPoints = [];
    const queue = Frontend_Source.entryPoints().slice();
    const entryPoints = [];

    while (queue.length) {
      const name = queue.shift();
      if (Object.prototype.hasOwnProperty.call(files, name)) continue;

      const content = Frontend_Source.read(name);
      if (content === null) {
        if (Frontend_Source.entryPoints().indexOf(name) !== -1) {
          unreadableEntryPoints.push(name);
        }
        files[name] = null;
        includes[name] = [];
        continue;
      }

      files[name] = content;
      if (Frontend_Source.entryPoints().indexOf(name) !== -1) entryPoints.push(name);

      // Os includes são extraídos do conteúdo sem comentários: a documentação
      // dos templates cita include("filename") como exemplo, e um comentário
      // não é uma dependência real.
      const executable = Frontend_Source.withoutComments(content);
      const found = [];
      const pattern = Frontend_Source.includePattern_();
      let match = pattern.exec(executable);
      while (match !== null) {
        const target = match[1];
        found.push(target);
        if (!includedBy[target]) includedBy[target] = [];
        if (includedBy[target].indexOf(name) === -1) includedBy[target].push(name);
        if (!Object.prototype.hasOwnProperty.call(files, target)) queue.push(target);
        match = pattern.exec(executable);
      }
      includes[name] = found;
    }

    Object.keys(includes).forEach(function(from) {
      includes[from].forEach(function(target) {
        if (files[target] === null || files[target] === undefined) {
          missing.push({ from: from, target: target });
        }
      });
    });

    FRONTEND_SOURCE_CACHE_ = {
      files: files,
      includes: includes,
      includedBy: includedBy,
      missing: missing,
      entryPoints: entryPoints,
      unreadableEntryPoints: unreadableEntryPoints,
      names: Object.keys(files).filter(function(name) { return files[name] !== null; })
    };
    return FRONTEND_SOURCE_CACHE_;
  }

  static resetCache() {
    FRONTEND_SOURCE_CACHE_ = null;
  }

  /**
   * Conteúdo efetivo de um ponto de entrada com todos os includes expandidos.
   * Reflete o HTML que o navegador recebe, sem avaliar scriptlets.
   */
  static flatten(name, seen) {
    const corpus = Frontend_Source.corpus();
    const visited = seen || {};
    if (visited[name]) return '';
    visited[name] = true;

    const content = corpus.files[name];
    if (!content) return '';

    return Frontend_Source.withoutComments(content)
      .replace(Frontend_Source.includePattern_(), function(full, target) {
        return Frontend_Source.flatten(target, visited);
      });
  }

  // ------------------------------------------------------------- utilidades

  static withoutComments(content) {
    return String(content || '').replace(/<!--[\s\S]*?-->/g, '');
  }

  static blocks(content, tag) {
    const pattern = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
    const found = [];
    let match = pattern.exec(String(content || ''));
    while (match !== null) {
      found.push(match[1]);
      match = pattern.exec(String(content || ''));
    }
    return found;
  }

  static countMatches(content, pattern) {
    const matches = String(content || '').match(pattern);
    return matches ? matches.length : 0;
  }

  static allMatches(content, pattern, group) {
    const source = String(content || '');
    const groupIndex = group === undefined ? 1 : group;
    const found = [];
    let match = pattern.exec(source);
    while (match !== null) {
      found.push(match[groupIndex]);
      if (!pattern.global) break;
      match = pattern.exec(source);
    }
    return found;
  }

  /**
   * Concatena todos os arquivos do corpus, opcionalmente filtrando por prefixo.
   */
  static combined(prefix) {
    const corpus = Frontend_Source.corpus();
    return corpus.names
      .filter(function(name) { return !prefix || name.indexOf(prefix) === 0; })
      .map(function(name) { return corpus.files[name]; })
      .join('\n');
  }

  static views() {
    return Frontend_Source.corpus().entryPoints.filter(function(name) {
      return name.indexOf('Error_') !== 0;
    });
  }
}
