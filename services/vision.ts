import { GoogleGenAI } from "@google/genai";

export const recognizeKoreanHandwriting = async (base64Image: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imageData = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: imageData,
            },
          },
          {
            text: "Identify the Korean character(s) or word written in this image. Return ONLY the plain text characters. If nothing is identifiable, return an empty string.",
          },
        ],
      },
      config: {
        temperature: 0,
        topP: 1,
      }
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Vision Recognition Failed:", error);
    return "";
  }
};