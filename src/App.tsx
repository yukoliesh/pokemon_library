import React, { useRef, useState } from 'react'

const STORAGE_KEY = 'pokescan.react.cards.v1'

type ScannedCard = {
  id: string
  name: string
  imageDataUrl: string
  dateAdded: string
}

function loadCards(): ScannedCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.cards)) return parsed.cards
  } catch {}
  return []
}

function saveCards(cards: ScannedCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards }))
}

export default function App() {
  const [cards, setCards] = useState<ScannedCard[]>(() => loadCards())
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function onScanClick() {
    fileInputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const imageDataUrl = String(reader.result || '')
      const suggested = ''
      const name = (window.prompt('Card name', suggested) || 'Unknown').trim()
      const newCard: ScannedCard = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        imageDataUrl,
        dateAdded: new Date().toISOString(),
      }
      setCards((prev) => {
        const next = [newCard, ...prev]
        saveCards(next)
        return next
      })
      e.target.value = ''
    }
    reader.readAsDataURL(file)
  }

  const hasCards = cards.length > 0

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 backdrop-blur border-b border-slate-800/80 bg-slate-900/70">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-grid place-items-center w-7 h-7 rounded-full bg-gradient-to-b from-red-500 to-red-600 border border-white/20 shadow-inner">🎴</span>
            <span>PokéScan</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onScanClick}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 active:translate-y-px text-white shadow border border-sky-400/30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
              <span>Scan card</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChange}
              className="hidden"
            />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {!hasCards ? (
            <section className="min-h-[50vh] grid place-items-center text-center">
              <div className="grid place-items-center gap-3">
                <div className="text-6xl">📷</div>
                <h1 className="text-2xl font-semibold">Your library is empty</h1>
                <p className="text-slate-400">Add your first card by scanning it with your camera.</p>
                <button
                  onClick={onScanClick}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 active:translate-y-px text-white shadow border border-sky-400/30"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  <span>Scan your first card</span>
                </button>
              </div>
            </section>
          ) : (
            <section className="grid gap-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold">Scanned cards</h2>
                <div className="text-sm text-slate-400">{cards.length} item{cards.length === 1 ? '' : 's'}</div>
              </div>
              <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {cards.map((card) => (
                  <li key={card.id} className="bg-slate-800/60 border border-slate-700/70 rounded-xl overflow-hidden shadow">
                    <div className="bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={card.imageDataUrl} alt={card.name} className="w-full aspect-[3/4.2] object-cover" />
                    </div>
                    <div className="p-3">
                      <div className="font-medium line-clamp-1">{card.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{new Date(card.dateAdded).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-800/80 text-slate-400 text-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">Built with React, Vite, and Tailwind</div>
      </footer>
    </div>
  )
}
