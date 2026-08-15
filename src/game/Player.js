/**
 * Classe que representa um jogador.
 * Armazena identificadores de socket, token de reconexão, nome, time, mão e status de conexão.
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
  }
}

module.exports = Player;