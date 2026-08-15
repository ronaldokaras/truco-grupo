/**
 * Funções utilitárias para lógica de cartas e mão.
 * Inclui:
 *  - compareCards: compara duas cartas considerando a manilha.
 *  - evaluateHandWinner: determina o vencedor da mão com base nos resultados das rodadas.
 *  - nextTrucoLevel: retorna o próximo valor de truco.
 *  - sortHand: ordena a mão do jogador.
 * Essas funções são puras e não dependem de Socket.IO.
 */

const { MANILHA_SUIT_ORDER, HAND_VALUE_STEPS } = require('./constants');

function compareCards(cardA, cardB, manilhaRank) {
  const valA = cardA.getValue(manilhaRank);
  const valB = cardB.getValue(manilhaRank);

  if (valA.type === 'manilha' && valB.type === 'manilha') {
    if (valA.suitStrength > valB.suitStrength) return 'A';
    if (valA.suitStrength < valB.suitStrength) return 'B';
    return 'tie';
  }

  if (valA.type === 'manilha') return 'A';
  if (valB.type === 'manilha') return 'B';

  if (valA.rankStrength > valB.rankStrength) return 'A';
  if (valA.rankStrength < valB.rankStrength) return 'B';
  return 'tie';
}

function evaluateHandWinner(roundResults, starterTeam) {
  const [r1, r2, r3] = roundResults;

  // Se já temos duas rodadas com vencedor definido ou empate + vitória
  if (roundResults.length >= 2) {
    if (r1 !== null && (r2 === r1 || r2 === null)) return r1;
    if (r1 === null && r2 !== null) return r2;
  }

  // Se temos três rodadas
  if (roundResults.length === 3) {
    if (r3 !== null) return r3;
    // Se a terceira empatou, mas a primeira teve vencedor
    if (r1 !== null) return r1;
    // Se todas as três empataram, ninguém pontua
    return null;
  }

  return null;
}

function nextTrucoLevel(currentValue) {
  return HAND_VALUE_STEPS[currentValue] || null;
}

function sortHand(hand, manilhaRank) {
  return [...hand].sort((a, b) => {
    const va = a.getValue(manilhaRank);
    const vb = b.getValue(manilhaRank);

    if (va.type === 'manilha' && vb.type === 'manilha') {
      return vb.suitStrength - va.suitStrength;
    }
    if (va.type === 'manilha') return -1;
    if (vb.type === 'manilha') return 1;
    return vb.rankStrength - va.rankStrength;
  });
}

module.exports = {
  compareCards,
  evaluateHandWinner,
  nextTrucoLevel,
  sortHand
};