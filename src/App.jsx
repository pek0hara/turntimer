import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_COLORS = [
  '#E74C3C', // red
  '#3498DB', // blue
  '#2ECC71', // green
  '#F39C12', // orange
  '#9B59B6', // purple
  '#1ABC9C', // teal
  '#E91E63', // pink
  '#FF5722', // deep-orange
]

const TIME_PRESETS = [[1, 0], [3, 0], [5, 0], [10, 0], [15, 0], [20, 0]]
const INC_PRESETS  = [0, 5, 10, 15, 20, 30]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(s) {
  if (s <= 0) return '0:00.0'
  const m  = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  const t  = Math.floor((s % 1) * 10)
  return `${m}:${ss.toString().padStart(2, '0')}.${t}`
}

function playBeep(ctx, freq = 880, dur = 0.1, vol = 0.3) {
  if (!ctx) return
  try {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start()
    osc.stop(ctx.currentTime + dur)
  } catch (_) {}
}

// ─── SetupScreen ──────────────────────────────────────────────────────────────

function SetupScreen({ onStart, initialSettings }) {
  const [numPlayers, setNumPlayers] = useState(initialSettings?.numPlayers ?? 4)
  const [minutes,    setMinutes]    = useState(initialSettings ? Math.floor(initialSettings.initialTime / 60) : 5)
  const [seconds,    setSeconds]    = useState(initialSettings ? initialSettings.initialTime % 60 : 0)
  const [increment,  setIncrement]  = useState(initialSettings?.increment ?? 10)
  const [names, setNames] = useState(
    initialSettings
      ? [...initialSettings.names, ...Array.from({ length: 8 - initialSettings.names.length }, (_, i) => `プレイヤー ${initialSettings.names.length + i + 1}`)]
      : Array.from({ length: 8 }, (_, i) => `プレイヤー ${i + 1}`)
  )

  const updateName = (i, v) => {
    const n = [...names]
    n[i] = v
    setNames(n)
  }

  const handleStart = () => {
    const t = minutes * 60 + seconds
    if (t === 0) return
    onStart({ numPlayers, initialTime: t, increment, names: names.slice(0, numPlayers) })
  }

  return (
    <div className="setup">
      <h1 className="setup-title">Turn Timer</h1>

      {/* ── Player count ── */}
      <section className="setup-section">
        <div className="setup-label">プレイヤー数</div>
        <div className="btn-row">
          {[2, 3, 4, 5, 6, 7, 8].map(n => (
            <button
              key={n}
              className={`sq-btn ${numPlayers === n ? 'selected' : ''}`}
              onClick={() => setNumPlayers(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      {/* ── Initial time ── */}
      <section className="setup-section">
        <div className="setup-label">持ち時間</div>
        <div className="time-inputs">
          <input
            className="num-input"
            type="number" min="0" max="99"
            value={minutes}
            onChange={e => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
          />
          <span className="unit">分</span>
          <input
            className="num-input"
            type="number" min="0" max="59"
            value={seconds}
            onChange={e => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
          />
          <span className="unit">秒</span>
        </div>
        <div className="btn-row">
          {TIME_PRESETS.map(([m, s]) => (
            <button
              key={m}
              className={`sm-btn ${minutes === m && seconds === s ? 'selected' : ''}`}
              onClick={() => { setMinutes(m); setSeconds(s) }}
            >
              {m}分
            </button>
          ))}
        </div>
      </section>

      {/* ── Fischer increment ── */}
      <section className="setup-section">
        <div className="setup-label">フィッシャー加算（ターン終了時に加算）</div>
        <div className="btn-row">
          {INC_PRESETS.map(v => (
            <button
              key={v}
              className={`sm-btn ${increment === v ? 'selected' : ''}`}
              onClick={() => setIncrement(v)}
            >
              {v === 0 ? 'なし' : `+${v}s`}
            </button>
          ))}
        </div>
      </section>

      {/* ── Player names ── */}
      <section className="setup-section">
        <div className="setup-label">プレイヤー名</div>
        <div className="names-grid">
          {Array.from({ length: numPlayers }, (_, i) => (
            <div key={i} className="name-row">
              <span className="color-dot" style={{ background: PLAYER_COLORS[i] }} />
              <input
                className="name-input"
                type="text"
                value={names[i]}
                onChange={e => updateName(i, e.target.value)}
                placeholder={`プレイヤー ${i + 1}`}
              />
            </div>
          ))}
        </div>
      </section>

      <button className="start-btn" onClick={handleStart}>
        ゲーム開始
      </button>
    </div>
  )
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ player, onConfirm, onCancel }) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">
          <span className="dialog-dot" style={{ background: player.color }} />
          {player.name} を脱落させますか？
        </div>
        <div className="dialog-actions">
          <button className="dialog-btn dialog-btn--cancel" onClick={onCancel}>キャンセル</button>
          <button className="dialog-btn dialog-btn--confirm" onClick={onConfirm}>脱落させる</button>
        </div>
      </div>
    </div>
  )
}

// ─── GameScreen ───────────────────────────────────────────────────────────────

function GameScreen({ settings, onReset }) {
  // ── State ──
  const [game, setGame] = useState(() => ({
    players: settings.names.map((name, i) => ({
      name,
      color: PLAYER_COLORS[i],
      timeRemaining: settings.initialTime,
    })),
    currentPlayer: 0,
    isRunning: false,
    hasStarted: false,
  }))
  const [confirmTarget, setConfirmTarget] = useState(null) // index | null

  // ── Refs (always current, safe inside RAF) ──
  const gameRef    = useRef(game)
  const rafRef     = useRef(null)
  const lastTickRef = useRef(null)
  const audioCtxRef = useRef(null)
  const lowWarnedRef = useRef(false)

  // Keep ref in sync with state on every render
  gameRef.current = game

  // ── Audio ──
  const getAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioCtxRef.current
  }, [])

  // ── Tick (RAF loop) ──
  const tickFnRef = useRef(null)
  tickFnRef.current = () => {
    const { isRunning, currentPlayer } = gameRef.current
    if (!isRunning) return

    const now = performance.now()
    const elapsed = lastTickRef.current ? (now - lastTickRef.current) / 1000 : 0
    lastTickRef.current = now

    // Beep when crossing 10s threshold
    const curTime = gameRef.current.players[currentPlayer].timeRemaining
    const newTime = Math.max(0, curTime - elapsed)
    if (curTime > 10 && newTime <= 10) {
      playBeep(getAudio(), 440, 0.25, 0.35)
    }
    // Rapid beeps below 5s (every ~1s)
    if (curTime > 0 && newTime <= 5 && Math.floor(curTime) > Math.floor(newTime)) {
      playBeep(getAudio(), 440, 0.08, 0.2)
    }

    setGame(prev => ({
      ...prev,
      players: prev.players.map((p, i) =>
        i !== prev.currentPlayer
          ? p
          : { ...p, timeRemaining: Math.max(0, p.timeRemaining - elapsed) }
      ),
    }))

    rafRef.current = requestAnimationFrame(() => tickFnRef.current?.())
  }

  useEffect(() => {
    if (game.isRunning) {
      lastTickRef.current = performance.now()
      rafRef.current = requestAnimationFrame(() => tickFnRef.current?.())
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [game.isRunning])

  // ── Handle Next Turn ──
  const handleNext = useCallback(() => {
    // First tap: start game
    if (!gameRef.current.hasStarted) {
      getAudio() // unlock audio context on user gesture
      setGame(prev => ({ ...prev, hasStarted: true, isRunning: true }))
      lastTickRef.current = performance.now()
      return
    }

    if (!gameRef.current.isRunning) return

    playBeep(getAudio(), 660, 0.07, 0.4)

    setGame(prev => {
      const { players, currentPlayer } = prev
      const n = settings.numPlayers

      // 1. Apply Fischer increment to current player (if alive)
      const withIncrement = players.map((p, i) =>
        i === currentPlayer && p.timeRemaining > 0 && settings.increment > 0
          ? { ...p, timeRemaining: p.timeRemaining + settings.increment }
          : p
      )

      // 2. Find next alive player
      let next = (currentPlayer + 1) % n
      let attempts = 0
      while (withIncrement[next].timeRemaining <= 0 && attempts < n) {
        next = (next + 1) % n
        attempts++
      }

      // If no alive players remain, stop
      if (attempts >= n) {
        return { ...prev, players: withIncrement, isRunning: false }
      }

      lowWarnedRef.current = false
      lastTickRef.current = performance.now()
      return { ...prev, players: withIncrement, currentPlayer: next }
    })
  }, [settings, getAudio])

  // ── Handle Eliminate ──
  const handleEliminate = useCallback((targetIdx) => {
    setGame(prev => {
      if (!prev.hasStarted) return prev
      const { players, currentPlayer } = prev
      const n = settings.numPlayers

      const newPlayers = players.map((p, i) =>
        i === targetIdx ? { ...p, timeRemaining: 0 } : p
      )

      // If eliminated player was current, advance to next alive
      if (targetIdx !== currentPlayer) {
        return { ...prev, players: newPlayers }
      }

      let next = (currentPlayer + 1) % n
      let attempts = 0
      while (newPlayers[next].timeRemaining <= 0 && attempts < n) {
        next = (next + 1) % n
        attempts++
      }

      if (attempts >= n) {
        return { ...prev, players: newPlayers, isRunning: false }
      }

      lowWarnedRef.current = false
      lastTickRef.current = performance.now()
      return { ...prev, players: newPlayers, currentPlayer: next }
    })
  }, [settings.numPlayers])

  // ── Pause / Resume ──
  const togglePause = useCallback(() => {
    if (!game.hasStarted || isGameOver) return
    setGame(prev => {
      if (!prev.isRunning) lastTickRef.current = performance.now()
      return { ...prev, isRunning: !prev.isRunning }
    })
  }, [game.hasStarted])

  // ── Derived ──
  const { players, currentPlayer, isRunning, hasStarted } = game
  const alivePlayers = players.filter(p => p.timeRemaining > 0)
  const isGameOver   = hasStarted && alivePlayers.length <= 1

  // Stop timer when game ends
  useEffect(() => {
    if (isGameOver && isRunning) {
      setGame(prev => ({ ...prev, isRunning: false }))
      setTimeout(() => playBeep(getAudio(), 220, 0.8, 0.5), 50)
    }
  }, [isGameOver, isRunning, getAudio])

  // ── Grid columns by player count ──
  const cols = settings.numPlayers <= 2 ? 2
             : settings.numPlayers <= 4 ? 2
             : settings.numPlayers <= 6 ? 3
             : 4

  // ── Status label ──
  const statusLabel = !hasStarted
    ? 'タップしてスタート'
    : isGameOver
    ? 'ゲーム終了'
    : `${players[currentPlayer].name} のターン`

  return (
    <div className="game">
      {/* Header */}
      <div className="game-header">
        <button className="hdr-btn" onClick={onReset}>↩ リセット</button>
        <div className="status-label">{statusLabel}</div>
        <button
          className="hdr-btn"
          onClick={togglePause}
          disabled={!hasStarted || isGameOver}
        >
          {isRunning ? '⏸ 一時停止' : '▶ 再開'}
        </button>
      </div>

      {/* Player grid */}
      <div className="grid" style={{ '--cols': cols }}>
        {players.map((p, i) => {
          const isActive = i === currentPlayer && !isGameOver
          const isDead   = p.timeRemaining <= 0
          const isLow    = isActive && p.timeRemaining > 0 && p.timeRemaining <= 10
          return (
            <div
              key={i}
              className={[
                'card',
                isActive ? 'card--active' : '',
                isDead   ? 'card--dead'   : '',
                isLow    ? 'card--low'    : '',
              ].join(' ')}
              style={{ '--c': p.color }}
              onClick={() => isActive && !isDead && handleNext()}
            >
              {hasStarted && !isDead && !isGameOver && (
                <button
                  className="elim-btn"
                  title={`${p.name} を脱落させる`}
                  onClick={e => { e.stopPropagation(); setConfirmTarget(i) }}
                >
                  ✕
                </button>
              )}
              <div className="card-name">{p.name}</div>
              <div className="card-time">{isDead ? 'OUT' : formatTime(p.timeRemaining)}</div>
              {isActive && !isDead && (
                <div className="card-hint">
                  {!hasStarted ? 'タップしてスタート' : 'タップして次へ'}
                </div>
              )}
              {isDead && <div className="card-hint card-hint--dead">脱落</div>}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {!isGameOver && (
        <div className="game-footer">
          <button className="next-btn" onClick={handleNext}>
            {!hasStarted ? 'スタート' : '次のプレイヤー →'}
          </button>
          {settings.increment > 0 && hasStarted && (
            <div className="inc-label">フィッシャー +{settings.increment}秒 / ターン</div>
          )}
        </div>
      )}

      {/* Game over */}
      {isGameOver && (
        <div className="gameover">
          <div className="gameover-text">
            {alivePlayers.length === 1
              ? `🏆 ${alivePlayers[0].name} の勝ち！`
              : 'ゲーム終了'}
          </div>
          <button className="start-btn" onClick={onReset}>
            もう一度
          </button>
        </div>
      )}

      {/* Confirm eliminate dialog */}
      {confirmTarget !== null && (
        <ConfirmDialog
          player={players[confirmTarget]}
          onConfirm={() => { handleEliminate(confirmTarget); setConfirmTarget(null) }}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [settings, setSettings] = useState(null)
  const [lastSettings, setLastSettings] = useState(null)

  const handleStart = (s) => {
    setLastSettings(s)
    setSettings(s)
  }

  return settings
    ? <GameScreen settings={settings} onReset={() => setSettings(null)} />
    : <SetupScreen onStart={handleStart} initialSettings={lastSettings} />
}
