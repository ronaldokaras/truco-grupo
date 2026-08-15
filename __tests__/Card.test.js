/**
 * Testes para a classe Card.
 * Verifica o cálculo de valor com base na manilha.
 */

const Card = require('../src/game/Card');
const { RANKS, MANILHA_SUIT_ORDER } = require('../src/game/constants');

describe('Card', () => {
  test('deve criar uma carta com naipe e valor', () => {
    const card = new Card('ouros', 'A');
    expect(card.suit).toBe('ouros');
    expect(card.rank).toBe('A');
  });

  test('deve retornar força normal quando não é manilha', () => {
    const card = new Card('copas', 'Q');
    const value = card.getValue('A');
    expect(value.type).toBe('normal');
    expect(value.rankStrength).toBe(RANKS.indexOf('Q'));
  });

  test('deve retornar manilha quando rank é igual à manilha', () => {
    const card = new Card('espadas', '7');
    const value = card.getValue('7');
    expect(value.type).toBe('manilha');
    expect(value.suitStrength).toBe(MANILHA_SUIT_ORDER.indexOf('espadas'));
  });
});