/**
 * Testes para a classe Game.
 * Cobre inicialização, jogada de carta, pedido de truco, Mão de Onze e Mão de Ferro.
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

    expect(game.playCard(otherPlayer, card)).toBe(false);
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
    expect(game.scores[challengerTeam]).toBeGreaterThan(0);
  });

  // ---------- Mão de Onze ----------
  test('Mão de Onze ativa quando um time atinge 11 pontos', () => {
    const game = createGameWithPlayers(2);
    // Coloca o time 0 com 11 pontos
    game.scores[0] = 11;
    game.scores[1] = 5;
    // Simula o fim da mão (reset para próxima mão)
    game.resetForNextHand();

    // Verifica se a Mão de Onze foi ativada
    expect(game.specialHand).toBe('eleven');
    expect(game.elevenTeam).toBe(0);
    expect(game.waitingElevenDecision).toBe(true);
    expect(game.allowTruco).toBe(false);
  });

  test('handleElevenDecision com jogar define valor da mão como 3', () => {
    const game = createGameWithPlayers(2);
    game.specialHand = 'eleven';
    game.elevenTeam = 0;
    game.waitingElevenDecision = true;
    game.elevenDecisionTeam = 0;
    // Jogador 0 pertence ao time 0
    const result = game.handleElevenDecision(0, 'play');
    expect(result).toBe(true);
    expect(game.currentHandValue).toBe(3);
    expect(game.waitingElevenDecision).toBe(false);
    expect(game.allowTruco).toBe(false);
  });

  test('handleElevenDecision com fugir concede 1 ponto ao adversário', () => {
    const game = createGameWithPlayers(2);
    game.specialHand = 'eleven';
    game.elevenTeam = 0;
    game.waitingElevenDecision = true;
    game.elevenDecisionTeam = 0;
    const result = game.handleElevenDecision(0, 'flee');
    expect(result).toBe(true);
    expect(game.scores[1]).toBeGreaterThan(0);
  });

  // ---------- Mão de Ferro ----------
  test('Mão de Ferro ativa quando ambos times têm 11 pontos', () => {
    const game = createGameWithPlayers(2);
    game.scores = [11, 11];
    game.resetForNextHand(); // após reset, deve ativar Mão de Ferro
    expect(game.ironHand).toBe(true);
    expect(game.specialHand).toBe('iron');
    expect(game.allowTruco).toBe(false);
  });

  test('na Mão de Ferro, getStateForPlayer retorna cartas ocultas com índice', () => {
    const game = createGameWithPlayers(2);
    game.scores = [11, 11];
    game.resetForNextHand();
    const state = game.getStateForPlayer('player-0', 'TESTE');
    expect(state.yourHand).toHaveLength(3);
    expect(state.yourHand[0]).toHaveProperty('hidden', true);
    expect(state.yourHand[0]).toHaveProperty('index');
  });

  test('playCard na Mão de Ferro aceita jogada por índice', () => {
    const game = createGameWithPlayers(2);
    game.scores = [11, 11];
    game.resetForNextHand();
    const playerIndex = game.turnPlayerIndex;
    // Usa o índice 0 da mão
    const card = { index: 0 };
    const initialHandCount = game.players[playerIndex].hand.length;
    expect(game.playCard(playerIndex, card)).toBe(true);
    expect(game.players[playerIndex].hand.length).toBe(initialHandCount - 1);
  });
});