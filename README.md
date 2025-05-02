# Prosthetic Design Preferences App

A React application that allows users to select their preferences for prosthetic leg designs and generate a description using Gemini AI.

## Features

- Interactive dropdown menus for all preference categories:
  - Color Preferences (Primary and Accent)
  - Design Style
  - Texture/Finish
  - Personalization Elements
  - Material Look
- Integration with Google's Gemini AI to generate prosthetic design descriptions
- Real-time summary of selected preferences

## Getting Started

### Prerequisites

- Node.js and npm installed on your machine
- Gemini API key from Google AI Studio

### Getting a Gemini API Key

1. Visit the Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key or use an existing one
4. Copy the API key for use in the application

### Installation

1. Navigate to the project directory:
   ```
   cd preferences-app
   ```

2. Install the dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Using the Application

1. **Enter your Gemini API Key:**
   - Paste your Gemini API key in the "Gemini API Configuration" section
   - Alternatively, you can edit the `src/config.js` file to include your API key permanently:
     ```javascript
     export const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
     ```

2. **Select your preferences:**
   - Choose options from each dropdown menu
   - You can select as many or as few preferences as you like

3. **Generate the description:**
   - Click the "Generate Prosthetic Description" button
   - The AI-generated description will appear below

## Security Note

- The API key is stored in memory only and not sent to any server besides Google's API services
- For security, avoid committing your API key to version control
- Consider using environment variables for production deployments

## Technologies Used

- React
- Material UI
- Google Generative AI (Gemini)
- JavaScript
- CSS 