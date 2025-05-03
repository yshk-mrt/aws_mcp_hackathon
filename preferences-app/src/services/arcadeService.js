/**
 * Service to interact with the Arcade.dev API for sending emails
 */

// The Arcade API key
const ARCADE_API_KEY = "ARCADE_API_KEY";
const SENDER_EMAIL = "sarvidebate@gmail.com";
const RECIPIENT_EMAIL = "goyalsarvagya@gmail.com";

/**
 * Sends an email with the generated model URL using arcade.dev
 * @param {string} modelUrl - The URL of the generated 3D model
 * @param {string} modelDescription - Optional description of the model
 * @param {boolean} isTest - Whether this is a test email
 * @returns {Promise<Object>} - The response from the arcade.dev API
 */
export const sendModelUrlEmail = async (modelUrl, modelDescription = "", isTest = false) => {
  try {
    console.log(`${isTest ? "TEST MODE: " : ""}Sending email with model URL:`, modelUrl);
    
    // Create the email content
    const subject = isTest 
      ? "TEST - Please create this custom prosthetic leg for me" 
      : "Please create this custom prosthetic leg for me";
      
    const body = isTest
      ? `This is a TEST email to verify the email sending functionality works correctly.

Test model URL:
${modelUrl}

${modelDescription}

Please ignore this test email.`
      : `
I've designed a custom prosthetic leg using the Prosthetic Design preferences app.

Please use the following 3D model URL:
${modelUrl}

${modelDescription ? `\nDescription of the design:\n${modelDescription}` : ''}

Thank you!
`;

    // Create the prompt for arcade.dev
    const prompt = `Send an email to ${RECIPIENT_EMAIL} with the subject '${subject}' and the body '${body}'`;
    
    // Log request in more detail for tests
    if (isTest) {
      console.log("=== TEST EMAIL DEBUGGING ===");
      console.log("Recipient:", RECIPIENT_EMAIL);
      console.log("Subject:", subject);
      console.log("Body:", body);
      console.log("==========================");
    }
    
    // Log the request details for debugging
    console.log("Arcade request details:", {
      prompt,
      tools: ["Google.SendEmail"],
      user: SENDER_EMAIL
    });
    
    // Prepare the request to arcade.dev
    const response = await fetch("https://api.arcade.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ARCADE_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        tools: ["Google.SendEmail"],
        tool_choice: "generate",
        user: SENDER_EMAIL
      })
    });

    // Log the raw response for debugging
    const responseText = await response.text();
    console.log(`${isTest ? "TEST MODE - " : ""}Raw Arcade API response:`, responseText);
    
    let data;
    try {
      // Try to parse the response as JSON
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`${isTest ? "TEST MODE - " : ""}Failed to parse response as JSON:`, e);
      // If it's not valid JSON, check if it contains an auth URL
      if (responseText.includes("authorize") || responseText.includes("http")) {
        const authUrl = extractAuthUrl(responseText);
        if (authUrl) {
          console.log(`${isTest ? "TEST MODE - " : ""}Found authorization URL:`, authUrl);
          return {
            success: false,
            requiresAuth: true,
            authUrl,
            message: "Authorization required. Please check the authorization URL."
          };
        }
      }
      
      throw new Error(`Invalid response from Arcade API: ${responseText}`);
    }
    
    if (!response.ok) {
      throw new Error(`Arcade API error: ${response.status} - ${responseText}`);
    }

    console.log(`${isTest ? "TEST MODE - " : ""}Parsed Arcade API response:`, data);

    // Check if the email was sent successfully
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const message = data.choices[0].message.content;
      console.log(`${isTest ? "TEST MODE - " : ""}Message content:`, message);
      
      if (message.toLowerCase().includes("sent") || message.toLowerCase().includes("email")) {
        return {
          success: true,
          message: isTest ? "Test email sent successfully!" : "Email sent successfully!"
        };
      }
      
      // If it's asking for authorization
      if (message.toLowerCase().includes("authorize") || message.toLowerCase().includes("url")) {
        const authUrl = extractAuthUrl(message);
        if (authUrl) {
          console.log(`${isTest ? "TEST MODE - " : ""}Found authorization URL in message:`, authUrl);
          return {
            success: false,
            requiresAuth: true,
            authUrl,
            message: "Authorization required. Please check the authorization URL."
          };
        }
      }
    }
    
    // Check for tool calls in the response that might contain auth URLs
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.tool_calls) {
      const toolCalls = data.choices[0].message.tool_calls;
      console.log(`${isTest ? "TEST MODE - " : ""}Tool calls found:`, toolCalls);
      
      for (const toolCall of toolCalls) {
        if (toolCall.function && toolCall.function.arguments) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(`${isTest ? "TEST MODE - " : ""}Tool call arguments:`, args);
            
            if (args.auth_url) {
              console.log(`${isTest ? "TEST MODE - " : ""}Found auth_url in tool call:`, args.auth_url);
              return {
                success: false,
                requiresAuth: true,
                authUrl: args.auth_url,
                message: "Authorization required. Please check the authorization URL."
              };
            }
          } catch (e) {
            console.error(`${isTest ? "TEST MODE - " : ""}Failed to parse tool call arguments:`, e);
          }
        }
      }
    }

    return {
      success: false,
      message: `${isTest ? "Test email" : "Email"} failed to send. Check console for details.`
    };
  } catch (error) {
    console.error(`${isTest ? "TEST MODE - " : ""}Error sending email:`, error);
    return {
      success: false,
      message: error.message || `Failed to send ${isTest ? "test " : ""}email`
    };
  }
};

/**
 * Extract the authorization URL from the response message
 * @param {string} message - The response message from arcade.dev
 * @returns {string|null} - The extracted URL or null if not found
 */
const extractAuthUrl = (message) => {
  // Try to match a URL in the message
  const urlMatch = message.match(/(https?:\/\/[^\s"]+)/);
  if (urlMatch && urlMatch[0]) {
    // Clean up the URL - remove any trailing characters that aren't part of the URL
    let url = urlMatch[0];
    
    // Remove trailing punctuation or quotes
    url = url.replace(/[.,;:'"]+$/, '');
    
    // Make sure it's a Google auth URL
    if (url.includes("accounts.google.com") || url.includes("oauth")) {
      return url;
    }
  }
  
  // Find full URL if it contains "authenticate", "authorize", or "auth"
  const authMatch = message.match(/(https?:\/\/[^\s"]+(?:authenticate|authorize|auth)[^\s"]*)/i);
  if (authMatch && authMatch[0]) {
    return authMatch[0].replace(/[.,;:'"]+$/, '');
  }
  
  return null;
}; 