import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: { origin: '*' }
})

const rooms = new Map() // roomCode -> { gameType, players, gameState, hostId }

const LOTO_COLORS = ['blue', 'green', 'pink', 'brown', 'yellow', 'orange']

// Kích thước mỗi thập cột: cột 0 = 1-9 (9 số), cột 1 = 10-19 (10), ..., cột 8 = 80-90 (11)
const DECADE_SIZES = [9, 10, 10, 10, 10, 10, 10, 10, 11]

// Tạo 1 vé: grid 9x9, mỗi hàng 5 số, mỗi cột j đúng colCount[j] số. randomRows: true = xáo vị trí dọc trong cột (đẹp hơn), false = luôn chọn hàng ít dùng trước.
function buildTicketGrid(colCounts, numbersByCol, randomRows = true) {
  const grid = Array(9).fill(null).map(() => Array(9).fill(null))
  const rowCount = Array(9).fill(0)
  for (let j = 0; j < 9; j++) {
    const need = colCounts[j]
    const available = rowCount.map((c, r) => (c < 5 ? { r, c } : null)).filter(x => x != null)
    if (available.length < need) throw new Error(`buildTicketGrid: cột ${j} cần ${need} hàng, chỉ còn ${available.length}`)
    available.sort((a, b) => a.c - b.c)
    if (randomRows) {
      for (let i = available.length - 1; i > 0; i--) {
        const k = Math.floor(Math.random() * (i + 1))
        ;[available[i], available[k]] = [available[k], available[i]]
      }
    }
    const chosen = available.slice(0, need).map(x => x.r).sort((a, b) => a - b)
    for (const r of chosen) {
      grid[r][j] = true
      rowCount[r]++
    }
  }
  for (let j = 0; j < 9; j++) {
    const rowsWithCell = []
    for (let r = 0; r < 9; r++) if (grid[r][j] === true) rowsWithCell.push(r)
    rowsWithCell.sort((a, b) => a - b)
    const nums = numbersByCol[j] || []
    for (let k = 0; k < nums.length && k < rowsWithCell.length; k++) {
      const r = rowsWithCell[k]
      if (r >= 0 && r < 9) grid[r][j] = nums[k]
    }
  }
  return grid
}

function tryBuildTicketGrid(colCounts, numbersByCol, randomRows) {
  const maxAttempts = randomRows ? 40 : 1
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return buildTicketGrid(colCounts, numbersByCol, randomRows)
    } catch (_) {
      if (!randomRows) throw _
    }
  }
  return buildTicketGrid(colCounts, numbersByCol, false)
}

// Trả về pool 12 vé (6 màu x 2 vé). Cùng màu: 2 vé không trùng số. Mỗi vé 45 số, grid 9x9.
function generateTicketPool() {
  const pool = []
  for (const color of LOTO_COLORS) {
    const decades = DECADE_SIZES.map((size, j) => {
      const start = j === 0 ? 1 : j * 10
      const end = j === 8 ? 90 : j * 10 + 9
      const arr = []
      for (let n = start; n <= end; n++) arr.push(n)
      return shuffle(arr)
    })
    const colCounts1 = [4, 5, 5, 5, 5, 5, 5, 5, 6]
    const colCounts2 = [5, 4, 5, 5, 5, 5, 5, 5, 5]
    const numbersByCol1 = decades.map((arr, j) => arr.slice(0, colCounts1[j]).sort((a, b) => a - b))
    const numbersByCol2 = decades.map((arr, j) => arr.slice(colCounts1[j], colCounts1[j] + colCounts2[j]).sort((a, b) => a - b))
    pool.push({ color, grid: tryBuildTicketGrid(colCounts1, numbersByCol1, true) })
    pool.push({ color, grid: tryBuildTicketGrid(colCounts2, numbersByCol2, true) })
  }
  return pool
}

function createDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades']
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const deck = []
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank })
    }
  }
  return deck
}

function shuffle(deck) {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

function getBaicaoScore(cards) {
  const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 1 }
  const sum = cards.reduce((s, c) => s + values[c.rank], 0)
  return sum % 10
}

function checkBaicaoSpecial(cards) {
  const ranks = cards.map(c => c.rank)
  if (ranks.every(r => ['J', 'Q', 'K'].includes(r))) return 'batay'
  if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) return 'bacao'
  const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 }
  const sorted = [...ranks].sort((a, b) => values[a] - values[b])
  const v = sorted.map(r => values[r])
  if ((v[1] - v[0] === 1 && v[2] - v[1] === 1) || (v[0] === 2 && v[1] === 3 && v[2] === 14)) return 'lieng'
  return null
}

function getXidachScore(cards) {
  const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11 }
  let sum = 0
  let aces = 0
  for (const c of cards) {
    if (c.rank === 'A') aces++
    else sum += values[c.rank]
  }
  for (let i = 0; i < aces; i++) {
    sum += (sum + 11 <= 21) ? 11 : 1
  }
  return sum
}

io.on('connection', (socket) => {
  socket.on('create-room', ({ roomCode, gameType, playerName }) => {
    if (rooms.has(roomCode)) {
      socket.emit('error', { message: 'Mã phòng đã tồn tại' })
      return
    }
    const player = { id: socket.id, name: playerName || 'Chủ phòng', isHost: true }
    let gameState = null
    if (gameType === 'loto') {
      gameState = {
        drawnNumbers: [],
        ticketPool: generateTicketPool(),
        tickets: {},
        kinhWinners: [],
        gameEnded: false
      }
    } else if (gameType === 'baicao') {
      const deck = shuffle(createDeck())
      const hands = {}
      const playerIds = [socket.id]
      for (const pid of playerIds) {
        hands[pid] = deck.splice(0, 3)
      }
      const scores = {}
      const specialHands = {}
      for (const pid of playerIds) {
        specialHands[pid] = checkBaicaoSpecial(hands[pid])
        scores[pid] = specialHands[pid] ? 10 : getBaicaoScore(hands[pid])
      }
      gameState = { hands, scores, specialHands, winner: null, roundComplete: false }
    } else if (gameType === 'xidach') {
      const deck = shuffle(createDeck())
      const dealerHand = deck.splice(0, 2)
      const dealerScore = getXidachScore(dealerHand)
      gameState = {
        hands: {},
        dealerHand,
        scores: {},
        dealerScore,
        standing: {},
        currentTurn: null,
        roundComplete: false,
        deck
      }
    }
    rooms.set(roomCode, {
      gameType,
      players: [player],
      hostId: socket.id,
      gameState
    })
    socket.join(roomCode)
    socket.roomCode = roomCode
    socket.emit('room-joined', { roomCode, gameType, player, gameState, isHost: true })
    socket.to(roomCode).emit('player-joined', { player })
    socket.emit('room-state', { roomCode, gameType, players: [player], gameState, hostId: socket.id })
  })

  socket.on('join-room', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode)
    if (!room) {
      socket.emit('error', { message: 'Không tìm thấy phòng' })
      return
    }
    const player = { id: socket.id, name: playerName || `Người chơi ${room.players.length + 1}`, isHost: false }
    room.players.push(player)
    socket.join(roomCode)
    socket.roomCode = roomCode

    if (room.gameType === 'loto') {
      // User chọn vé sau khi vào phòng
    } else if (room.gameType === 'baicao') {
      const deck = room.gameState.deck || shuffle(createDeck())
      if (!room.gameState.deck) room.gameState.deck = deck
      room.gameState.hands[socket.id] = deck.splice(0, 3)
      room.gameState.specialHands[socket.id] = checkBaicaoSpecial(room.gameState.hands[socket.id])
      room.gameState.scores[socket.id] = room.gameState.specialHands[socket.id] ? 10 : getBaicaoScore(room.gameState.hands[socket.id])
    } else if (room.gameType === 'xidach') {
      const deck = room.gameState.deck || shuffle(createDeck())
      if (!room.gameState.deck) room.gameState.deck = deck
      room.gameState.hands[socket.id] = deck.splice(0, 2)
      room.gameState.scores[socket.id] = getXidachScore(room.gameState.hands[socket.id])
      room.gameState.standing[socket.id] = false
      if (!room.gameState.currentTurn) room.gameState.currentTurn = socket.id
    }

    socket.emit('room-joined', { roomCode, gameType: room.gameType, player, gameState: room.gameState, isHost: false })
    io.to(roomCode).emit('room-state', {
      roomCode,
      gameType: room.gameType,
      players: room.players,
      gameState: room.gameState,
      hostId: room.hostId
    })
  })

  socket.on('loto-draw', () => {
    const roomCode = socket.roomCode
    const room = rooms.get(roomCode)
    if (!room || room.hostId !== socket.id || room.gameType !== 'loto') return
    const gs = room.gameState
    if (gs.gameEnded || gs.drawnNumbers.length >= 90) return
    let num
    do { num = Math.floor(Math.random() * 90) + 1 } while (gs.drawnNumbers.includes(num))
    gs.drawnNumbers.push(num)
    gs.drawnNumbers.sort((a, b) => a - b)

    // Kiểm tra KINH: user nào đủ 1 hàng (5 số) trở lên thì ván kết thúc
    const kinhWinners = new Set()
    for (const [pid, playerTickets] of Object.entries(gs.tickets)) {
      for (const t of playerTickets) {
        const grid = t.grid || []
        const hasFullRow = grid.some(row => {
          const nums = (row || []).filter(c => typeof c === 'number')
          return nums.length === 5 && nums.every(n => gs.drawnNumbers.includes(n))
        })
        if (hasFullRow) {
          kinhWinners.add(pid)
          break
        }
      }
    }
    if (kinhWinners.size > 0) {
      gs.gameEnded = true
      gs.kinhWinners = [...kinhWinners]
    }

    io.to(roomCode).emit('loto-update', {
      drawnNumbers: gs.drawnNumbers,
      lastDrawn: num,
      kinhWinners: gs.kinhWinners,
      gameEnded: gs.gameEnded
    })
  })

  socket.on('loto-select-tickets', ({ selectedIndices }) => {
    const roomCode = socket.roomCode
    const room = rooms.get(roomCode)
    if (!room || room.gameType !== 'loto') return
    const gs = room.gameState
    const playerTickets = []
    for (const i of selectedIndices) {
      if (i >= 0 && i < 12) {
        const t = gs.ticketPool[i]
        playerTickets.push({ color: t.color, grid: t.grid })
      }
    }
    if (playerTickets.length > 0) {
      gs.tickets[socket.id] = playerTickets
      io.to(roomCode).emit('room-state', {
        roomCode,
        gameType: room.gameType,
        players: room.players,
        gameState: room.gameState,
        hostId: room.hostId
      })
    }
  })

  socket.on('loto-clear-my-tickets', () => {
    const roomCode = socket.roomCode
    const room = rooms.get(roomCode)
    if (!room || room.gameType !== 'loto') return
    const gs = room.gameState
    if ((gs.drawnNumbers?.length || 0) > 0) return // Không cho đổi vé khi đã bốc số
    delete gs.tickets[socket.id]
    io.to(roomCode).emit('room-state', {
      roomCode,
      gameType: room.gameType,
      players: room.players,
      gameState: room.gameState,
      hostId: room.hostId
    })
  })

  socket.on('loto-reset', () => {
    const roomCode = socket.roomCode
    const room = rooms.get(roomCode)
    if (!room || room.hostId !== socket.id || room.gameType !== 'loto') return
    const gs = room.gameState
    gs.drawnNumbers = []
    gs.kinhWinners = []
    gs.gameEnded = false
    io.to(roomCode).emit('loto-update', {
      drawnNumbers: [],
      lastDrawn: null,
      kinhWinners: [],
      gameEnded: false
    })
  })

  socket.on('baicao-new-round', () => {
    const roomCode = socket.roomCode
    const room = rooms.get(roomCode)
    if (!room || room.hostId !== socket.id || room.gameType !== 'baicao') return
    const deck = shuffle(createDeck())
    const hands = {}
    const scores = {}
    const specialHands = {}
    for (const p of room.players) {
      hands[p.id] = deck.splice(0, 3)
      specialHands[p.id] = checkBaicaoSpecial(hands[p.id])
      scores[p.id] = specialHands[p.id] ? 10 : getBaicaoScore(hands[p.id])
    }
    let winner = null
    let maxScore = -1
    for (const [pid, special] of Object.entries(specialHands)) {
      if (special) {
        winner = pid
        break
      }
    }
    if (!winner) {
      for (const [pid, score] of Object.entries(scores)) {
        if (score > maxScore) {
          maxScore = score
          winner = pid
        }
      }
    }
    room.gameState = { hands, scores, specialHands, winner, roundComplete: true }
    io.to(roomCode).emit('room-state', { roomCode, gameType: room.gameType, players: room.players, gameState: room.gameState, hostId: room.hostId })
  })

  socket.on('xidach-hit', () => {
    const roomCode = socket.roomCode
    const room = rooms.get(roomCode)
    if (!room || room.gameType !== 'xidach') return
    const gs = room.gameState
    if (gs.currentTurn !== socket.id || gs.roundComplete) return
    const deck = gs.deck || shuffle(createDeck())
    if (!gs.deck) gs.deck = deck
    gs.hands[socket.id].push(deck.shift())
    gs.scores[socket.id] = getXidachScore(gs.hands[socket.id])
    if (gs.scores[socket.id] > 21) {
      gs.standing[socket.id] = true
      const pids = room.players.filter(p => p.id !== room.hostId).map(p => p.id)
      const next = pids.find(pid => !gs.standing[pid])
      if (!next) {
        gs.roundComplete = true
        const dealerScore = getXidachScore(gs.dealerHand)
        while (dealerScore < 16 && gs.dealerHand.length < 5) {
          gs.dealerHand.push(gs.deck.shift())
        }
        gs.dealerScore = getXidachScore(gs.dealerHand)
        gs.results = {}
        for (const p of room.players) {
          if (p.id === room.hostId) continue
          const ps = gs.scores[p.id] || 0
          if (ps > 21) gs.results[p.id] = 'lose'
          else if (dealerScore > 21) gs.results[p.id] = 'win'
          else if (ps > dealerScore) gs.results[p.id] = 'win'
          else if (ps < dealerScore) gs.results[p.id] = 'lose'
          else gs.results[p.id] = 'push'
        }
      } else gs.currentTurn = next
    }
    io.to(roomCode).emit('room-state', { roomCode, gameType: room.gameType, players: room.players, gameState: gs, hostId: room.hostId })
  })

  socket.on('xidach-stand', () => {
    const roomCode = socket.roomCode
    const room = rooms.get(roomCode)
    if (!room || room.gameType !== 'xidach') return
    const gs = room.gameState
    if (gs.currentTurn !== socket.id || gs.roundComplete) return
    gs.standing[socket.id] = true
    const pids = room.players.map(p => p.id).filter(id => id !== room.hostId)
    const next = pids.find(pid => !gs.standing[pid])
    if (!next) {
      gs.roundComplete = true
      const dealerScore = getXidachScore(gs.dealerHand)
      while (dealerScore < 16 && gs.dealerHand.length < 5) {
        gs.dealerHand.push(gs.deck.shift())
      }
      gs.dealerScore = getXidachScore(gs.dealerHand)
      gs.results = {}
      for (const p of room.players) {
        if (p.id === room.hostId) continue
        const ps = gs.scores[p.id] || 0
        if (ps > 21) gs.results[p.id] = 'lose'
        else if (gs.dealerScore > 21) gs.results[p.id] = 'win'
        else if (ps > gs.dealerScore) gs.results[p.id] = 'win'
        else if (ps < gs.dealerScore) gs.results[p.id] = 'lose'
        else gs.results[p.id] = 'push'
      }
    } else gs.currentTurn = next
    io.to(roomCode).emit('room-state', { roomCode, gameType: room.gameType, players: room.players, gameState: gs, hostId: room.hostId })
  })

  socket.on('xidach-new-round', () => {
    const roomCode = socket.roomCode
    const room = rooms.get(roomCode)
    if (!room || room.hostId !== socket.id || room.gameType !== 'xidach') return
    const deck = shuffle(createDeck())
    const hands = {}
    const scores = {}
    const standing = {}
    const dealerHand = deck.splice(0, 2)
    const dealerScore = getXidachScore(dealerHand)
    for (const p of room.players) {
      if (p.id === room.hostId) continue
      hands[p.id] = deck.splice(0, 2)
      scores[p.id] = getXidachScore(hands[p.id])
      standing[p.id] = false
    }
    const firstPlayer = room.players.find(p => p.id !== room.hostId)?.id || null
    room.gameState = {
      hands,
      dealerHand,
      scores,
      dealerScore,
      standing,
      currentTurn: firstPlayer,
      roundComplete: false,
      deck
    }
    io.to(roomCode).emit('room-state', { roomCode, gameType: room.gameType, players: room.players, gameState: room.gameState, hostId: room.hostId })
  })

  socket.on('disconnect', () => {
    const roomCode = socket.roomCode
    if (roomCode) {
      const room = rooms.get(roomCode)
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id)
        if (room.players.length === 0) rooms.delete(roomCode)
        else {
          if (room.hostId === socket.id) {
            room.hostId = room.players[0].id
            room.players[0].isHost = true
          }
          io.to(roomCode).emit('room-state', {
            roomCode,
            gameType: room.gameType,
            players: room.players,
            gameState: room.gameState,
            hostId: room.hostId
          })
        }
      }
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`)
})
