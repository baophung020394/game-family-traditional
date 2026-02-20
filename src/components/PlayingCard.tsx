import { cn } from '@/lib/utils'

export interface CardData {
  suit: string
  rank: string
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const suitColors: Record<string, string> = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-gray-900 dark:text-gray-100',
  spades: 'text-gray-900 dark:text-gray-100',
}

interface PlayingCardProps {
  card: CardData
  hidden?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PlayingCard({ card, hidden, size = 'md', className }: PlayingCardProps) {
  if (hidden) {
    return (
      <div
        className={cn(
          'rounded-lg border-2 border-border bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center',
          size === 'sm' && 'w-10 h-14 text-lg',
          size === 'md' && 'w-14 h-20 text-2xl',
          size === 'lg' && 'w-20 h-28 text-3xl',
          className
        )}
      >
        <span className="text-muted-foreground">?</span>
      </div>
    )
  }

  const symbol = suitSymbols[card.suit]
  const color = suitColors[card.suit]

  return (
    <div
      className={cn(
        'rounded-lg border-2 border-border bg-white dark:bg-card shadow-md flex flex-col p-1',
        size === 'sm' && 'w-10 h-14 text-sm',
        size === 'md' && 'w-14 h-20 text-base',
        size === 'lg' && 'w-20 h-28 text-xl',
        className
      )}
    >
      <div className={cn('font-bold', color)}>
        {card.rank}
        {symbol}
      </div>
      <div className={cn('flex-1 flex items-center justify-center text-2xl', color)}>
        {symbol}
      </div>
      <div className={cn('font-bold rotate-180', color)}>
        {card.rank}
        {symbol}
      </div>
    </div>
  )
}
