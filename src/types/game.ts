export type GameType = 'loto' | 'baicao' | 'xidach'

export interface Player {
  id: string
  name: string
  isHost?: boolean
}

export interface RoomState {
  roomCode: string
  gameType: GameType
  players: Player[]
  hostId: string
  gameState?: unknown
}

// Lô tô types
export interface LotoGameState {
  drawnNumbers: number[]
  tickets: Record<string, number[][]> // playerId -> 3 rows x 5 numbers
  winner?: string
  winType?: 'line1' | 'line2' | 'full'
}

// Bài cào types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  suit: Suit
  rank: Rank
}

export interface BaicaoGameState {
  hands: Record<string, Card[]>
  scores: Record<string, number>
  specialHands: Record<string, 'batay' | 'bacao' | 'lieng' | null>
  winner?: string
  roundComplete: boolean
}

// Xì dách types
export interface XidachGameState {
  hands: Record<string, Card[]>
  dealerHand: Card[]
  scores: Record<string, number>
  dealerScore: number
  standing: Record<string, boolean>
  currentTurn?: string
  roundComplete: boolean
  results?: Record<string, 'win' | 'lose' | 'push'>
}
