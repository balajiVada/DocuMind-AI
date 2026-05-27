const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: 'Hello world',
    config: {
      outputDimensionality: 768,
    }
  });
  console.log(response.embeddings[0].values.length);
}

run().catch(console.error);
