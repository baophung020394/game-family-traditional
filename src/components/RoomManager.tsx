import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSocket } from '@/context/useSocket'
import type { GameType } from '@/types/game'
import { Copy, Users, ArrowLeft } from 'lucide-react'

interface RoomManagerProps {
  gameType: GameType
  gameTitle: string
  children: React.ReactNode
}

export function RoomManager({ gameType, gameTitle, children }: RoomManagerProps) {
  const [searchParams] = useSearchParams()
  const { socket, connected, roomState, playerId, setPlayerName } = useSocket()
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [action, setAction] = useState<'create' | 'join'>('create')
  const [joinCode, setJoinCode] = useState(searchParams.get('room') || '')

  useEffect(() => {
    const room = searchParams.get('room')
    if (room && room.length === 4 && !roomState?.roomCode) {
      setJoinCode(room)
      setAction('join')
      setShowNameDialog(true)
    }
  }, [searchParams])

  const handleCreateRoom = () => {
    setAction('create')
    setPendingName('')
    setShowNameDialog(true)
  }

  const handleJoinRoom = () => {
    setAction('join')
    setPendingName('')
    setShowNameDialog(true)
  }

  const submitName = () => {
    const name = pendingName.trim() || (action === 'create' ? 'Chủ phòng' : 'Người chơi')
    setPlayerName(name)
    if (action === 'create') {
      const code = Math.floor(1000 + Math.random() * 9000).toString()
      socket?.emit('create-room', { roomCode: code, gameType, playerName: name })
    } else {
      socket?.emit('join-room', { roomCode: joinCode, playerName: name })
    }
    setShowNameDialog(false)
  }

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomState?.roomCode}&game=${gameType}`
    navigator.clipboard.writeText(url)
  }

  const inRoom = roomState?.roomCode && (!roomState.gameType || roomState.gameType === gameType)

  return (
    <div className="min-h-screen bg-background p-4">
      <AnimatePresence mode="wait">
        {!inRoom ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md mx-auto space-y-6"
          >
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="w-4 h-4" /> Về trang chủ
            </Link>
            <h1 className="text-3xl font-bold text-center text-primary">{gameTitle}</h1>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {connected ? 'Bước 1: Tạo hoặc vào phòng' : 'Đang kết nối...'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCreateRoom}
                  disabled={!connected}
                >
                  Tạo phòng mới
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">hoặc</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Mã phòng (4 số)"
                    maxLength={4}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
                    disabled={!connected}
                    className="text-center text-lg"
                  />
                  <Button onClick={handleJoinRoom} disabled={!connected || joinCode.length !== 4}>
                    Vào phòng
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between flex-wrap gap-2">
              <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> Về trang chủ
              </Link>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Phòng:</span>
                <span className="font-mono font-bold text-primary">{roomState?.roomCode}</span>
                <Button variant="outline" size="sm" onClick={copyLink}>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy link
                </Button>
                <div className="flex items-center gap-2 text-sm border-l pl-2">
                  {(roomState?.players || []).map((p) => (
                    <span
                      key={p.id}
                      className={`px-2 py-1 rounded ${p.id === playerId ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                    >
                      {p.name} {p.isHost && '👑'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogHeader>
          <DialogTitle>
            {action === 'create' ? (
              <>Bước 1: Đặt tên (Chủ phòng)</>
            ) : (
              <>Bước 2: Đặt tên của bạn</>
            )}
          </DialogTitle>
        </DialogHeader>
        <DialogContent>
          {action === 'join' && (
            <p className="text-sm text-muted-foreground">Mã phòng: {joinCode}</p>
          )}
          <Input
            placeholder={action === 'create' ? 'Chủ phòng' : 'Tên của bạn'}
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitName()}
          />
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowNameDialog(false)}>
            Hủy
          </Button>
          <Button onClick={submitName}>Xác nhận</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
