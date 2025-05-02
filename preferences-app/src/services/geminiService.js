import { GoogleGenerativeAI } from "@google/generative-ai";

// Directly define the API key here
const API_KEY = "AIzaSyAHDO4oG-KLMB_iw6wftNslEr6kARJ51T8";

/**
 * Validates the Gemini API key by making a simple request
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<{isValid: boolean, error: string|null}>} Validation result with error info
 */
export const validateApiKey = async (apiKey) => {
  // Use the provided API key or fall back to the hardcoded one
  const keyToUse = apiKey || API_KEY;
  
  if (!keyToUse) {
    return { isValid: false, error: "No API key provided" };
  }

  try {
    console.log("Starting API key validation...");
    const genAI = new GoogleGenerativeAI(keyToUse);
    
    // Use Gemini 2.0 Flash model for validation
    console.log("Initializing Gemini 2.0 Flash model for validation...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Make a simple request to check if the API key works
    console.log("Making test API request...");
    const result = await model.generateContent("Test message, please respond with 'OK' if you receive this.");
    
    if (!result || !result.response) {
      return { isValid: false, error: "Received empty response from API" };
    }
    
    const responseText = result.response.text();
    console.log("Received validation response:", responseText);
    
    return { isValid: true, error: null };
  } catch (error) {
    // Extract detailed error information
    console.error("API key validation error:", error);
    let errorMessage = "Unknown error";
    
    if (error.message) {
      errorMessage = error.message;
      console.log("Error message:", error.message);
    }
    
    if (error.status) {
      console.log("Error status:", error.status);
    }
    
    // Check for specific error types
    if (errorMessage.includes("API key")) {
      return { isValid: false, error: "Invalid API key format or unauthorized" };
    } else if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
      return { isValid: false, error: "API quota exceeded" };
    } else if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
      return { isValid: false, error: "Network error, check your connection" };
    } else if (errorMessage.includes("cors") || errorMessage.includes("origin")) {
      return { isValid: false, error: "CORS error, API may not allow requests from this domain" };
    }
    
    return { isValid: false, error: errorMessage };
  }
};

/**
 * Generates a description for a prosthetic leg design based on user preferences
 * @param {Object} preferences - User selected preferences
 * @returns {Promise<Object>} Object containing the prompt and generated description
 */
export const generateProstheticDescription = async (preferences) => {
  try {
    // Use the API key from window object if available, otherwise fall back to hardcoded key
    const apiKey = window.tempApiKey || API_KEY;
    
    if (!apiKey) {
      throw new Error("No API key available. Please provide a valid Gemini API key.");
    }
    
    console.log("Initializing Gemini with API key");
    
    // Initialize the Gemini API with the API key
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Format preferences into a readable string
    const preferencesText = formatPreferences(preferences);
    
    if (!preferencesText.trim()) {
      throw new Error("No preferences selected. Please select at least one preference.");
    }

    // Create the prompt
    const prompt = `Based on these preferences, create a description for how Vizcom should edit a preexisting prosthetic leg to look like with these style changes:\n${preferencesText}`;
    
    console.log("Sending prompt to Gemini 2.0 Flash:", prompt);

    // Use Gemini 2.0 Flash model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash"
    });

    // Generate content
    const result = await model.generateContent(prompt);
    
    if (!result || !result.response) {
      throw new Error("Received empty response from Gemini API");
    }
    
    const response = await result.response;
    const responseText = response.text();
    
    console.log("Received response from Gemini:", responseText.substring(0, 50) + "...");
    
    // Return both the prompt and the response
    return {
      prompt,
      description: responseText
    };
  } catch (error) {
    console.error("Error generating prosthetic description:", error);
    
    // Provide more specific error messages based on the error
    let errorMessage = "Error generating description. Please check your API key and try again.";
    
    if (error.message.includes("API key")) {
      errorMessage = "Invalid API key. Please provide a valid Gemini API key.";
    } else if (error.message.includes("quota")) {
      errorMessage = "API quota exceeded. Please try again later or use a different API key.";
    } else if (error.message.includes("network")) {
      errorMessage = "Network error. Please check your internet connection and try again.";
    }
    
    return {
      prompt: error.message || "Error generating prompt",
      description: errorMessage
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