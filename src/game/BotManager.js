/**
 * Gerenciador de bots.
 * Observa o estado do jogo e agenda ações automáticas para jogadores controlados por computador.
 * As decisões são baseadas na força da mão, placar e contexto do jogo.
 */

const { compareCards } = require('./cardUtils');
const { sendStateAndCheckBots } = require('../sockets/utils');

class BotManager {
  constructor() {
    this.pendingActions = new Set();
    this.lastScheduledTurn = -1;  // evita agendar o mesmo turno repetidamente
    this.emitting = false;        // debounce para envio de estado
  }

  scheduleBotActions(io, roomManager, room) {
    const game = room.game;
    if (!game || game.gameOver || !game.started) return;

    if (game.waitingElevenDecision && game.elevenDecisionTeam !== null) {
      this._handleElevenDecision(io, roomManager, room);
      return;
    }

    if (game.challenge) {
      this._handleTrucoResponse(io, roomManager, room);
      return;
    }

    const currentPlayer = game.players[game.turnPlayerIndex];
    if (currentPlayer && currentPlayer.isBot && currentPlayer.hand.length > 0) {
      if (this.lastScheduledTurn !== game.turnPlayerIndex) {
        this._scheduleBotPlay(io, roomManager, room);
      }
    }
  }

  _scheduleBotPlay(io, roomManager, room) {
    const game = room.game;
    const botIndex = game.turnPlayerIndex;
    const bot = game.players[botIndex];

    if (this.pendingActions.has(bot.id)) return;
    this.pendingActions.add(bot.id);
    this.lastScheduledTurn = botIndex;

    const delay = 800 + Math.random() * 1500;
    setTimeout(() => {
      this.pendingActions.delete(bot.id);

      if (!room.game || room.game !== game || game.gameOver) return;
      if (game.turnPlayerIndex !== botIndex) return;
      if (game.challenge || game.waitingElevenDecision) return;
      if (bot.hand.length === 0) return;

      if (game.ironHand) {
        const index = Math.floor(Math.random() * bot.hand.length);
        game.playCard(botIndex, { index });
      } else {
        const card = this._chooseCard(game, botIndex);
        if (card) {
          game.playCard(botIndex, card);
        }
      }

      this._emitStateAndSchedule(io, roomManager, room);
    }, delay);
  }

  _chooseCard(game, playerIndex) {
    const player = game.players[playerIndex];
    const hand = player.hand;
    if (!hand.length) return null;

    let bestTableCard = null;
    const currentRound = game.rounds[game.currentRound];
    if (currentRound && currentRound.cards.length > 0) {
      const cards = currentRound.cards;
      let bestIdx = 0;
      for (let i = 1; i < cards.length; i++) {
        if (compareCards(cards[bestIdx].card, cards[i].card, game.manilhaRank) === 'B') {
          bestIdx = i;
        }
      }
      bestTableCard = cards[bestIdx].card;
    }

    if (!bestTableCard) {
      return this._getStrongestCard(hand, game.manilhaRank);
    }

    const winningCards = hand.filter(c => compareCards(c, bestTableCard, game.manilhaRank) === 'A');
    if (winningCards.length > 0) {
      winningCards.sort((a, b) => {
        const comp = compareCards(a, b, game.manilhaRank);
        if (comp === 'A') return 1;
        if (comp === 'B') return -1;
        return 0;
      });
      return winningCards[0];
    }

    return this._getWeakestCard(hand, game.manilhaRank);
  }

  _getStrongestCard(hand, manilhaRank) {
    let strongest = hand[0];
    for (const card of hand) {
      if (compareCards(card, strongest, manilhaRank) === 'A') {
        strongest = card;
      }
    }
    return strongest;
  }

  _getWeakestCard(hand, manilhaRank) {
    let weakest = hand[0];
    for (const card of hand) {
      if (compareCards(card, weakest, manilhaRank) === 'B') {
        weakest = card;
      }
    }
    return weakest;
  }

  _handleTrucoResponse(io, roomManager, room) {
    const game = room.game;
    const waitingIndex = game.challenge.waitingOn;
    const bot = game.players[waitingIndex];
    if (!bot || !bot.isBot) return;

    if (this.pendingActions.has(bot.id)) return;
    this.pendingActions.add(bot.id);

    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      this.pendingActions.delete(bot.id);
      if (!room.game || room.game !== game || game.challenge === null) return;

      const decision = this._decideTrucoResponse(game, waitingIndex);
      game.respondTruco(waitingIndex, decision);

      this._emitStateAndSchedule(io, roomManager, room);
    }, delay);
  }

  _decideTrucoResponse(game, playerIndex) {
    const player = game.players[playerIndex];
    const handStrength = this._evaluateHandStrength(player.hand, game.manilhaRank);
    const level = game.challenge.level;
    const myTeam = player.team;
    const opponentTeam = 1 - myTeam;
    const scoreDiff = game.scores[myTeam] - game.scores[opponentTeam];
    const riskFactor = scoreDiff < -3 ? 0.7 : (scoreDiff < 0 ? 0.5 : 0.3);

    if (handStrength >= 8) {
      if (level < 9 && Math.random() < 0.3 + riskFactor * 0.2) return 'raise';
      return 'accept';
    } else if (handStrength >= 5) {
      if (level < 6 && Math.random() < 0.1 + riskFactor * 0.3) return 'raise';
      if (Math.random() < 0.5 + riskFactor * 0.2) return 'accept';
      return 'flee';
    } else {
      if (level === 3 && Math.random() < 0.2 + riskFactor * 0.3) return 'accept';
      if (level >= 6 && Math.random() < 0.2) return 'accept';
      return 'flee';
    }
  }

  _evaluateHandStrength(hand, manilhaRank) {
    let score = 0;
    for (const card of hand) {
      const value = card.getValue(manilhaRank);
      if (value.type === 'manilha') {
        score += 4 + value.suitStrength;
      } else {
        score += value.rankStrength + 1;
      }
    }
    return score;
  }

  _handleElevenDecision(io, roomManager, room) {
    const game = room.game;
    const decisionTeam = game.elevenDecisionTeam;
    if (decisionTeam === null || !game.waitingElevenDecision) return;

    const botIndex = game.players.findIndex(p => p.team === decisionTeam && p.isBot && p.connected);
    if (botIndex === -1) return;

    const key = `eleven-${decisionTeam}`;
    if (this.pendingActions.has(key)) return;
    this.pendingActions.add(key);

    setTimeout(() => {
      this.pendingActions.delete(key);
      if (!room.game || room.game !== game || !game.waitingElevenDecision) return;

      const teamPlayers = game.players.filter(p => p.team === decisionTeam);
      let totalStrength = 0;
      for (const p of teamPlayers) {
        totalStrength += this._evaluateHandStrength(p.hand, game.manilhaRank);
      }
      const averageStrength = totalStrength / teamPlayers.length;

      const shouldPlay = averageStrength >= 6 || (averageStrength >= 4 && Math.random() < 0.4);
      const decision = shouldPlay ? 'play' : 'flee';

      game.handleElevenDecision(botIndex, decision);
      this._emitStateAndSchedule(io, roomManager, room);
    }, 1500 + Math.random() * 1000);
  }

  _emitStateAndSchedule(io, roomManager, room) {
    if (this.emitting) return;
    this.emitting = true;
    setTimeout(() => {
      this.emitting = false;
      sendStateAndCheckBots(io, roomManager, room, this);
    }, 0);
  }
}

module.exports = BotManager;