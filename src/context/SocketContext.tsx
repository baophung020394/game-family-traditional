import React, { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { RoomState } from '@/types/game'
import { SocketContext } from './socketContextDef'

const SOCKET_URL = import.meta.env.DEV ? import.meta.env.VITE_SOCKET_URL : window.location.origin

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string | null>(null)

  useEffect(() => {
    const s = io(SOCKET_URL)
    queueMicrotask(() => setSocket(s))
    s.on('connect', () => {
      setConnected(true)
      setPlayerId(s.id ?? null)
    })
    s.on('disconnect', () => setConnected(false))
    s.on('room-state', (state: RoomState) => setRoomState(state))
    s.on('room-joined', ({ roomCode, gameType, player, gameState }) => {
      setRoomState(prev => {
        const isNewRoom = !prev || prev.roomCode !== roomCode
        return {
          roomCode,
          gameType: gameType || 'loto',
          players: isNewRoom ? [player] : (prev?.players ?? [player]),
          hostId: isNewRoom ? player.id : (prev?.hostId ?? player.id),
          gameState: isNewRoom ? (gameState || {}) : (gameState ?? prev?.gameState)
        }
      })
    })
    s.on('loto-update', ({ drawnNumbers, lastDrawn, kinhWinners, gameEnded }) => {
      setRoomState(prev => {
        if (!prev?.gameState) return prev
        return {
          ...prev,
          gameState: { ...prev.gameState, drawnNumbers, lastDrawn, kinhWinners: kinhWinners || [], gameEnded: !!gameEnded }
        }
      })
    })
    return () => { s.disconnect(); setSocket(null) }
  }, [])

  useEffect(() => {
    if (roomState?.roomCode) queueMicrotask(() => setRoomCode(roomState.roomCode))
  }, [roomState])

  return (
    <SocketContext.Provider value={{
      socket,
      connected,
      roomCode,
      roomState,
      playerId,
      playerName,
      setRoomCode,
      setRoomState,
      setPlayerName
    }}>
      {children}
    </SocketContext.Provider>
  )
}
