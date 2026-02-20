import { useRef } from 'react'

/**
 * Chrome: getVoices() trả về [] lần đầu vì voices load bất đồng bộ.
 * Chờ sự kiện voiceschanged trước khi dùng.
 */
function getVoicesReady(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const voices = synth.getVoices()
  if (voices.length > 0) return Promise.resolve(voices)
  return new Promise((resolve) => {
    const onVoicesChanged = () => {
      const v = synth.getVoices()
      if (v.length > 0) {
        synth.removeEventListener('voiceschanged', onVoicesChanged)
        resolve(v)
      }
    }
    synth.addEventListener('voiceschanged', onVoicesChanged)
    // Fallback: Chrome đôi khi đã fire voiceschanged trước khi ta listen
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', onVoicesChanged)
      resolve(synth.getVoices())
    }, 500)
  })
}

/**
 * Đọc số bằng Web Speech API (miễn phí, có sẵn trên trình duyệt).
 * Sửa lỗi Chrome: voices load async, đọc được rồi ngừng sau một thời gian.
 */
/**
 * Chrome: âm thanh chỉ phát sau user gesture. Gọi unlockAudio() ngay trong handler
 * khi user bấm "Bốc số" để: (1) resume AudioContext, (2) phát một utterance ngắn
 * để trang được "mở khóa", sau đó speak() gọi từ useEffect mới có tiếng.
 */
function unlockAudio(): void {
  if (typeof window === 'undefined') return

  // 1) Mở khóa Web Audio (Chrome) – resume trong user gesture
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      const ctx = new AudioContextClass()
      if (ctx.state === 'suspended') ctx.resume()
    }
  } catch {
    // ignore
  }

  // 2) Gọi getVoices() trong user gesture để Chrome bắt đầu load voices
  if (!window.speechSynthesis) return
  const synth = window.speechSynthesis
  synth.resume()
  synth.getVoices()

  // 3) Phát utterance ngắn (ký tự nghe được) để Chrome mở khóa phát âm sau này
  const u = new SpeechSynthesisUtterance('.')
  u.volume = 0.1
  u.rate = 15
  synth.speak(u)
}

export function useSpeakNumber() {
  const synthRef = useRef<SpeechSynthesis | null>(null)

  const speak = async (num: number): Promise<void> => {
    const tag = '[Speech]'
    console.log(`${tag} speak(${num}) được gọi`)

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn(`${tag} speechSynthesis không tồn tại`)
      return
    }
    const synth = window.speechSynthesis
    synthRef.current = synth

    // Chrome: chờ voices load xong (getVoices() = [] lần đầu)
    const voices = await getVoicesReady(synth)
    console.log(`${tag} Danh sách voices (${voices.length}):`, voices.map((v) => `${v.name} (${v.lang})`))

    const utterance = new SpeechSynthesisUtterance(String(num))
    utterance.lang = 'vi-VN'
    utterance.rate = 0.9

    const localVi = voices.find((v) => v.lang.startsWith('vi') && v.localService)
    const vi = voices.find((v) => v.lang.startsWith('vi'))
    const anyVoice = voices[0] // fallback: bất kỳ giọng nào cũng được
    if (localVi) {
      utterance.voice = localVi
      console.log(`${tag} Dùng giọng: ${localVi.name} (local)`)
    } else if (vi) {
      utterance.voice = vi
      console.log(`${tag} Dùng giọng: ${vi.name}`)
    } else if (anyVoice) {
      utterance.voice = anyVoice
      console.log(`${tag} Không có vi-VN, dùng: ${anyVoice.name}`)
    }

    return new Promise((resolve) => {
      utterance.onstart = () => console.log(`${tag} Bắt đầu đọc: ${num}`)
      utterance.onend = () => {
        console.log(`${tag} Đã đọc xong: ${num}`)
        resolve()
      }
      utterance.onerror = (e) => {
        console.error(`${tag} Lỗi khi đọc ${num}:`, e.error, e.name)
        resolve()
      }

      synth.resume()
      synth.cancel()
      setTimeout(() => {
        synth.resume()
        synth.speak(utterance)
      }, 100)
    })
  }

  /** Đọc đoạn văn bản (ví dụ tên người thắng). */
  const speakText = async (text: string): Promise<void> => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text?.trim()) return
    const synth = window.speechSynthesis
    synthRef.current = synth
    const voices = await getVoicesReady(synth)
    const utterance = new SpeechSynthesisUtterance(text.trim())
    utterance.lang = 'vi-VN'
    utterance.rate = 0.9
    const localVi = voices.find((v) => v.lang.startsWith('vi') && v.localService)
    const vi = voices.find((v) => v.lang.startsWith('vi'))
    const anyVoice = voices[0]
    if (localVi) utterance.voice = localVi
    else if (vi) utterance.voice = vi
    else if (anyVoice) utterance.voice = anyVoice
    return new Promise((resolve) => {
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      synth.resume()
      synth.cancel()
      setTimeout(() => {
        synth.resume()
        synth.speak(utterance)
      }, 100)
    })
  }

  /** Dừng đọc ngay (giống abort trong SpeechRecognition). */
  const abort = (): void => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
  }

  return { speak, speakText, unlockAudio, abort }
}
