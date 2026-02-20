import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { RoomManager } from '@/components/RoomManager'
import { LotoNumber } from '@/components/LotoNumber'
import { useSocket } from '@/context/useSocket'
import { useSpeakNumber } from '@/hooks/useSpeakNumber'
import { Volume2, RotateCcw, MousePointer2, Zap, Square } from 'lucide-react'

const TICKET_COLORS: Record<string, { bg: string; border: string }> = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-500' },
  green: { bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-500' },
  pink: { bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-500' },
  brown: { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-700' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-500' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-500' },
}

const TICKET_LABELS: Record<string, string> = {
  blue: 'Xanh dương',
  green: 'Xanh lá cây',
  pink: 'Hồng',
  brown: 'Nâu',
  yellow: 'Vàng',
  orange: 'Cam',
}

export default function LotoPage() {
  return (
    <RoomManager gameType="loto" gameTitle="Lô Tô">
      <LotoGame />
    </RoomManager>
  )
}

function LotoGame() {
  const { socket, roomState, playerId } = useSocket()
  const { speak, speakText, unlockAudio, abort } = useSpeakNumber()
  const [autoMark, setAutoMark] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [manualMarked, setManualMarked] = useState<Set<string>>(new Set())
  const lastSpokenRef = useRef<number | null>(null)
  const lastAnnouncedWinnersRef = useRef<string>('')
  const prevAutoMarkRef = useRef<boolean>(true)

  const gs = roomState?.gameState as {
    drawnNumbers?: number[]
    ticketPool?: { color: string; grid: (number | null)[][] }[]
    tickets?: Record<string, { color: string; grid: (number | null)[][] }[]>
    kinhWinners?: string[]
    gameEnded?: boolean
    lastDrawn?: number
  } | undefined

  const isHost = roomState?.hostId === playerId
  const myTickets = gs?.tickets?.[playerId || '']
  const ticketPool = gs?.ticketPool || []
  const drawnNumbers = Array.isArray(gs?.drawnNumbers) ? gs.drawnNumbers.map(Number) : []
  const kinhWinners = gs?.kinhWinners || []
  const gameEnded = gs?.gameEnded
  // Chỉ coi là "đã chọn vé" khi CÓ CẢ ticketPool VÀ vé đã chọn (tránh state cũ/cache)
  const hasSelectedTickets =
    ticketPool.length > 0 && Array.isArray(myTickets) && myTickets.length > 0
  // BẮT BUỘC chọn vé từ danh sách trước khi vào game - không tự động chọn
  const mustSelectTickets = ticketPool.length > 0 && !hasSelectedTickets

  // Reset ref khi reset bàn (0 số đã bốc) để lần bốc tiếp theo đọc đúng và có thể đọc tên người thắng ván mới
  useEffect(() => {
    if ((drawnNumbers?.length ?? 0) === 0) {
      lastSpokenRef.current = null
      lastAnnouncedWinnersRef.current = ''
    }
  }, [drawnNumbers?.length])

  // Chỉ đọc số vừa bốc (lastDrawn mới), tránh đọc lặp 12=>44 khi chỉ vừa bốc 44
  useEffect(() => {
    const lastDrawn = gs?.lastDrawn
    if (typeof lastDrawn !== 'number') return
    if (lastSpokenRef.current === lastDrawn) return
    lastSpokenRef.current = lastDrawn
    speak(lastDrawn).then(() => setIsSpeaking(false))
  }, [gs?.lastDrawn, speak])

  // Khi chuyển từ Tự điền sang Tự bấm: giữ lại các ô đã đánh dấu (đồng bộ drawnNumbers vào manualMarked)
  useEffect(() => {
    const wasAuto = prevAutoMarkRef.current
    prevAutoMarkRef.current = autoMark
    if (wasAuto && !autoMark && Array.isArray(myTickets) && drawnNumbers.length > 0) {
      const next = new Set<string>()
      myTickets.forEach((ticket: { color: string; grid?: (number | null)[][] }, ti: number) => {
        const ticketKey = `${ticket.color}-${ti}`
        const grid = ticket.grid || []
        grid.forEach((row: (number | null)[]) => {
          (row || []).forEach((cell) => {
            if (typeof cell === 'number' && drawnNumbers.includes(cell)) next.add(`${ticketKey}-${cell}`)
          })
        })
      })
      setManualMarked(next)
    }
  }, [autoMark, myTickets, drawnNumbers])

  // Khi có người KINH: đọc tên người thắng bằng giọng nói (chỉ đọc một lần cho mỗi lần kết thúc ván)
  useEffect(() => {
    if (!gameEnded || !kinhWinners?.length || !roomState?.players) return
    const key = kinhWinners.slice().sort().join(',')
    if (lastAnnouncedWinnersRef.current === key) return
    lastAnnouncedWinnersRef.current = key
    const names = kinhWinners
      .map((id) => roomState.players?.find((p) => p.id === id)?.name || 'Ai đó')
      .join(', ')
    const text = names ? `Chúc mừng ${names} đã KINH!` : 'KINH!'
    speakText(text)
  }, [gameEnded, kinhWinners, roomState?.players, speakText])

  const handleSelectTickets = (indices: number[]) => {
    socket?.emit('loto-select-tickets', { selectedIndices: indices })
  }

  const handleClearTickets = () => {
    socket?.emit('loto-clear-my-tickets')
  }

  const handleDraw = () => {
    unlockAudio() // Chrome: phải gọi speak trong user gesture thì sau này mới có tiếng
    setIsSpeaking(true)
    socket?.emit('loto-draw')
  }

  const handleAbortSpeak = () => {
    abort()
    setIsSpeaking(false)
  }

  const handleReset = () => {
    socket?.emit('loto-reset')
    setManualMarked(new Set())
  }

  const toggleManualMark = (key: string) => {
    if (autoMark) return
    setManualMarked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const isMarked = (num: number, ticketKey: string) => {
    const n = Number(num)
    if (autoMark) return drawnNumbers.includes(n)
    return manualMarked.has(`${ticketKey}-${num}`)
  }

  // Chưa có gameState (đang tải)
  if (roomState && !gs && roomState.gameType === 'loto') {
    return <p className="text-center text-muted-foreground">Đang tải phòng...</p>
  }

  // Chưa có danh sách vé - đợi từ server
  if (roomState?.roomCode && ticketPool.length === 0 && !hasSelectedTickets) {
    return <p className="text-center text-muted-foreground">Đang tải danh sách vé...</p>
  }

  // Bước chọn vé - BẮT BUỘC cho cả chủ phòng và người chơi trước khi vào game
  if (mustSelectTickets) {
    return (
      <LotoTicketSelection
        ticketPool={ticketPool}
        onConfirm={handleSelectTickets}
        isHost={isHost}
      />
    )
  }

  return (
    <div className="space-y-6">
      {isHost && (
        <div className="flex justify-center items-center gap-3 flex-wrap">
          <Button
            size="lg"
            onClick={handleDraw}
            disabled={gameEnded || drawnNumbers.length >= 90 || isSpeaking}
          >
            {isSpeaking ? 'Đang đọc...' : `Bốc số (${drawnNumbers.length}/90)`}
          </Button>
          {isSpeaking && (
            <Button variant="destructive" size="lg" onClick={handleAbortSpeak}>
              <Square className="w-4 h-4 mr-1" />
              Hủy đọc
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset bàn
          </Button>
        </div>
      )}

      <div className="flex justify-center items-center gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Volume2 className="w-4 h-4" />
          Đọc số bằng giọng nói
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm">Đánh dấu:</span>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              type="button"
              onClick={() => setAutoMark(true)}
              className={`px-3 py-1.5 text-sm flex items-center gap-1 ${
                autoMark ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              <Zap className="w-4 h-4" />
              Tự động
            </button>
            <button
              type="button"
              onClick={() => setAutoMark(false)}
              className={`px-3 py-1.5 text-sm flex items-center gap-1 ${
                !autoMark ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              <MousePointer2 className="w-4 h-4" />
              Tự bấm
            </button>
          </div>
        </label>
      </div>

      {gameEnded && (kinhWinners || []).length > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center space-y-1"
        >
          <p className="text-xl font-bold text-primary">KINH! Ván kết thúc</p>
          <p className="text-lg">
            {(kinhWinners || [])
              .map((id) => roomState?.players?.find((p) => p.id === id)?.name || 'Ai đó')
              .join(', ')}{' '}
            đủ hàng!
          </p>
        </motion.div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        <AnimatePresence>
          {(drawnNumbers || []).map((n) => (
            <LotoNumber key={n} number={n} drawn size="md" />
          ))}
        </AnimatePresence>
      </div>

      {hasSelectedTickets && myTickets && myTickets.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Vé của bạn</h3>
            {drawnNumbers.length === 0 && (
              <Button variant="outline" size="sm" onClick={handleClearTickets}>
                Chọn lại vé
              </Button>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {(myTickets as { color: string; grid?: (number | null)[][] }[]).map((ticket, ti) => {
              const grid = ticket.grid || []
              const ticketKey = `${ticket.color}-${ti}`
              const colors = TICKET_COLORS[ticket.color] || { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-400' }
              return (
                <motion.div
                  key={ticketKey}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border-2 p-3 w-[232px] flex-shrink-0 ${colors.bg} ${colors.border} flex flex-col items-center shadow-md`}
                >
                  <p className="text-sm font-semibold mb-3 text-center w-full">
                    {TICKET_LABELS[ticket.color] || ticket.color}
                  </p>
                  <div className="grid grid-cols-9 gap-px w-[204px]">
                    {(grid as (number | null)[][]).map((row, ri) =>
                      (row || []).map((cell, ci) => (
                        <div
                          key={`${ticketKey}-${ri}-${ci}`}
                          className="flex items-center justify-center w-[22px] h-[22px] box-border"
                        >
                          {typeof cell === 'number' ? (
                            <button
                              type="button"
                              onClick={() => toggleManualMark(`${ticketKey}-${cell}`)}
                              className={`flex items-center justify-center w-full h-full ${!autoMark ? 'cursor-pointer' : 'cursor-default'}`}
                              disabled={autoMark}
                            >
                              <LotoNumber
                                number={cell}
                                drawn={isMarked(cell, ticketKey)}
                                size="xs"
                              />
                            </button>
                          ) : (
                            <span className="w-[22px] h-[22px] rounded-sm bg-white/50 dark:bg-black/10 box-border" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Nhóm ticketPool theo màu: mỗi màu có 2 vé (1-90, 45 số/vé, không trùng nhau)
function groupTicketsByColor(
  ticketPool: { color: string; grid: (number | null)[][] }[]
): { color: string; tickets: { grid: (number | null)[][]; index: number }[] }[] {
  const byColor: Record<string, { grid: (number | null)[][]; index: number }[]> = {}
  ;(ticketPool || []).forEach((t, i) => {
    if (!byColor[t.color]) byColor[t.color] = []
    byColor[t.color].push({ grid: t.grid || [], index: i })
  })
  const order = ['blue', 'green', 'pink', 'brown', 'yellow', 'orange']
  return order
    .filter((c) => byColor[c])
    .map((color) => ({ color, tickets: byColor[color] }))
}

function LotoTicketSelection({
  ticketPool,
  onConfirm,
  isHost,
}: {
  ticketPool: { color: string; grid: (number | null)[][] }[]
  onConfirm: (indices: number[]) => void
  isHost?: boolean
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const grouped = groupTicketsByColor(ticketPool)

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleConfirm = () => {
    if (selected.size > 0) {
      onConfirm([...selected])
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-6 pb-8"
    >
      <div className="text-center">
        <p className="text-xs font-medium text-primary mb-1">
          {isHost ? 'Bước 2: Chọn vé' : 'Bước 3: Chọn vé'}
        </p>
        <h2 className="text-xl font-semibold">Chọn vé của bạn</h2>
      </div>
      <p className="text-sm text-muted-foreground text-center">
        6 màu vé, mỗi màu có 2 vé (1-90, 45 số/vé, không trùng). Nhấn vào vé để chọn/bỏ chọn.
      </p>

      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-4">
        <h3 className="text-base font-bold text-center">📋 DANH SÁCH VÉ</h3>
        {grouped.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Chưa có vé. Đang tải...</p>
        ) : (
        <>
        {grouped.map(({ color, tickets }) => {
          const colors = TICKET_COLORS[color] || TICKET_COLORS.blue
          const label = TICKET_LABELS[color] || color
          return (
            <div
              key={color}
              className={`rounded-lg border-2 p-4 ${colors.bg} ${colors.border}`}
            >
              <h3 className="text-sm font-semibold mb-3 text-center">{label}</h3>
              <div className="grid grid-cols-2 gap-4">
                {tickets.map((t, idxInColor) => {
                  const isSelected = selected.has(t.index)
                  const grid = t.grid || []
                  return (
                    <button
                      key={t.index}
                      type="button"
                      onClick={() => toggle(t.index)}
                      className={`rounded-lg border-2 p-2 text-left transition-all bg-white dark:bg-card flex flex-col items-center ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="text-xs font-medium mb-1">
                        Vé {idxInColor + 1}
                        {isSelected && ' ✓'}
                      </p>
                      <div className="grid grid-cols-9 gap-px">
                        {(grid as (number | null)[][]).map((row, ri) =>
                          (row || []).map((cell, ci) => (
                            <span
                              key={`${ri}-${ci}`}
                              className="text-[8px] w-3 h-3 flex items-center justify-center rounded border"
                            >
                              {typeof cell === 'number' ? cell : ''}
                            </span>
                          ))
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        </>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button onClick={handleConfirm} disabled={selected.size === 0} size="lg">
          Xác nhận chọn {selected.size} vé
        </Button>
        <p className="text-xs text-muted-foreground">
          Sau khi xác nhận, danh sách vé sẽ đóng và bạn bắt đầu chơi với các vé đã chọn.
        </p>
      </div>
    </motion.div>
  )
}
