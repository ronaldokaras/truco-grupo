/**
 * Configurações gerais do servidor.
 * Centraliza constantes como porta, CORS, tempos de limpeza e pontuação para vencer.
 * Utilize variáveis de ambiente quando necessário (ex.: process.env.PORT).
 */

module.exports = {
  PORT: process.env.PORT || 3000,
  CORS_ORIGIN: '*',
  ROOM_IDLE_MS: 2 * 60 * 60 * 1000,
  CLEANUP_INTERVAL_MS: 15 * 60 * 1000,
  WINNING_SCORE: 12,
  ROOM_CODE_LENGTH: 4
};