let audioContext = null

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  if (!audioContext) {
    audioContext = new AudioContextClass()
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {})
  }
  return audioContext
}

function beep(frequency, durationMs, delayMs = 0) {
  const ctx = getAudioContext()
  if (!ctx) return
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  // クリック音防止のため、開始・終了で音量を滑らかにフェードする
  const startTime = ctx.currentTime + delayMs / 1000
  const endTime = startTime + durationMs / 1000
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(0.18, startTime + 0.01)
  gain.gain.linearRampToValueAtTime(0, endTime)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startTime)
  oscillator.stop(endTime)
}

/** 「ピンポン！」のような2音の上昇チャイム */
function playPinPon() {
  beep(880, 140)
  beep(1318, 220, 150)
}

/** 音程が揺れる（ビブラート）ブザー音 */
function playWobbleBuzz(durationMs = 450) {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sawtooth'
  oscillator.frequency.value = 200

  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.type = 'sine'
  lfo.frequency.value = 14 // 揺れの速さ
  lfoGain.gain.value = 45 // 揺れ幅（Hz）
  lfo.connect(lfoGain)
  lfoGain.connect(oscillator.frequency)

  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.14, now + 0.02)
  gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000)

  oscillator.connect(gain)
  gain.connect(ctx.destination)

  oscillator.start(now)
  lfo.start(now)
  oscillator.stop(now + durationMs / 1000)
  lfo.stop(now + durationMs / 1000)
}

/** 打刻結果（成功/失敗）に応じて音でフィードバックする */
export function notifyScanResult(success) {
  if (success) {
    playPinPon()
  } else {
    playWobbleBuzz()
  }
}
