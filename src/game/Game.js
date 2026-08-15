/**
 * Classe principal que orquestra a lógica de uma partida de Truco.
 * Gerencia jogadores, baralho, vira, rodadas, placar, pedidos de truco e estado geral.
 * Não conhece Socket.IO — apenas recebe entradas e retorna resultados.
 * Métodos importantes:
 *  - playCard: processa a jogada de uma carta.
 *  - requestTruco: inicia um pedido de truco.
 *  - respondTruco: trata a resposta ao truco (aceitar, fugir, aumentar).
 *  - timeout: finaliza a mão por estouro de tempo.
 *  - getStateForPlayer / getSpectatorState: retornam o estado visível para cada tipo de cliente.
 *  - resetForNextHand / restartGame / abortGame: controlam a transição entre mãos/partidas.
 */

const Deck = require('./Deck');
const Player = require('./Player');
const { RANKS } = require('./constants');
const {
  compareCards,
  evaluateHandWinner,
  nextTrucoLevel,
  sortHand
} = require('./cardUtils');
const config = require('../config');

class Game {
  constructor(maxPlayers) {
    this.maxPlayers = maxPlayers;
    this.players = this._createPlayers(maxPlayers);
    this.deck = new Deck();

    this.vira = this.deck.draw();
    this.manilhaRank = RANKS[(RANKS.indexOf(this.vira.rank) + 1) % RANKS.length];

    for (const p of this.players) {
      p.hand = [this.deck.draw(), this.deck.draw(), this.deck.draw()];
    }

    const starter = Math.floor(Math.random() * maxPlayers);

    this.currentHandValue = 1;
    this.rounds = [];
    this.roundResults = [];
    this.currentRound = 0;
    this.turnPlayerIndex = starter;
    this.roundStarter = starter;
    this.handWinnerTeam = null;
    this.challenge = null;
    this.gameOver = false;
    this.winnerTeam = null;
    this.scores = [0, 0];
    this.handStarter = starter;
    this.started = false;
    this.logs = [];
    this.turnTimeLimit = null;
  }

  _createPlayers(count) {
    const players = [];
    for (let i = 0; i < count; i++) {
      const team = count === 2 ? i : (i % 2 === 0 ? 0 : 1);
      players.push(new Player(null, team, i));
    }
    return players;
  }

  addLog(playerName, action, details = '') {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      player: playerName,
      action,
      details
    };
    this.logs.push(entry);
    if (this.logs.length > 200) this.logs.shift();
    return entry;
  }

  getRoundHistory() {
    if (!this.rounds || this.rounds.length === 0) return [];
    return this.rounds.map((round, idx) => {
      const result = this.roundResults[idx];
      let label = 'Empate';
      if (result !== null && result !== undefined) {
        label = `Time ${result + 1}`;
        if (round.winnerPlayer !== null && round.winnerPlayer !== undefined) {
          const name = this.players[round.winnerPlayer]?.name;
          if (name) label = name;
        }
      }
      return {
        round: idx + 1,
        winnerLabel: result === null ? 'Empate' : label,
        team: result
      };
    });
  }

  getStateForPlayer(playerId, roomCode) {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return null;

    let partnerIndex = -1;
    let partnerName = null;
    if (this.maxPlayers === 4) {
      partnerIndex = this.players.findIndex(
        (p, idx) => p.team === this.players[playerIndex].team && idx !== playerIndex
      );
      if (partnerIndex >= 0) partnerName = this.players[partnerIndex].name;
    }

    let teamNames = null;
    if (this.maxPlayers === 4) {
      teamNames = [
        this.players.filter(p => p.team === 0).map(p => p.name).join(' & '),
        this.players.filter(p => p.team === 1).map(p => p.name).join(' & ')
      ];
    }

    const sortedHand = sortHand(this.players[playerIndex].hand, this.manilhaRank);

    return {
      roomCode,
      yourIndex: playerIndex,
      yourTeam: this.players[playerIndex].team,
      yourHand: sortedHand,
      partnerIndex,
      partnerName,
      teamNames,
      players: this.players.map(p => ({
        name: p.name,
        team: p.team,
        connected: p.connected,
        cardCount: p.hand.length
      })),
      vira: this.vira,
      manilhaRank: this.manilhaRank,
      currentHandValue: this.currentHandValue,
      rounds: this.rounds,
      currentRound: this.currentRound,
      roundHistory: this.getRoundHistory(),
      turn: this.turnPlayerIndex,
      turnPlayerName: this.players[this.turnPlayerIndex]?.name || '?',
      roundStarter: this.roundStarter,
      handWinnerTeam: this.handWinnerTeam,
      challenge: this.challenge,
      scores: this.scores,
      gameOver: this.gameOver,
      winnerTeam: this.winnerTeam,
      maxPlayers: this.maxPlayers,
      started: this.started,
      yourToken: this.players[playerIndex].token,
      turnTimeLimit: this.turnTimeLimit,
      logs: this.logs.slice(-50)
    };
  }

  getSpectatorState(roomCode) {
    return {
      roomCode,
      players: this.players.map(p => ({
        name: p.name,
        team: p.team,
        connected: p.connected,
        cardCount: p.hand.length
      })),
      vira: this.vira,
      manilhaRank: this.manilhaRank,
      scores: this.scores,
      currentHandValue: this.currentHandValue,
      maxPlayers: this.maxPlayers,
      turn: this.turnPlayerIndex,
      turnPlayerName: this.players[this.turnPlayerIndex]?.name || '?',
      rounds: this.rounds,
      currentRound: this.currentRound,
      roundHistory: this.getRoundHistory(),
      challenge: this.challenge,
      handWinnerTeam: this.handWinnerTeam,
      gameOver: this.gameOver,
      winnerTeam: this.winnerTeam,
      started: this.started,
      teamNames: this.maxPlayers === 4
        ? [
            this.players.filter(p => p.team === 0).map(p => p.name).join(' & '),
            this.players.filter(p => p.team === 1).map(p => p.name).join(' & ')
          ]
        : null,
      turnTimeLimit: this.turnTimeLimit,
      logs: this.logs.slice(-50)
    };
  }

  playCard(playerIndex, card) {
    if (!this.started || this.gameOver || this.handWinnerTeam !== null || this.challenge) return false;
    if (playerIndex !== this.turnPlayerIndex) return false;

    const player = this.players[playerIndex];
    const cardIndex = player.hand.findIndex(
      c => c.suit === card.suit && c.rank === card.rank
    );
    if (cardIndex === -1) return false;

    const playedCard = player.hand.splice(cardIndex, 1)[0];
    this.addLog(player.name, 'Jogou carta', `${playedCard.rank} de ${playedCard.suit}`);

    if (!this.rounds[this.currentRound]) {
      this.rounds[this.currentRound] = { cards: [], winnerPlayer: null };
    }
    this.rounds[this.currentRound].cards.push({ player: playerIndex, card: playedCard });

    if (this.rounds[this.currentRound].cards.length === this.maxPlayers) {
      const cards = this.rounds[this.currentRound].cards;
      let bestIdx = 0;
      for (let i = 1; i < cards.length; i++) {
        if (compareCards(cards[bestIdx].card, cards[i].card, this.manilhaRank) === 'B') {
          bestIdx = i;
        }
      }

      let hasTie = false;
      for (let i = 0; i < cards.length; i++) {
        if (i === bestIdx) continue;
        if (compareCards(cards[bestIdx].card, cards[i].card, this.manilhaRank) === 'tie') {
          hasTie = true;
          break;
        }
      }

      const roundWinner = hasTie ? null : cards[bestIdx].player;
      this.rounds[this.currentRound].winnerPlayer = roundWinner;
      this.roundResults.push(roundWinner !== null ? this.players[roundWinner].team : null);

      const starterTeam = this.players[this.handStarter].team;
      const decidedTeam = evaluateHandWinner(this.roundResults, starterTeam);

      if (decidedTeam !== null) {
        this.handWinnerTeam = decidedTeam;
        this.scores[decidedTeam] += this.currentHandValue;
        const winnerName = this.players[decidedTeam]?.name || `Time ${decidedTeam + 1}`;
        this.addLog(winnerName, 'Venceu a mão', `+${this.currentHandValue} pontos`);

        if (this.scores[decidedTeam] >= config.WINNING_SCORE) {
          this.gameOver = true;
          this.winnerTeam = decidedTeam;
          this.addLog(winnerName, 'Venceu a partida!', '');
        }
        return true;
      }

      if (roundWinner !== null) {
        this.roundStarter = roundWinner;
        this.turnPlayerIndex = roundWinner;
      } else {
        this.turnPlayerIndex = this.roundStarter;
      }
      this.currentRound++;
    } else {
      this.turnPlayerIndex = (playerIndex - 1 + this.maxPlayers) % this.maxPlayers;
    }

    return true;
  }

  requestTruco(playerIndex) {
    if (!this.started || this.gameOver || this.challenge || this.handWinnerTeam !== null) return false;
    if (playerIndex !== this.turnPlayerIndex) return false;

    const nextLevel = nextTrucoLevel(this.currentHandValue);
    if (!nextLevel) return false;

    let opponentIndex = (playerIndex - 1 + this.maxPlayers) % this.maxPlayers;
    while (this.players[opponentIndex].team === this.players[playerIndex].team) {
      opponentIndex = (opponentIndex - 1 + this.maxPlayers) % this.maxPlayers;
    }

    this.challenge = {
      level: nextLevel,
      previousValue: this.currentHandValue,
      challenger: playerIndex,
      waitingOn: opponentIndex
    };

    return true;
  }

  respondTruco(playerIndex, response) {
    if (!this.challenge || this.gameOver || this.handWinnerTeam !== null) return false;
    if (playerIndex !== this.challenge.waitingOn) return false;

    const { level, previousValue, challenger } = this.challenge;

    if (response === 'flee') {
      const challengerTeam = this.players[challenger].team;
      this.scores[challengerTeam] += previousValue;
      const name = this.players[challenger].name;
      this.addLog(name, 'Fugiu do truco', `perdeu ${previousValue} pontos`);

      if (this.scores[challengerTeam] >= config.WINNING_SCORE) {
        this.gameOver = true;
        this.winnerTeam = challengerTeam;
        this.addLog(name, 'Venceu a partida!', '');
      }
      this.challenge = null;
      if (!this.gameOver) this.resetForNextHand();
      return true;
    }

    if (response === 'accept') {
      this.currentHandValue = level;
      const name = this.players[playerIndex].name;
      this.addLog(name, 'Aceitou o truco', `nível ${level}`);
      this.challenge = null;
      return true;
    }

    if (response === 'raise') {
      const newLevel = nextTrucoLevel(level);
      if (!newLevel) return false;
      this.challenge = {
        level: newLevel,
        previousValue: level,
        challenger: playerIndex,
        waitingOn: challenger
      };
      const name = this.players[playerIndex].name;
      this.addLog(name, 'Aumentou o truco', `nível ${newLevel}`);
      return true;
    }

    return false;
  }

  timeout(playerIndex) {
    if (!this.started || this.gameOver || this.handWinnerTeam !== null || this.challenge) return false;
    if (playerIndex !== this.turnPlayerIndex) return false;

    const player = this.players[playerIndex];
    this.addLog(player.name, 'Tempo esgotado', 'perdeu a mão');

    const opponent = this.players.find(
      (p, idx) => idx !== playerIndex && p.team !== player.team
    );

    if (opponent) {
      this.handWinnerTeam = opponent.team;
      this.scores[opponent.team] += this.currentHandValue;
      if (this.scores[opponent.team] >= config.WINNING_SCORE) {
        this.gameOver = true;
        this.winnerTeam = opponent.team;
        this.addLog(opponent.name, 'Venceu a partida por tempo!', '');
      }
    }

    this.challenge = null;
    if (!this.gameOver) this.resetForNextHand();
    return true;
  }

  resetForNextHand() {
    const oldPlayers = this.players.map(p => ({
      id: p.id,
      token: p.token,
      name: p.name,
      connected: p.connected
    }));
    const scores = [...this.scores];
    const logs = [...this.logs];
    const turnTimeLimit = this.turnTimeLimit;
    const nextStarter = (this.handStarter - 1 + this.maxPlayers) % this.maxPlayers;

    const fresh = new Game(this.maxPlayers);
    for (let i = 0; i < this.maxPlayers; i++) {
      fresh.players[i].id = oldPlayers[i].id;
      fresh.players[i].token = oldPlayers[i].token;
      fresh.players[i].name = oldPlayers[i].name;
      fresh.players[i].connected = oldPlayers[i].connected;
    }

    fresh.scores = scores;
    fresh.logs = logs;
    fresh.turnTimeLimit = turnTimeLimit;
    fresh.started = true;
    fresh.handStarter = nextStarter;
    fresh.turnPlayerIndex = nextStarter;
    fresh.roundStarter = nextStarter;

    Object.assign(this, fresh);
  }

  restartGame() {
    const oldPlayers = this.players.map(p => ({
      id: p.id,
      token: p.token,
      name: p.name,
      connected: p.connected
    }));
    const logs = [...this.logs];
    const turnTimeLimit = this.turnTimeLimit;

    const fresh = new Game(this.maxPlayers);
    for (let i = 0; i < this.maxPlayers; i++) {
      fresh.players[i].id = oldPlayers[i].id;
      fresh.players[i].token = oldPlayers[i].token;
      fresh.players[i].name = oldPlayers[i].name;
      fresh.players[i].connected = oldPlayers[i].connected;
    }

    fresh.scores = [0, 0];
    fresh.logs = logs;
    fresh.turnTimeLimit = turnTimeLimit;
    fresh.started = true;

    Object.assign(this, fresh);
  }

  abortGame() {
    if (!this.started) return;

    this.started = false;
    this.gameOver = false;
    this.currentHandValue = 1;
    this.scores = [0, 0];
    this.rounds = [];
    this.roundResults = [];
    this.currentRound = 0;
    this.logs = [];
    this.challenge = null;
    this.handWinnerTeam = null;

    const deck = new Deck();
    for (const p of this.players) {
      p.hand = [deck.draw(), deck.draw(), deck.draw()];
    }

    this.vira = deck.draw();
    this.manilhaRank = RANKS[(RANKS.indexOf(this.vira.rank) + 1) % RANKS.length];
    const starter = Math.floor(Math.random() * this.maxPlayers);
    this.turnPlayerIndex = starter;
    this.roundStarter = starter;
    this.handStarter = starter;

    this.addLog('Sistema', 'Partida interrompida por saída de jogador', 'Voltando ao lobby');
  }
}

module.exports = Game;