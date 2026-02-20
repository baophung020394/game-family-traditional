import { createContext } from 'react'
import type { Socket } from 'socket.io-client'
import type { RoomState } from '@/types/game'

export interface SocketContextType {
  socket: Socket | null
  connected: boolean
  roomCode: string | null
  roomState: RoomState | null
  playerId: string | null
  playerName: string | null
  setRoomCode: (code: string | null) => void
  setRoomState: (state: RoomState | null) => void
  setPlayerName: (name: string | null) => void
}

export const SocketContext = createContext<SocketContextType | null>(null)
