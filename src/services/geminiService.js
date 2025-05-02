import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../config";

/**
 * Generates a description for a prosthetic leg design based on user preferences
 * @param {Object} preferences - User selected preferences
 * @returns {Promise<Object>} Object containing the prompt and generated description
 */
export const generateProstheticDescription = async (preferences) => {
  try {
    // Use the API key from window object if available, otherwise fall back to config
    const apiKey = window.tempApiKey || GEMINI_API_KEY;
    
    // Initialize the Gemini API with the current API key
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // For Gemini Pro model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Format preferences into a readable string
    const preferencesText = formatPreferences(preferences);

    // Create the prompt
    const prompt = `Based on these preferences, create a description for how Vizcom should edit a preexisting prosthetic leg to look like with these style changes:\n${preferencesText}`;

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // Return both the prompt and the response
    return {
      prompt,
      description: response.text()
    };
  } catch (error) {
    console.error("Error generating prosthetic description:", error);
    return {
      prompt: "Error generating prompt",
      description: "Error generating description. Please check your API key and try again."
    };
  }
};

/**
 * Formats the user preferences into a readable string
 * @param {Object} preferences - The user preferences object
 * @returns {string} Formatted preferences
 */
const formatPreferences = (preferences) => {
  const { colorPrefs, designStyle, textureFinish, personalization, materialLook } = preferences;
  
  let formattedPrefs = "";
  
  if (colorPrefs.primaryColor) {
    formattedPrefs += `Primary Color: ${colorPrefs.primaryColor}\n`;
  }
  
  if (colorPrefs.accentColor) {
    formattedPrefs += `Accent Color: ${colorPrefs.accentColor}\n`;
  }
  
  if (designStyle) {
    formattedPrefs += `Design Style: ${designStyle}\n`;
  }
  
  if (textureFinish) {
    formattedPrefs += `Texture/Finish: ${textureFinish}\n`;
  }
  
  if (personalization) {
    formattedPrefs += `Personalization: ${personalization}\n`;
  }
  
  if (materialLook) {
    formattedPrefs += `Material Look: ${materialLook}\n`;
  }
  
  return formattedPrefs;
}; 