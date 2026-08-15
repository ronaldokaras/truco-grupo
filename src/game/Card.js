/**
 * Classe que representa uma carta do baralho.
 * Possui naipe (suit) e valor (rank).
 * Método getValue() calcula a força da carta com base na manilha da rodada.
 */

const { MANILHA_SUIT_ORDER, RANKS } = require('./constants');

class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
  }

  getValue(manilhaRank) {
    if (this.rank === manilhaRank) {
      return {
        type: 'manilha',
        suitStrength: MANILHA_SUIT_ORDER.indexOf(this.suit)
      };
    }
    return {
      type: 'normal',
      rankStrength: RANKS.indexOf(this.rank)
    };
  }
}

module.exports = Card;