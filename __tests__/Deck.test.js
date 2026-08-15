/**
 * Testes para a classe Deck.
 * Verifica criação, embaralhamento e retirada de cartas.
 */

const Deck = require('../src/game/Deck');

describe('Deck', () => {
  test('deve criar um baralho com 40 cartas', () => {
    const deck = new Deck();
    expect(deck.cards.length).toBe(40);
  });

  test('deve permitir retirar uma carta', () => {
    const deck = new Deck();
    const card = deck.draw();
    expect(card).toBeDefined();
    expect(deck.cards.length).toBe(39);
  });

  test('não deve ter cartas duplicadas', () => {
    const deck = new Deck();
    const unique = new Set(deck.cards.map(c => `${c.suit}-${c.rank}`));
    expect(unique.size).toBe(40);
  });
});