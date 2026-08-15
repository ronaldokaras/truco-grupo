/**
 * Testes para as funções utilitárias de cartas.
 * Cobrem comparação de cartas, avaliação de mão, próximo nível de truco e ordenação.
 */

const { compareCards, evaluateHandWinner, nextTrucoLevel, sortHand } = require('../src/game/cardUtils');
const Card = require('../src/game/Card');

describe('compareCards', () => {
  test('manilha vence carta normal', () => {
    const manilha = new Card('ouros', '7');
    const normal = new Card('espadas', '3');
    expect(compareCards(manilha, normal, '7')).toBe('A');
  });

  test('manilhas empatam se mesmo naipe', () => {
    const a = new Card('ouros', '7');
    const b = new Card('ouros', '7');
    expect(compareCards(a, b, '7')).toBe('tie');
  });

  test('manilha de naipe maior vence (copas > espadas)', () => {
  const espadas = new Card('espadas', '7');
  const copas = new Card('copas', '7');
  expect(compareCards(espadas, copas, '7')).toBe('B');
});

  test('carta normal maior vence', () => {
    const a = new Card('paus', 'A');
    const b = new Card('copas', 'K');
    expect(compareCards(a, b, 'Q')).toBe('A'); // A > K
  });
});

describe('evaluateHandWinner', () => {
  test('primeira rodada vencida pelo time 0 e segunda empate -> time 0 vence', () => {
    expect(evaluateHandWinner([0, null], 0)).toBe(0);
  });

  test('empate nas duas primeiras -> terceira decide', () => {
    expect(evaluateHandWinner([null, null, 1], 0)).toBe(1);
  });

  test('time 0 vence duas primeiras -> time 0', () => {
    expect(evaluateHandWinner([0, 0], 0)).toBe(0);
  });

  test('primeira rodada empate, segunda time 1 vence -> time 1', () => {
    expect(evaluateHandWinner([null, 1], 0)).toBe(1);
  });
});

describe('nextTrucoLevel', () => {
  test('deve retornar próximo nível', () => {
    expect(nextTrucoLevel(1)).toBe(3);
    expect(nextTrucoLevel(3)).toBe(6);
    expect(nextTrucoLevel(6)).toBe(9);
    expect(nextTrucoLevel(9)).toBe(12);
    expect(nextTrucoLevel(12)).toBeNull();
  });
});

describe('sortHand', () => {
  test('ordena manilhas primeiro e depois por força', () => {
    const hand = [
      new Card('paus', '4'),
      new Card('ouros', '7'),
      new Card('copas', '3'),
    ];
    const sorted = sortHand(hand, '7');
    expect(sorted[0].suit).toBe('ouros'); // manilha
    expect(sorted[1].suit).toBe('copas'); // 3 > 4
    expect(sorted[2].suit).toBe('paus');
  });
});