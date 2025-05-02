import React, { useState } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Paper,
  Grid,
  ThemeProvider,
  createTheme,
  Button,
  CircularProgress,
  TextField,
  Alert,
  Snackbar,
  Divider
} from '@mui/material';
import { generateProstheticDescription } from './services/geminiService';
import { GEMINI_API_KEY } from './config';

const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
      marginBottom: '1rem',
    },
    h6: {
      fontWeight: 500,
      marginBottom: '0.5rem',
    },
  },
});

function App() {
  // State for each preference category
  const [colorPrefs, setColorPrefs] = useState({
    primaryColor: '',
    accentColor: ''
  });
  
  const [designStyle, setDesignStyle] = useState('');
  const [textureFinish, setTextureFinish] = useState('');
  const [personalization, setPersonalization] = useState('');
  const [materialLook, setMaterialLook] = useState('');
  
  // State for Gemini API
  const [apiKey, setApiKey] = useState(GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY_HERE" ? GEMINI_API_KEY : '');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [promptText, setPromptText] = useState('');
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Handle change functions for each category
  const handleColorChange = (event) => {
    const { name, value } = event.target;
    setColorPrefs({ ...colorPrefs, [name]: value });
  };

  const handleDesignChange = (event) => {
    setDesignStyle(event.target.value);
  };

  const handleTextureChange = (event) => {
    setTextureFinish(event.target.value);
  };

  const handlePersonalizationChange = (event) => {
    setPersonalization(event.target.value);
  };

  const handleMaterialChange = (event) => {
    setMaterialLook(event.target.value);
  };

  const handleApiKeyChange = (event) => {
    setApiKey(event.target.value);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Handle generating the description
  const handleGenerateDescription = async () => {
    // Validate if API key is provided
    if (!apiKey) {
      setError('Please enter your Gemini API key');
      setSnackbarOpen(true);
      return;
    }

    // Check if at least one preference is selected
    if (!colorPrefs.primaryColor && !colorPrefs.accentColor && !designStyle && 
        !textureFinish && !personalization && !materialLook) {
      setError('Please select at least one preference');
      setSnackbarOpen(true);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setGeneratedDescription('');
      setPromptText('');

      // Update the API key in window for the service to use
      window.tempApiKey = apiKey;

      // Collect all preferences
      const preferences = {
        colorPrefs,
        designStyle,
        textureFinish,
        personalization,
        materialLook
      };

      // Call the Gemini API service
      const result = await generateProstheticDescription(preferences);
      setPromptText(result.prompt);
      setGeneratedDescription(result.description);
      
      // Scroll to the result
      setTimeout(() => {
        document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setError('Error generating description. Please check your API key and try again.');
      setSnackbarOpen(true);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            Prosthetic Design Preferences
          </Typography>
          
          {/* API Key Input */}
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Gemini API Configuration
            </Typography>
            <TextField
              fullWidth
              label="Gemini API Key"
              variant="outlined"
              value={apiKey}
              onChange={handleApiKeyChange}
              type="password"
              helperText="Get your API key from https://aistudio.google.com/app/apikey"
              margin="normal"
            />
          </Paper>
          
          <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
            <Grid container spacing={3}>
              {/* Color Preferences */}
              <Grid item xs={12}>
                <Typography variant="h6" component="h2">
                  Color Preferences
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth margin="normal">
                      <InputLabel id="primary-color-label">Primary Color</InputLabel>
                      <Select
                        labelId="primary-color-label"
                        id="primary-color"
                        name="primaryColor"
                        value={colorPrefs.primaryColor}
                        label="Primary Color"
                        onChange={handleColorChange}
                      >
                        <MenuItem value="red">Red</MenuItem>
                        <MenuItem value="blue">Blue</MenuItem>
                        <MenuItem value="black">Black</MenuItem>
                        <MenuItem value="green">Green</MenuItem>
                        <MenuItem value="purple">Purple</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth margin="normal">
                      <InputLabel id="accent-color-label">Accent Color</InputLabel>
                      <Select
                        labelId="accent-color-label"
                        id="accent-color"
                        name="accentColor"
                        value={colorPrefs.accentColor}
                        label="Accent Color"
                        onChange={handleColorChange}
                      >
                        <MenuItem value="gold">Gold</MenuItem>
                        <MenuItem value="silver">Silver</MenuItem>
                        <MenuItem value="white">White</MenuItem>
                        <MenuItem value="orange">Orange</MenuItem>
                        <MenuItem value="teal">Teal</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Grid>

              {/* Design Style */}
              <Grid item xs={12}>
                <Typography variant="h6" component="h2">
                  Design Style
                </Typography>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="design-style-label">Design Style</InputLabel>
                  <Select
                    labelId="design-style-label"
                    id="design-style"
                    value={designStyle}
                    label="Design Style"
                    onChange={handleDesignChange}
                  >
                    <MenuItem value="minimalist">Minimalist: Simple and clean design</MenuItem>
                    <MenuItem value="futuristic">Futuristic/Modern: Sleek, cutting-edge lines</MenuItem>
                    <MenuItem value="artistic">Artistic/Custom: Hand-drawn designs or personal artwork</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Texture/Finish */}
              <Grid item xs={12}>
                <Typography variant="h6" component="h2">
                  Texture/Finish
                </Typography>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="texture-finish-label">Texture/Finish</InputLabel>
                  <Select
                    labelId="texture-finish-label"
                    id="texture-finish"
                    value={textureFinish}
                    label="Texture/Finish"
                    onChange={handleTextureChange}
                  >
                    <MenuItem value="matte">Matte: Soft, non-reflective surface</MenuItem>
                    <MenuItem value="glossy">Glossy: Shiny and reflective surface</MenuItem>
                    <MenuItem value="textured">Textured Surface: Patterns or tactile elements</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Personalization Elements */}
              <Grid item xs={12}>
                <Typography variant="h6" component="h2">
                  Personalization Elements
                </Typography>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="personalization-label">Personalization</InputLabel>
                  <Select
                    labelId="personalization-label"
                    id="personalization"
                    value={personalization}
                    label="Personalization"
                    onChange={handlePersonalizationChange}
                  >
                    <MenuItem value="monogram">Monogram or Initials: Adding personal letters</MenuItem>
                    <MenuItem value="motivational">Motivational Text or Symbol: Quotes or symbols</MenuItem>
                    <MenuItem value="none">None: No personalization</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Material Look */}
              <Grid item xs={12}>
                <Typography variant="h6" component="h2">
                  Material Look
                </Typography>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="material-look-label">Material Look</InputLabel>
                  <Select
                    labelId="material-look-label"
                    id="material-look"
                    value={materialLook}
                    label="Material Look"
                    onChange={handleMaterialChange}
                  >
                    <MenuItem value="carbon-fiber">Carbon Fiber: Sleek, modern, high-tech aesthetic</MenuItem>
                    <MenuItem value="metallic">Metallic: Modern and reflective appearance</MenuItem>
                    <MenuItem value="wood">Wood Effect: Warm, natural look</MenuItem>
                    <MenuItem value="leather">Leather Effect: Luxurious and textured appearance</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          {/* Generate Button */}
          <Box sx={{ textAlign: 'center', my: 4 }}>
            <Button 
              variant="contained" 
              color="primary" 
              size="large" 
              onClick={handleGenerateDescription}
              disabled={isLoading}
              sx={{ px: 4, py: 1 }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Generate Prosthetic Description'}
            </Button>
          </Box>

          {/* Summary of selections */}
          {(colorPrefs.primaryColor || colorPrefs.accentColor || designStyle || textureFinish || personalization || materialLook) && (
            <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" component="h2" gutterBottom>
                Your Selections
              </Typography>
              <Box sx={{ pl: 2 }}>
                {colorPrefs.primaryColor && <Typography variant="body1">Primary Color: {colorPrefs.primaryColor}</Typography>}
                {colorPrefs.accentColor && <Typography variant="body1">Accent Color: {colorPrefs.accentColor}</Typography>}
                {designStyle && <Typography variant="body1">Design Style: {designStyle}</Typography>}
                {textureFinish && <Typography variant="body1">Texture/Finish: {textureFinish}</Typography>}
                {personalization && <Typography variant="body1">Personalization: {personalization}</Typography>}
                {materialLook && <Typography variant="body1">Material Look: {materialLook}</Typography>}
              </Box>
            </Paper>
          )}

          {/* Generated Result and Prompt */}
          {(promptText || generatedDescription) && (
            <Paper elevation={3} sx={{ p: 3, mt: 3 }} id="result-section">
              {/* Prompt Section */}
              {promptText && (
                <>
                  <Typography variant="h6" component="h2" gutterBottom>
                    Prompt Sent to Gemini
                  </Typography>
                  <Box sx={{ p: 2, backgroundColor: '#f0f4ff', borderRadius: 1, mb: 3, fontFamily: 'monospace' }}>
                    <Typography variant="body2" component="div" style={{ whiteSpace: 'pre-line' }}>
                      {promptText}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 3 }} />
                </>
              )}
              
              {/* Description Section */}
              {generatedDescription && (
                <>
                  <Typography variant="h6" component="h2" gutterBottom>
                    Prosthetic Design Description
                  </Typography>
                  <Box sx={{ p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                    <Typography variant="body1" component="div" style={{ whiteSpace: 'pre-line' }}>
                      {generatedDescription}
                    </Typography>
                  </Box>
                </>
              )}
            </Paper>
          )}
        </Box>
      </Container>

      {/* Error Snackbar */}
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App; 