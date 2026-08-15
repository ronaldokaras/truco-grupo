/**
 * Classe que representa o baralho.
 * Cria todas as cartas, embaralha e permite retirar cartas (draw).
 * É utilizada no início de cada mão e para redistribuir em caso de aborto.
 */

const Card = require('./Card');
const { SUITS, RANKS } = require('./constants');

class Deck {
  constructor() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(suit, rank));
      }
    }
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    return this.cards.pop();
  }
}

module.exports = Deck;