/**
 * Testes para a classe Player.
 * Verifica atributos iniciais e time.
 */

const Player = require('../src/game/Player');

describe('Player', () => {
  test('deve criar jogador com nome padrão e time correto', () => {
    const p = new Player(null, 1, 2);
    expect(p.name).toBe('Jogador 3'); // índice 2 => "Jogador 3"
    expect(p.team).toBe(1);
    expect(p.connected).toBe(false);
    expect(p.hand).toEqual([]);
  });

  test('deve aceitar nome personalizado', () => {
    const p = new Player('João', 0, 0);
    expect(p.name).toBe('João');
    expect(p.team).toBe(0);
  });
});