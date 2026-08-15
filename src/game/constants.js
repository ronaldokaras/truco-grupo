/**
 * Constantes relacionadas ao jogo de Truco.
 * Define naipes, valores das cartas, ordem das manilhas, sequência de valores de truco e nomes dos níveis.
 * Essas constantes são usadas pelas classes de jogo e utilitários de comparação.
 */

const SUITS = ['ouros', 'espadas', 'copas', 'paus'];
const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
const MANILHA_SUIT_ORDER = ['ouros', 'espadas', 'copas', 'paus'];
const HAND_VALUE_STEPS = { 1: 3, 3: 6, 6: 9, 9: 12 };
const TRUCO_LEVEL_NAMES = { 3: 'TRUCO', 6: 'SEIS', 9: 'NOVE', 12: 'DOZE' };

module.exports = {
  SUITS,
  RANKS,
  MANILHA_SUIT_ORDER,
  HAND_VALUE_STEPS,
  TRUCO_LEVEL_NAMES
};