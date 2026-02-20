import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { RoomManager } from '@/components/RoomManager'
import { PlayingCard } from '@/components/PlayingCard'
import { useSocket } from '@/context/useSocket'

const specialLabels: Record<string, string> = {
  batay: 'Ba Tây',
  bacao: 'Ba Cào',
  lieng: 'Liêng',
}

export default function BaicaoPage() {
  return (
    <RoomManager gameType="baicao" gameTitle="Bài Cào 3 Lá">
      <BaicaoGame />
    </RoomManager>
  )
}

function BaicaoGame() {
  const { socket, roomState, playerId } = useSocket()
  const gs = roomState?.gameState as {
    hands?: Record<string, { suit: string; rank: string }[]>
    scores?: Record<string, number>
    specialHands?: Record<string, string | null>
    winner?: string
    roundComplete?: boolean
  } | undefined
  const isHost = roomState?.hostId === playerId

  const handleNewRound = () => {
    socket?.emit('baicao-new-round')
  }

  if (!gs) return <div>Đang tải...</div>

  return (
    <div className="space-y-6">
      {gs.roundComplete && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center text-xl font-bold text-primary"
        >
          🎉 {roomState?.players.find(p => p.id === gs.winner)?.name} thắng!
        </motion.div>
      )}

      {isHost && (
        <div className="flex justify-center">
          <Button size="lg" onClick={handleNewRound}>
            Chia bài mới
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roomState?.players.map((p) => {
          const hand = gs.hands?.[p.id] || []
          const score = gs.scores?.[p.id]
          const special = gs.specialHands?.[p.id]
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-lg border p-4"
            >
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                {p.name} {p.id === playerId && '(Bạn)'}
                {special && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                    {specialLabels[special] || special}
                  </span>
                )}
              </h4>
              <div className="flex gap-1 justify-center">
                {hand.map((card, i) => (
                  <PlayingCard key={i} card={card} size="md" />
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground mt-2">
                Điểm: {special ? (specialLabels[special] || special) : `${score} nút`}
              </p>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
