const Groq = require('groq-sdk')

let groq = null

const apiKey = process.env.GROQ_API_KEY
if (apiKey && apiKey !== 'your_groq_api_key_here' && apiKey.length > 10) {
  groq = new Groq({ apiKey })
}

const productSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nama Produk' },
      brand: { type: 'string', description: 'Merek' },
      category: { type: 'string', description: 'Kategori (laptop/monitor/peripheral/network/server/etc)' },
      estimated_price: { type: 'string', description: 'Estimasi harga dalam Rupiah Indonesia' },
      specs: { type: 'string', description: 'Spesifikasi singkat' },
      reason: { type: 'string', description: 'Alasan rekomendasi ini cocok' },
      store: { type: 'string', description: 'Tempat beli rekomendasi (Tokopedia/Shopee/etc)' },
    },
    required: ['name', 'brand', 'category', 'estimated_price', 'specs', 'reason', 'store'],
  },
}

async function searchProducts(query) {
  if (!groq) {
    return {
      error: 'Groq API belum dikonfigurasi. Tambahkan GROQ_API_KEY ke .env.local. Daftar gratis di https://console.groq.com',
      recommendations: []
    }
  }

  const prompt = `Kamu adalah IT procurement assistant untuk perusahaan IT di Indonesia. Berdasarkan deskripsi kebutuhan pengguna, rekomendasikan produk IT yang sesuai.

Pengguna mencari: "${query}"

Berikan 3-5 rekomendasi produk IT yang relevan. Harga dalam Rupiah Indonesia (estimasi realistis pasar Indonesia 2026). Berikan spesifikasi yang akurat.`

  try {
    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'it_product_recommendations',
          description: 'List of IT product recommendations',
          schema: {
            type: 'array',
            items: productSchema.items,
          },
        },
      },
    })

    let text = result.choices[0]?.message?.content || '[]'

    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const recommendations = JSON.parse(text)
    return { recommendations }
  } catch (err) {
    console.error('Groq search error:', err.message)

    if (err.status === 429) {
      return {
        error: 'Rate limit terlalu banyak request. Coba lagi dalam beberapa detik.',
        recommendations: []
      }
    }

    if (err.status === 401) {
      return {
        error: 'API key tidak valid. Periksa GROQ_API_KEY di .env.local',
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
