import { cn } from '@/lib/utils'
import { motion } from 'motion/react'

interface LotoNumberProps {
  number: number
  drawn?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'drawn' | 'ticket' // 'drawn' cho số đã đọc ở trên, 'ticket' cho số trong vé
}

export function LotoNumber({ number, drawn, size = 'md', variant = 'ticket' }: LotoNumberProps) {
  const isDrawnList = variant === 'drawn'
  
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'flex items-center justify-center font-bold',
        // Border radius: chỉ áp dụng cho số đã đọc ở trên, không áp dụng cho số trong vé
        isDrawnList ? 'rounded-md' : 'rounded-none',
        drawn 
          ? isDrawnList
            ? 'bg-orange-500 text-white border-orange-600' // Màu cam cho số đã đọc ở trên
            : ' text-primary-foreground' // Màu primary cho số trong vé
          : 'text-black',
        size === 'xs' && 'w-[22px] h-[22px] min-w-0 min-h-0 text-[10px] leading-none shrink-0',
        size === 'sm' && 'w-8 h-8 text-sm min-w-8 min-h-8',
        size === 'md' && 'w-10 h-10 text-base',
        size === 'lg' && 'w-12 h-12 text-lg'
      )}
    >
      {number}
    </motion.div>
  )
}
