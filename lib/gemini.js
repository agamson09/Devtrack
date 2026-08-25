const { GoogleGenerativeAI } = require('@google/generative-ai')

const apiKey = process.env.GEMINI_API_KEY
let genAI = null
let model = null

if (apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey.length > 20) {
  genAI = new GoogleGenerativeAI(apiKey)
  model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
}

const productSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nama Produk' },
      brand: { type: 'string', description: 'Merek' },
      category: { type: 'string', description: 'Kategori (laptop/monitor/peripheral/network/server/etc)' },
      estimated_price: { type: 'string', description: 'Estimasi harga dalam Rupiah' },
      specs: { type: 'string', description: 'Spesifikasi singkat' },
      reason: { type: 'string', description: 'Alasan rekomendasi' },
      store: { type: 'string', description: 'Tempat beli rekomendasi' },
    },
    required: ['name', 'brand', 'category', 'estimated_price', 'specs', 'reason', 'store'],
  },
}

async function searchProducts(query) {
  if (!model) {
    return {
      error: 'Gemini API belum dikonfigurasi. Pastikan GEMINI_API_KEY sudah benar di .env.local',
      recommendations: []
    }
  }

  const prompt = `Kamu adalah IT procurement assistant untuk perusahaan IT. Berdasarkan deskripsi kebutuhan pengguna, rekomendasikan produk IT yang sesuai.

Pengguna mencari: "${query}"

Berikan 3-5 rekomendasi produk. Harga dalam Rupiah Indonesia. Berikan estimasi harga yang realistis berdasarkan harga pasar Indonesia saat ini.`

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: productSchema,
      },
    })
    const response = await result.response
    let text = response.text().trim()

    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const recommendations = JSON.parse(text)
    return { recommendations }
  } catch (err) {
    console.error('Gemini search error:', err.message)

    if (err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
      return {
        error: 'Quota Gemini API habis. Silakan buat API key baru di https://aistudio.google.com',
        recommendations: []
      }
    }

    return {
      error: 'Gagal memproses pencarian: ' + err.message,
      recommendations: []
    }
  }
}

module.exports = { searchProducts }
