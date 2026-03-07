export default async function handler(req, res) {
  // Allow CORS from our frontend
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // Forward the raw audio body to Hugging Face
    const hfResponse = await fetch(
      "https://api-inference.huggingface.co/models/openai/whisper-large-v3",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + process.env.HF_API_KEY,
          "Content-Type": "audio/webm"
        },
        body: req.body
      }
    )

    if (hfResponse.status === 503) {
      const data = await hfResponse.json()
      return res.status(503).json(data)
    }

    if (!hfResponse.ok) {
      const text = await hfResponse.text()
      return res.status(hfResponse.status).json({ error: text })
    }

    const result = await hfResponse.json()
    return res.status(200).json(result)

  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

export const config = {
  api: {
    bodyParser: false
  }
}
