/**
 * Service to interact with the Apify API for generating 3D prosthetic models
 */

// The Apify API token
const API_TOKEN = "apify_api_lKorE3ryDFn1jJsYjAgMvy6jkEWhNE4p8xEq";

/**
 * Generates a 3D model using the Apify API based on a text prompt
 * @param {string} prompt - The text prompt to generate the 3D model
 * @returns {Promise<Object>} - The response from the Apify API containing model information
 */
export const generateProstheticModel = async (prompt) => {
  try {
    console.log("Generating 3D model with prompt:", prompt);
    
    // Prepare the request payload
    const payload = {
      prompt: prompt,
      headed: false
    };
    
    console.log("Request payload:", JSON.stringify(payload));
    
    // Prepare the request
    const response = await fetch(
      "https://api.apify.com/v2/acts/yasuhiko.morita1~my-actor/run-sync?token=" + API_TOKEN,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    // For 400 errors, try to get more detailed error information
    if (response.status === 400) {
      let errorDetails = "Bad Request";
      try {
        // Try to parse the error response body
        const errorBody = await response.text();
        console.error("Error response body:", errorBody);
        
        try {
          // If it's JSON, extract structured error message
          const errorJson = JSON.parse(errorBody);
          errorDetails = errorJson.error || errorJson.message || errorBody;
        } catch (jsonError) {
          // If not JSON, use the raw error text
          errorDetails = errorBody;
        }
      } catch (e) {
        // If can't read response body, use generic message
        console.error("Could not read error response:", e);
      }
      
      throw new Error(`Bad Request (400) from Apify API: ${errorDetails}`);
    }
    
    if (!response.ok) {
      throw new Error(`Apify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Apify API response:", data);

    if (data.status !== "success") {
      throw new Error(`Model generation failed: ${data.error || "Unknown error"}`);
    }

    // Extract the resultUrl from the response
    const modelUrl = data.resultUrl;
    
    if (!modelUrl) {
      throw new Error("No model URL returned from the API");
    }

    return {
      success: true,
      modelUrl: modelUrl,
      message: "3D model generated successfully"
    };
  } catch (error) {
    console.error("Error generating 3D model:", error);
    return {
      success: false,
      modelUrl: "",
      message: error.message || "Failed to generate 3D model"
    };
  }
};

/**
 * Formats a Gemini description into a shorter prompt suitable for the Apify 3D model generation
 * @param {string} description - The detailed description from Gemini
 * @returns {string} - A shorter, more focused prompt for the 3D model generation
 */
export const formatPromptForApify = (description) => {
  // Extract the most important parts from the description
  // Focus on colors, style, and material features
  
  // If description is too long, create a shorter version
  if (description.length > 100) {
    // Extract first sentence or paragraph
    const firstSentence = description.split(/\.|\n/)[0];
    
    // Clean up any markdown or extra formatting
    const cleanPrompt = firstSentence
      .replace(/[*_#]/g, '')  // Remove markdown formatting
      .replace(/\s+/g, ' ')   // Normalize whitespace
      .trim();
    
    return cleanPrompt + ", prosthetic leg";
  }
  
  return description + ", prosthetic leg";
}; 