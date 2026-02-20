import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { RoomManager } from '@/components/RoomManager'
import { PlayingCard } from '@/components/PlayingCard'
import { useSocket } from '@/context/useSocket'

export default function XidachPage() {
  return (
    <RoomManager gameType="xidach" gameTitle="Xì Dách">
      <XidachGame />
    </RoomManager>
  )
}

function XidachGame() {
  const { socket, roomState, playerId } = useSocket()
  const gs = roomState?.gameState as {
    hands?: Record<string, { suit: string; rank: string }[]>
    dealerHand?: { suit: string; rank: string }[]
    scores?: Record<string, number>
    dealerScore?: number
    standing?: Record<string, boolean>
    currentTurn?: string
    roundComplete?: boolean
    results?: Record<string, 'win' | 'lose' | 'push'>
  } | undefined
  const isHost = roomState?.hostId === playerId
  const isMyTurn = gs?.currentTurn === playerId && !gs?.roundComplete

  const handleHit = () => socket?.emit('xidach-hit')
  const handleStand = () => socket?.emit('xidach-stand')
  const handleNewRound = () => socket?.emit('xidach-new-round')

  if (!gs) return <div>Đang tải...</div>

  const resultLabels = { win: 'Thắng! 🎉', lose: 'Thua', push: 'Hòa' }

  return (
    <div className="space-y-6">
      {gs.roundComplete && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center space-y-1"
        >
          <p className="font-semibold">Nhà cái: {gs.dealerScore} điểm</p>
          {roomState?.players
            .filter(p => p.id !== roomState.hostId)
            .map((p) => (
              <p key={p.id}>
                {p.name}: {gs.scores?.[p.id]} điểm - {gs.results?.[p.id] && resultLabels[gs.results[p.id]]}
              </p>
            ))}
        </motion.div>
      )}

      {isHost && gs.roundComplete && (
        <div className="flex justify-center gap-2">
          <Button onClick={handleNewRound}>Ván mới</Button>
        </div>
      )}

      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Nhà cái</h3>
        <div className="flex gap-1">
          {gs.dealerHand?.map((card, i) => (
            <PlayingCard
              key={i}
              card={card}
              hidden={!gs.roundComplete && i === 1}
            />
          ))}
        </div>
        {gs.roundComplete && <p>Điểm: {gs.dealerScore}</p>}
      </div>

      {roomState?.players?.filter((p) => p.id !== roomState.hostId).length === 0 && (
        <p className="text-center text-muted-foreground">Đang chờ người chơi tham gia...</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {roomState?.players
          ?.filter((p) => p.id !== roomState.hostId)
          .map((p) => {
            const hand = gs.hands?.[p.id] || []
            const score = gs.scores?.[p.id]
            const standing = gs.standing?.[p.id]
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-lg border p-4 ${p.id === playerId ? 'border-primary bg-primary/5' : 'bg-card'}`}
              >
                <h4 className="font-semibold mb-2">
                  {p.name} {p.id === playerId && '(Bạn)'}
                  {standing && ' - Đã dừng'}
                </h4>
                <div className="flex gap-1 flex-wrap">
                  {hand.map((card, i) => (
                    <PlayingCard key={i} card={card} size="md" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Điểm: {score ?? '-'}</p>
                {p.id === playerId && isMyTurn && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={handleHit}>
                      Rút bài
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleStand}>
                      Dừng
                    </Button>
                  </div>
                )}
              </motion.div>
            )
          })}
      </div>
    </div>
  )
}
