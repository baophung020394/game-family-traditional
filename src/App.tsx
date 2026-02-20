import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { SocketProvider } from '@/context/SocketContext'
import { motion } from 'motion/react'
import LotoPage from '@/pages/LotoPage'
import BaicaoPage from '@/pages/BaicaoPage'
import XidachPage from '@/pages/XidachPage'

function HomePage() {
  const games = [
    { path: '/loto', title: 'Lô Tô', desc: 'Trò đọc số 1-90', emoji: '🎯' },
    { path: '/baicao', title: 'Bài Cào 3 Lá', desc: 'Ba cây, cào rùa', emoji: '🃏' },
    { path: '/xidach', title: 'Xì Dách', desc: '21 điểm', emoji: '♦️' },
  ]

  return (
    <div className="min-h-screen bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <h1 className="text-4xl font-bold text-center mb-2 text-primary">
          Game Dân Gian Việt Nam
        </h1>
        <p className="text-center text-muted-foreground mb-10">
          Chọn game để bắt đầu chơi
        </p>
        <div className="grid gap-4">
          {games.map((g, i) => (
            <motion.div
              key={g.path}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link to={g.path}>
                <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                  <span className="text-3xl">{g.emoji}</span>
                  <div>
                    <h2 className="font-semibold text-lg">{g.title}</h2>
                    <p className="text-sm text-muted-foreground">{g.desc}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/loto" element={<LotoPage />} />
          <Route path="/baicao" element={<BaicaoPage />} />
          <Route path="/xidach" element={<XidachPage />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  )
}

export default App
