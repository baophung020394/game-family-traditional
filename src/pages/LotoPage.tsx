import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { RoomManager } from '@/components/RoomManager'
import { LotoNumber } from '@/components/LotoNumber'
import { useSocket } from '@/context/useSocket'
import { useSpeakNumber } from '@/hooks/useSpeakNumber'
import { Volume2, VolumeX, RotateCcw, MousePointer2, Zap, Square, Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import useEmblaCarousel from 'embla-carousel-react'

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
  const [muted, setMuted] = useState(false)
  const [numberSizeLevel, setNumberSizeLevel] = useState<number>(() => {
    const saved = localStorage.getItem('loto-number-size')
    return saved ? parseInt(saved, 10) : 0
  })
  const [isMobile, setIsMobile] = useState(false)
  const lastSpokenRef = useRef<number | null>(null)
  const lastAnnouncedWinnersRef = useRef<string>('')
  const prevAutoMarkRef = useRef<boolean>(true)

  // Load number size from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('loto-number-size')
    if (saved) {
      queueMicrotask(() => setNumberSizeLevel(parseInt(saved, 10)))
    }
  }, [])

  // Save number size to localStorage
  const handleSetNumberSize = (level: number) => {
    const clamped = Math.max(0, Math.min(2, level))
    setNumberSizeLevel(clamped)
    localStorage.setItem('loto-number-size', clamped.toString())
  }

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

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
    if (muted) return
    lastSpokenRef.current = lastDrawn
    speak(lastDrawn).then(() => setIsSpeaking(false))
  }, [gs?.lastDrawn, speak, muted])

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
      queueMicrotask(() => setManualMarked(next))
    }
  }, [autoMark, myTickets, drawnNumbers])

  // Khi có người KINH: đọc tên người thắng bằng giọng nói (chỉ đọc một lần cho mỗi lần kết thúc ván)
  useEffect(() => {
    if (!gameEnded || !kinhWinners?.length || !roomState?.players || muted) return
    const key = kinhWinners.slice().sort().join(',')
    if (lastAnnouncedWinnersRef.current === key) return
    lastAnnouncedWinnersRef.current = key
    const names = kinhWinners
      .map((id) => roomState.players?.find((p) => p.id === id)?.name || 'Ai đó')
      .join(', ')
    const text = names ? `Chúc mừng ${names} đã KINH!` : 'KINH!'
    speakText(text)
  }, [gameEnded, kinhWinners, roomState?.players, speakText, muted])

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

  const isMarked = (num: number | null, ticketKey: string): boolean => {
    if (num === null || typeof num !== 'number') return false
    const n = Number(num)
    if (isNaN(n)) return false
    if (autoMark) {
      return drawnNumbers.some((drawn) => Number(drawn) === n)
    }
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

      <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4">
        <Button
          variant={muted ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => {
            setMuted(!muted)
            if (!muted) abort()
          }}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
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
              Tự điền
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
        <div className="flex items-center gap-1 border rounded-lg overflow-hidden bg-muted/50">
          <span className="text-xs sm:text-sm px-2 py-1.5 text-muted-foreground">Cỡ số:</span>
          <button
            type="button"
            onClick={() => handleSetNumberSize(numberSizeLevel - 1)}
            disabled={numberSizeLevel === 0}
            className="p-1.5 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleSetNumberSize(numberSizeLevel + 1)}
            disabled={numberSizeLevel === 2}
            className="p-1.5 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
        </div>
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
            <LotoNumber key={n} number={n} drawn size="md" variant="drawn" />
          ))}
        </AnimatePresence>
      </div>

      {hasSelectedTickets && myTickets && myTickets.length > 0 && (
        <div className="space-y-3 sm:space-y-4 min-w-0">
          {!isMobile && (
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold">Vé của bạn</h3>
              {drawnNumbers.length === 0 && (
                <Button variant="outline" size="sm" onClick={handleClearTickets}>
                  Chọn lại vé
                </Button>
              )}
            </div>
          )}
          
          {/* Mobile: Carousel */}
          {isMobile ? (
            <TicketCarousel
              tickets={myTickets as { color: string; grid?: (number | null)[][] }[]}
              colors={TICKET_COLORS}
              isMarked={isMarked}
              toggleManualMark={toggleManualMark}
              autoMark={autoMark}
            />
          ) : (
            /* Desktop: Grid layout */
            <div className="flex flex-wrap justify-center gap-3 sm:gap-6 overflow-x-auto pb-2">
              {(myTickets as { color: string; grid?: (number | null)[][] }[]).map((ticket, ti) => {
                const ticketKey = `${ticket.color}-${ti}`
                const ticketColors = TICKET_COLORS[ticket.color] || { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-400' }
                return (
                  <TicketCard
                    key={ticketKey}
                    ticket={ticket}
                    ticketKey={ticketKey}
                    colors={ticketColors}
                    cellWidth={30}
                    cellHeight={80}
                    isMarked={isMarked}
                    toggleManualMark={toggleManualMark}
                    autoMark={autoMark}
                    isMobile={false}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Component TicketCard để render từng vé
function TicketCard({
  ticket,
  ticketKey,
  colors,
  cellWidth,
  cellHeight,
  isMarked,
  toggleManualMark,
  autoMark,
  isMobile = false,
}: {
  ticket: { color: string; grid?: (number | null)[][] }
  ticketKey: string
  colors: { bg: string; border: string }
  cellWidth: number
  cellHeight: number
  isMarked: (num: number | null, ticketKey: string) => boolean
  toggleManualMark: (key: string) => void
  autoMark: boolean
  isMobile?: boolean
}) {
  const grid = ticket.grid || []
  const ticketWidth = isMobile ? '100%' : cellWidth * 9 + 24 // 24 = border + padding
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border-2 p-0 bg-white flex flex-col shadow-md",
        colors.border,
        "flex-shrink-0"
      )}
      style={{ width: ticketWidth }}
    >
      {/* Hình số 1: Khoảng trắng trên cùng với text TÂN TÂN và hoa văn */}
      <div className="bg-white py-2 border-b border-black w-full">
        <div className="flex items-center justify-center gap-2 relative">
          <div className="absolute inset-0 flex items-center justify-center gap-1">
            {Array.from({ length: 200 }).map((_, i) => (
              <svg key={i} width="6" height="6" viewBox="0 0 6 6" className="text-yellow-500">
                <path
                  d="M3 0 L3.5 2.5 L6 3 L3.5 3.5 L3 6 L2.5 3.5 L0 3 L2.5 2.5 Z"
                  fill="currentColor"
                />
              </svg>
            ))}
          </div>
          <span className="font-bold text-lg relative z-10 bg-white px-2">TÂN TÂN</span>
        </div>
      </div>
      <div className="flex relative w-full">
        {/* Hình số 2: Khoảng trắng trái với hoa văn dọc */}
        <div className="bg-white border-r border-black flex flex-col items-center justify-center relative overflow-hidden" style={{ width: '12px' }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 py-1">
            {Array.from({ length: Math.ceil((grid.length * cellHeight) / 8) }).map((_, i) => (
              <svg key={i} width="6" height="6" viewBox="0 0 6 6" className="text-yellow-500">
                <path
                  d="M3 0 L3.5 2.5 L6 3 L3.5 3.5 L3 6 L2.5 3.5 L0 3 L2.5 2.5 Z"
                  fill="currentColor"
                />
              </svg>
            ))}
          </div>
        </div>
        {/* Grid content */}
        <div className="flex flex-col flex-1">
          {Array.from({ length: 3 }).map((_, blockIdx) => {
            const startRow = blockIdx * 3
            const endRow = Math.min(startRow + 3, grid.length)
            const blockRows = grid.slice(startRow, endRow)
            return (
              <div key={`${ticketKey}-block-${blockIdx}`} className="flex flex-col">
                {/* Hình số 3: Khoảng trắng giữa các block với hoa văn */}
                {blockIdx > 0 && (
                  <div className="bg-white flex items-center justify-center relative overflow-hidden border-y border-black w-full" style={{ height: '12px' }}>
                    <div className="absolute inset-0 flex items-center justify-center gap-1">
                      {/* Hoa văn bên trái */}
                      <div className="flex items-center gap-1 flex-1 justify-end pr-2">
                        {Array.from({ length: Math.ceil(50) }).map((_, i) => (
                          <svg key={`left-${i}`} width="6" height="6" viewBox="0 0 6 6" className="text-yellow-500">
                            <path
                              d="M3 0 L3.5 2.5 L6 3 L3.5 3.5 L3 6 L2.5 3.5 L0 3 L2.5 2.5 Z"
                              fill="currentColor"
                            />
                          </svg>
                        ))}
                      </div>
                      {/* Text ở giữa */}
                      <span className="text-yellow-500 font-semibold text-xs relative z-10 bg-white px-2 whitespace-nowrap" style={{ fontFamily: 'cursive' }}>
                        Mã đáo thành công
                      </span>
                      {/* Hoa văn bên phải */}
                      <div className="flex items-center gap-1 flex-1 justify-start pl-2">
                        {Array.from({ length: Math.ceil(50) }).map((_, i) => (
                          <svg key={`right-${i}`} width="6" height="6" viewBox="0 0 6 6" className="text-yellow-500">
                            <path
                              d="M3 0 L3.5 2.5 L6 3 L3.5 3.5 L3 6 L2.5 3.5 L0 3 L2.5 2.5 Z"
                              fill="currentColor"
                            />
                          </svg>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="border border-black" style={{ borderWidth: '1px', width: isMobile ? '100%' : cellWidth * 9 }}>
                  <div className="grid grid-cols-9" style={{ gap: 0, width: isMobile ? '100%' : cellWidth * 9 }}>
                    {blockRows.map((row, ri) =>
                      (row || []).map((cell, ci) => {
                        const actualRowIdx = startRow + ri
                        const isFirstRow = ri === 0
                        const isFirstCol = ci === 0
                        return (
                          <div
                            key={`${ticketKey}-${actualRowIdx}-${ci}`}
                            className={cn(
                              "flex items-center justify-center box-border border border-black",
                              typeof cell === 'number' && isMarked(cell, ticketKey) 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-white'
                            )}
                            style={{
                              width: isMobile ? '100%' : cellWidth,
                              height: isMobile ? cellHeight : cellHeight,
                              margin: 0,
                              padding: 0,
                              marginTop: isFirstRow ? 0 : '-1px',
                              marginLeft: isFirstCol ? 0 : '-1px'
                            }}
                          >
                            {typeof cell === 'number' ? (
                              <button
                                type="button"
                                onClick={() => toggleManualMark(`${ticketKey}-${cell}`)}
                                className={`flex items-center justify-center w-full h-full ${!autoMark ? 'cursor-pointer' : 'cursor-default'}`}
                                disabled={autoMark}
                                style={{ margin: 0, padding: 0 }}
                              >
                                <LotoNumber
                                  number={cell}
                                  drawn={isMarked(cell, ticketKey)}
                                  size="xs"
                                />
                              </button>
                            ) : (
                              <span className={`w-full h-full box-border ${colors.bg}`} style={{ margin: 0, padding: 0 }} />
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {/* Hình số 2: Khoảng trắng phải với hoa văn dọc */}
        <div className="bg-white border-l border-black flex flex-col items-center justify-center relative overflow-hidden" style={{ width: '12px' }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 py-1">
            {Array.from({ length: Math.ceil((grid.length * cellHeight) / 8) }).map((_, i) => (
              <svg key={i} width="6" height="6" viewBox="0 0 6 6" className="text-yellow-500">
                <path
                  d="M3 0 L3.5 2.5 L6 3 L3.5 3.5 L3 6 L2.5 3.5 L0 3 L2.5 2.5 Z"
                  fill="currentColor"
                />
              </svg>
            ))}
          </div>
        </div>
      </div>
      {/* Hình số 4: Khoảng trắng dưới cùng với text TÂN TÂN TỐT NHẤT và hoa văn */}
      <div className="bg-white py-2 border-t border-black w-full">
        <div className="flex items-center justify-center gap-2 relative">
          <div className="absolute inset-0 flex items-center justify-center gap-1 overflow-hidden">
            {Array.from({ length: Math.ceil(100) }).map((_, i) => (
              <svg key={i} width="6" height="6" viewBox="0 0 6 6" className="text-yellow-500">
                <path
                  d="M3 0 L3.5 2.5 L6 3 L3.5 3.5 L3 6 L2.5 3.5 L0 3 L2.5 2.5 Z"
                  fill="currentColor"
                />
              </svg>
            ))}
          </div>
          <span className="font-bold text-lg relative z-10 bg-white px-2">TÂN TÂN TỐT NHẤT</span>
        </div>
      </div>
    </motion.div>
  )
}

// Component TicketCarousel cho mobile
function TicketCarousel({
  tickets,
  colors,
  isMarked,
  toggleManualMark,
  autoMark,
}: {
  tickets: { color: string; grid?: (number | null)[][] }[]
  colors: Record<string, { bg: string; border: string }>
  isMarked: (num: number | null, ticketKey: string) => boolean
  toggleManualMark: (key: string) => void
  autoMark: boolean
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'start' })
  const [prevBtnEnabled, setPrevBtnEnabled] = useState(false)
  const [nextBtnEnabled, setNextBtnEnabled] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dimensions, setDimensions] = useState({ cellWidth: 0, cellHeight: 0 })

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext()
  }, [emblaApi])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
    setPrevBtnEnabled(emblaApi.canScrollPrev())
    setNextBtnEnabled(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    queueMicrotask(() => onSelect())
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
  }, [emblaApi, onSelect])

  // Tính toán cellWidth và cellHeight động để vừa màn hình
  useEffect(() => {
    const calculateDimensions = () => {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Tính chiều cao các phần cố định của vé
      const headerHeight = 50 // py-2 + border + text
      const footerHeight = 50 // py-2 + border + text
      const gapBetweenBlocks = 12 * 2 // 2 khoảng trắng giữa 3 blocks
      const ticketBorder = 4 // border top + bottom
      const fixedHeight = headerHeight + footerHeight + gapBetweenBlocks + ticketBorder
      
      // Trừ đi các phần khác (drawn numbers ~60px, navigation ~50px, spacing ~30px)
      const otherElementsHeight = 140
      
      // Chiều cao còn lại cho grid (9 rows)
      const availableHeight = viewportHeight - fixedHeight - otherElementsHeight
      const cellHeight = Math.max(20, Math.floor(availableHeight / 9)) // Tối thiểu 20px
      
      // Tính cellWidth từ viewport
      const sideBorderWidth = 12 * 2 // 2 bên hoa văn
      const ticketBorderWidth = 4 // border của vé
      const availableWidth = viewportWidth - sideBorderWidth - ticketBorderWidth - 16 // padding của slide
      const cellWidth = Math.floor(availableWidth / 9) // 9 cột
      
      setDimensions({ cellWidth, cellHeight })
    }
    
    calculateDimensions()
    window.addEventListener('resize', calculateDimensions)
    window.addEventListener('orientationchange', calculateDimensions)
    
    return () => {
      window.removeEventListener('resize', calculateDimensions)
      window.removeEventListener('orientationchange', calculateDimensions)
    }
  }, [])

  const { cellWidth, cellHeight } = dimensions

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-2">
        <h3 className="text-base font-semibold">Vé của bạn ({selectedIndex + 1}/{tickets.length})</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={scrollPrev}
            disabled={!prevBtnEnabled}
            className={cn(
              "p-1 rounded-full border",
              prevBtnEnabled ? "hover:bg-muted cursor-pointer" : "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={scrollNext}
            disabled={!nextBtnEnabled}
            className={cn(
              "p-1 rounded-full border",
              nextBtnEnabled ? "hover:bg-muted cursor-pointer" : "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      {cellWidth > 0 && cellHeight > 0 && (
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {tickets.map((ticket, ti) => {
              const ticketKey = `${ticket.color}-${ti}`
              const ticketColors = colors[ticket.color] || { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-400' }
              return (
                <div key={ticketKey} className="flex-[0_0_100%] min-w-0 px-2">
                  <TicketCard
                    ticket={ticket}
                    ticketKey={ticketKey}
                    colors={ticketColors}
                    cellWidth={cellWidth}
                    cellHeight={cellHeight}
                    isMarked={isMarked}
                    toggleManualMark={toggleManualMark}
                    autoMark={autoMark}
                    isMobile={true}
                  />
                </div>
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
