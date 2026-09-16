# Sema Edge

## Essência

Jogo estratégico de rotas mínimas ambientado em paisagens brasileiras. O estudante resolve mapas compactos, compara estratégias e usa a eficiência do percurso como porta de entrada para raciocínio espacial, pensamento computacional e investigação da biodiversidade.

O ciclo operacional e seus critérios de conclusão estão em [WORKFLOW_BASICO.md](WORKFLOW_BASICO.md): sessão → mapa desbloqueado → plano → execução/depuração → reflexão → reprodução da rota no servidor → progressão.

## Descrição

O código atual implementa sete mapas em `Helper_Maps.gs`: seis biomas brasileiros e a paisagem costeira `Litoral do Nordeste`. A interface registra movimentos, melhores rotas, progressão e conquistas. O litoral não é apresentado como bioma oficial.

A ampliação pedagógica propõe que cada mapa tenha uma missão de investigação, uma ficha territorial curada e uma reflexão posterior. Resolver o quebra-cabeça é apenas uma das evidências.

## Objetivo pedagógico

Desenvolver planejamento, orientação espacial, decomposição de problemas e leitura crítica do território brasileiro, articulando estratégias de rota a conhecimentos sobre paisagens, biomas, biodiversidade e conservação.

### Resultados de aprendizagem esperados

- antecipar uma sequência de movimentos e revisá-la após testar;
- representar uma rota por setas, comandos ou pseudocódigo;
- comparar soluções por eficiência e clareza, não apenas por velocidade;
- diferenciar bioma, ecossistema, paisagem, região e unidade de conservação;
- reconhecer elementos ambientais e pressões humanas de cada mapa;
- justificar uma estratégia e transferi-la para outra configuração.

## Ciclo didático recomendado

1. **Observar:** descrever o tabuleiro e a paisagem sem mover peças.
2. **Planejar:** desenhar ou verbalizar uma rota possível.
3. **Executar:** testar a sequência e registrar movimentos.
4. **Depurar:** localizar movimentos desnecessários e explicar o erro.
5. **Comparar:** analisar duas rotas e discutir critérios de eficiência.
6. **Contextualizar:** investigar o território associado ao mapa.
7. **Criar:** desenhar um novo nível com metadados ambientais corretos.

## Integração curricular

| Área | Foco | Evidência observável |
|---|---|---|
| Matemática | localização, deslocamento, sequência e otimização | rota representada e contagem justificada |
| Geografia | paisagem, região, bioma, conservação e escala | ficha territorial sem confusão de categorias |
| Ciências | biodiversidade, relações ecológicas e impactos | pergunta investigável sobre o ambiente |
| Cultura Digital | algoritmo, teste, erro e depuração | sequência de comandos revisada |
| Língua Portuguesa | instrução, explicação e comparação | texto procedural claro e justificativa |
| Arte | padrões visuais e design de mapa | nível autoral legível e coerente com o tema |

A proposta mobiliza as Competências Gerais da BNCC 1, 2, 4, 5, 7, 9 e 10. Habilidades específicas devem ser selecionadas pelo professor conforme ano, mapa e objetivo.

## Avaliação formativa

| Dimensão | Em aproximação | Em desenvolvimento | Consolidando |
|---|---|---|---|
| Planejamento | move por tentativa sem registro | antecipa parte da rota | formula, testa e ajusta plano completo |
| Depuração | reinicia sem explicar | identifica movimento excedente | explica erro e generaliza a correção |
| Linguagem espacial | usa indicações vagas | usa direção e posição | combina referência, sequência e condição |
| Leitura ambiental | repete o nome do mapa | identifica elementos da paisagem | distingue categorias e relaciona conservação |

Menos movimentos é um indicador do desafio lógico, não uma nota de aprendizagem. O professor considera plano inicial, versão depurada, explicação da estratégia, ficha territorial e criação de mapa.

## Reversão pedagógica

Os melhores caminhos e os erros frequentes podem virar:

- gráficos de distribuição de movimentos;
- comparação de algoritmos da turma;
- estudo de simetria, coordenadas e transformações;
- investigação sobre o território representado;
- banco de mapas criados pelos estudantes;
- discussão sobre por que eficiência nem sempre é o único critério de uma decisão.

## Protocolo de conteúdo para novos mapas

Cada mapa deve registrar:

1. nome e categoria territorial correta;
2. localização e escala;
3. elementos bióticos e abióticos;
4. questão socioambiental sem estereótipo regional;
5. fonte curada pelo professor;
6. pergunta antes do jogo e pergunta depois;
7. objetivo lógico;
8. possibilidade de resposta multimodal.

Os seis biomas brasileiros estão representados no catálogo; “Litoral do Nordeste” aparece separadamente como paisagem/ambiente costeiro. A classificação territorial deve continuar acompanhada de metadados e mediação docente.

## Inclusão e acessibilidade

- controles por teclado, toque e alternativa passo a passo;
- opção sem cronômetro e sem ranking;
- leitura textual do tabuleiro e alto contraste;
- tamanho de alvo adequado e foco visível;
- planejamento com peças físicas ou papel quadriculado antes da tela;
- avaliação desvinculada de velocidade motora.

## Governança e ética

O projeto não usa IA generativa no núcleo atual. Toda explicação territorial deve vir de catálogo curado, e dados de uso devem ser agregados para planejamento pedagógico. Ranking público exige opção de anonimização e não pode ser usado para rotular capacidade matemática.

## Sequência piloto

| Encontro | Ação | Produto |
|---|---|---|
| 1 | rota no papel e primeiro mapa | plano inicial e registro de movimentos |
| 2 | depuração em dupla | algoritmo revisado |
| 3 | investigação da paisagem | ficha territorial com fonte |
| 4 | criação e troca de mapas | nível autoral testado por colega |

## Status de implementação

O fluxo principal, autenticação, progressão, ranking e sete mapas estão implementados. O mapa inicial agora inclui perguntas de entrada/saída e um marcador explícito de fonte ainda pendente; a prioridade é validar essa curadoria docente e enriquecer os demais mapas antes de afirmar uma jornada territorial completa.

## Gate local de qualidade

Execute `npm run verify` antes de publicar. O gate roda sete contratos
comportamentais do jogo, seis testes do avaliador e a avaliação com as
evidências operacionais versionadas. Os contratos cobrem normalização da
evidência, reprodução da rota canônica, autenticação, divergência de movimentos,
persistência sob lock, auditoria e telemetria.

O protocolo S4 de observação está em
[`PILOTO_S4_2026-09-04.md`](PILOTO_S4_2026-09-04.md). O arquivo `evidence.json`
preserva alegações antigas apenas em `historical_claims`; elas não são aceitas
para promover o estágio. Para conferir um pacote preenchido e revisado, execute
`npm run evidence:check`.

## Tecnologias e documentação

- Google Apps Script e Google Sheets;
- frontend HTML/Canvas;
- [base técnica](base.md);
- [catálogo atual de mapas](webapp/Helper_Maps.gs).

## Suporte pedagógico

O professor escolhe se o foco da aula será algoritmo, linguagem espacial ou território, evitando avaliar todas as dimensões ao mesmo tempo. O fechamento sempre pede explicação ou produção, para que a pontuação não seja a única memória da experiência.

## Navegação da Frota

- [Voltar ao README principal](../README.md)
- [Relatório Geral da Frota](../Relatorio.md)
- [Auditoria da Frota](../AUDITORIA_FROTA_COMPLETA.md)

---

Parte da Frota Educacional da Escola Classe 115 Norte — **31 projetos**.
