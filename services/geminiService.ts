import { GoogleGenAI } from "@google/genai";
import { DashboardStats } from "../types";

export const generateDailyInsight = async (stats: DashboardStats): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return "API Key not configured. Please set your Gemini API Key to receive insights.";
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      You are an operational analyst for a warehouse distribution center.
      Analyze the following daily stats:
      - Total Items Processed Today: ${stats.totalToday}
      - Successful Transactions: ${stats.totalSuccess}
      - Failed Transactions: ${stats.totalFailed}
      - Pending/Ready: ${stats.totalReady}

      Provide a concise, 2-sentence executive summary of the performance. 
      If failure rate is high (>10%), suggest a check on the validation process.
      Be professional and motivating.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No insights available at the moment.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate insights due to network or configuration error.";
  }
};