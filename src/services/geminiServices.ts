import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GridState {
  grid: boolean[][]; // 4 rows x 8 columns
}

export async function detectGrid(base64Image: string): Promise<boolean[][]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `Analyze this image of a 4x8 grid. 
            The grid has 4 rows and 8 columns.
            Rows from top to bottom represent: Open Hi-Hat, Closed Hi-Hat, Snare, Kick.
            Columns from left to right represent 8 steps of a beat.
            Identify which cells in the grid have an object placed in them (like a coin, a marker, or a drawing).
            Return a 4x8 matrix of booleans where true means an object is present and false means it is empty.
            The output should be a JSON array of 4 arrays, each containing 8 booleans.`,
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          grid: {
            type: Type.ARRAY,
            items: {
              type: Type.ARRAY,
              items: { type: Type.BOOLEAN },
              description: "A row of 8 steps",
            },
            description: "4 rows of drum steps",
          },
        },
        required: ["grid"],
      },
    },
  });

  try {
    const result = JSON.parse(response.text || "{}");
    return result.grid || Array(4).fill(null).map(() => Array(8).fill(false));
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return Array(4).fill(null).map(() => Array(8).fill(false));
  }
}
