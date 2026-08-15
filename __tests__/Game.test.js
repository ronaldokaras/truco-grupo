/**
 * Testes para a classe Game.
 * Cobre inicialização, jogada de carta, pedido de truco e pontuação.
 */

const Game = require('../src/game/Game');

function createGameWithPlayers(maxPlayers = 2) {
  const game = new Game(maxPlayers);
  for (let i = 0; i < maxPlayers; i++) {
    game.players[i].id = `player-${i}`;
    game.players[i].token = `token-${i}`;
    game.players[i].name = `Jogador ${i + 1}`;
    game.players[i].connected = true;
  }
  game.started = true;
  return game;
}

describe('Game', () => {
  test('deve inicializar corretamente', () => {
    const game = new Game(2);
    expect(game.players.length).toBe(2);
    expect(game.deck.cards.length).toBeLessThan(40);
    expect(game.vira).toBeDefined();
    expect(game.manilhaRank).toBeDefined();
    expect(game.currentHandValue).toBe(1);
    expect(game.rounds).toEqual([]);
  });

  test('playCard deve permitir apenas o jogador da vez', () => {
    const game = createGameWithPlayers(2);
    const currentPlayer = game.turnPlayerIndex;
    const otherPlayer = (currentPlayer + 1) % 2;
    const card = game.players[currentPlayer].hand[0];

    // Jogador errado não pode jogar
    expect(game.playCard(otherPlayer, card)).toBe(false);
    // Jogador correto pode jogar
    expect(game.playCard(currentPlayer, card)).toBe(true);
  });

  test('playCard deve remover a carta da mão', () => {
    const game = createGameWithPlayers(2);
    const playerIndex = game.turnPlayerIndex;
    const card = game.players[playerIndex].hand[0];
    const initialCount = game.players[playerIndex].hand.length;
    game.playCard(playerIndex, card);
    expect(game.players[playerIndex].hand.length).toBe(initialCount - 1);
  });

  test('truco deve criar desafio com nível 3', () => {
    const game = createGameWithPlayers(2);
    const playerIndex = game.turnPlayerIndex;
    const result = game.requestTruco(playerIndex);
    expect(result).toBe(true);
    expect(game.challenge).toBeTruthy();
    expect(game.challenge.level).toBe(3);
    expect(game.challenge.waitingOn).not.toBe(playerIndex);
  });

  test('responder truco aceitando atualiza valor da mão', () => {
    const game = createGameWithPlayers(2);
    game.requestTruco(game.turnPlayerIndex);
    const waitingOn = game.challenge.waitingOn;
    const result = game.respondTruco(waitingOn, 'accept');
    expect(result).toBe(true);
    expect(game.currentHandValue).toBe(3);
    expect(game.challenge).toBeNull();
  });

  test('fugir do truco concede pontos ao adversário', () => {
    const game = createGameWithPlayers(2);
    game.requestTruco(game.turnPlayerIndex);
    const waitingOn = game.challenge.waitingOn;
    const challengerTeam = game.players[game.challenge.challenger].team;
    game.respondTruco(waitingOn, 'flee');
    // Após fugir, a mão termina e o jogo é resetado
    expect(game.scores[challengerTeam]).toBeGreaterThan(0);
  });
});