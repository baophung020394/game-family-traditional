import { cn } from '@/lib/utils'
import { motion } from 'motion/react'

interface LotoNumberProps {
  number: number
  drawn?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

export function LotoNumber({ number, drawn, size = 'md' }: LotoNumberProps) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'rounded-md border flex items-center justify-center font-bold overflow-hidden',
        drawn ? 'bg-primary text-primary-foreground border-primary' : 'bg-card',
        size === 'xs' && 'w-[22px] h-[22px] min-w-0 min-h-0 text-[10px] leading-none shrink-0 border',
        size === 'sm' && 'w-8 h-8 text-sm min-w-8 min-h-8 border-2',
        size === 'md' && 'w-10 h-10 text-base',
        size === 'lg' && 'w-12 h-12 text-lg'
      )}
    >
      {number}
    </motion.div>
  )
}
