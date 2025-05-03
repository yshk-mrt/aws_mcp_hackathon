/**
 * Service to interact with the Apify API for generating 3D prosthetic models
 */

// The Apify API token
const API_TOKEN = "APIFY_TOKEK";

/**
 * Generates a 3D model using the Apify API based on a text prompt
 * @param {string} prompt - The text prompt to generate the 3D model
 * @returns {Promise<Object>} - The response from the Apify API containing model information
 */
export const generateProstheticModel = async (prompt) => {
  try {
    console.log("==========================================");
    console.log("Generating 3D model with raw prompt:");
    console.log(prompt);
    console.log("Prompt length:", prompt.length, "characters");
    console.log("==========================================");
    
    // Prepare the request payload
    const payload = {
      prompt: prompt,
      headed: false
    };
    
    // Log the payload as a formatted JSON string for better inspection
    console.log("Request payload as JSON:");
    console.log(JSON.stringify(payload, null, 2));
    
    // Log the payload stringified as it will be sent
    const payloadString = JSON.stringify(payload);
    console.log("Request payload string length:", payloadString.length, "characters");
    console.log("==========================================");
    
    // Prepare the request
    const response = await fetch(
      "https://api.apify.com/v2/acts/yasuhiko.morita1~my-actor/run-sync?token=" + API_TOKEN,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: payloadString,
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
 * Formats a Gemini description into a prompt suitable for the Apify 3D model generation
 * @param {string} description - The detailed description from Gemini
 * @returns {string} - A properly formatted prompt for the 3D model generation
 */
export const formatPromptForApify = (description) => {
  if (!description) {
    return "Generate a modern and sleek prosthetic leg";
  }
  
  // Clean up the description
  let cleanDescription = description
    .replace(/\n+/g, ' ') // Replace multiple newlines with spaces
    .replace(/\s+/g, ' ') // Normalize all whitespace
    .trim();
  
  // Get the full description (don't truncate)
  let prompt = cleanDescription;
  
  // Ensure the prompt specifies it's for a prosthetic leg
  if (!prompt.toLowerCase().includes('prosthetic leg')) {
    prompt += ", prosthetic leg";
  }
  
  // Add emphasis on 3D model
  prompt += ". Create a realistic 3D model.";
  
  // Log the full prompt for debugging
  console.log("Full formatted prompt for Apify:", prompt);
  
  return prompt;
}; 