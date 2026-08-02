import { useEffect, useRef, useState } from 'react'

/**
 * QR scanning using the browser's native BarcodeDetector — no library, no CDN.
 * Available in Chrome/Edge on Android and desktop; elsewhere the component says
 * so plainly and the officer keeps using the manual field or a hardware scanner.
 */
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

const supported = () => 'BarcodeDetector' in window

export default function QrCamera({ onDetected }: { onDetected: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!active) return
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false

    const run = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor })
          .BarcodeDetector
        const detector = new Detector({ formats: ['qr_code'] })

        const tick = async () => {
          if (stopped || !videoRef.current) return
          try {
            const found = await detector.detect(videoRef.current)
            if (found.length) {
              onDetected(found[0].rawValue)
              setActive(false)
              return
            }
          } catch {
            // A single bad frame is not worth stopping the loop for.
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch (e) {
        setError(
          e instanceof Error && e.name === 'NotAllowedError'
            ? 'Izin kamera ditolak browser'
            : 'Kamera tidak dapat diakses'
        )
        setActive(false)
      }
    }
    run()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [active, onDetected])

  if (!supported()) {
    return (
      <p className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
        Browser ini belum mendukung pemindaian kamera bawaan. Gunakan Chrome/Edge, atau
        tetap pakai alat pemindai QR genggam yang mengisi kolom di atas.
      </p>
    )
  }

  return (
    <div className="mt-3">
      {active ? (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-36 w-36 rounded-2xl border-4 border-white/80" />
          </div>
          <button
            className="absolute right-3 top-3 rounded-lg bg-white/90 px-3 py-1 text-xs font-semibold"
            onClick={() => setActive(false)}
          >
            Tutup
          </button>
        </div>
      ) : (
        <button className="btn-ghost w-full" onClick={() => setActive(true)}>
          📷 Pindai dengan Kamera
        </button>
      )}
      {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  )
}
