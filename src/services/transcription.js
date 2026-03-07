export async function transcribeAudio(audioBlob, onProgress) {
  try {
    onProgress && onProgress("transcribing")
    console.log("[Whisper] Sending audio via proxy...")

    const arrayBuffer = await audioBlob.arrayBuffer()

    let response = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: arrayBuffer,
      signal: AbortSignal.timeout(90000)
    })

    // Handle model cold start
    if (response.status === 503) {
      const data = await response.json()
      const waitTime = data.estimated_time
        ? Math.ceil(data.estimated_time) + 2
        : 20

      console.log("[Whisper] Model warming up, waiting " + waitTime + "s...")
      onProgress && onProgress("warming")

      await new Promise(resolve => setTimeout(resolve, waitTime * 1000))

      // Retry once
      response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "audio/webm" },
        body: arrayBuffer,
        signal: AbortSignal.timeout(90000)
      })
    }

    if (!response.ok) {
      throw new Error("Proxy error: " + response.status)
    }

    const result = await response.json()
    console.log("[Whisper] Result:", result)

    onProgress && onProgress("done")

    return {
      text: result.text || null,
      detected_language: null,
      confidence: null,
      duration: null
    }

  } catch (error) {
    console.error("[Whisper] Error:", error)
    onProgress && onProgress("done")
    return { text: null, detected_language: null, confidence: null, duration: null }
  }
}
