/**
 * Classe que representa um jogador.
 * Armazena identificadores de socket, token de reconexão, nome, time, mão e status de conexão.
 * Também indica se o jogador é controlado por um bot (isBot).
 * É instanciada para cada jogador no início do jogo.
 */

class Player {
  constructor(name, team, index) {
    this.id = '';
    this.token = '';
    this.name = name || `Jogador ${index + 1}`;
    this.team = team;
    this.hand = [];
    this.connected = false;
    this.isBot = false; // Indica se é um bot (controlado pelo servidor)
  }

  // Define este jogador como bot
  setBot(name) {
    this.isBot = true;
    this.name = name || this.name;
    this.connected = true;
    this.id = `bot-${Date.now()}-${Math.floor(Math.random() * 1000)}`; // ID fictício
    this.token = ''; // Bots não precisam de token
  }
}

module.exports = Player;