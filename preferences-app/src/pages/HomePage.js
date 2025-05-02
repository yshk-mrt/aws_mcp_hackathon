import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Divider,
  Chip,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Link,
  Tooltip
} from '@mui/material';
import { generateProstheticDescription, validateApiKey } from '../services/geminiService';
import { generateProstheticModel, formatPromptForApify } from '../services/apifyService';
import { sendModelUrlEmail } from '../services/arcadeService';

// Directly define the API key here (same as in geminiService.js)
const API_KEY = "AIzaSyAHDO4oG-KLMB_iw6wftNslEr6kARJ51T8";

// Email configuration
const SENDER_EMAIL = "sarvidebate@gmail.com";
const RECIPIENT_EMAIL = "goyalsarvagya@gmail.com";

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff5a3c', // Orange/coral highlight color from the image
    },
    secondary: {
      main: '#ff7c5c', // Lighter variant of the primary color
    },
    background: {
      default: '#0e0e0e', // Very dark background
      paper: '#1a1a1a', // Slightly lighter than background for paper elements
    },
    text: {
      primary: '#ffffff',
      secondary: '#d0d0d0', // Lighter secondary text for better contrast
    },
  },
  typography: {
    fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
    h4: {
      fontWeight: 700, // Bolder for better visibility
      marginBottom: '1rem',
      letterSpacing: '0.02em',
      color: '#ffffff', // Ensure headings are white
    },
    h6: {
      fontWeight: 600, // Bolder for better visibility
      marginBottom: '0.5rem',
      letterSpacing: '0.01em',
      color: '#ffffff', // Ensure headings are white
    },
    body1: {
      color: '#ffffff', // Ensure body text is white
    },
    body2: {
      color: '#e0e0e0', // Ensure secondary body text has good contrast
    },
    caption: {
      color: '#cccccc', // Ensure captions are visible
    },
    button: {
      textTransform: 'none',
      fontWeight: 600, // Bolder for better visibility
      letterSpacing: '0.02em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 12,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 24px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(255, 90, 60, 0.2)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(45deg, #ff5a3c 30%, #ff7c5c 90%)',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

function HomePage() {
  const navigate = useNavigate();
  
  // State for each preference category
  const [colorPrefs, setColorPrefs] = useState({
    primaryColor: '',
    accentColor: ''
  });
  
  const [designStyle, setDesignStyle] = useState('');
  const [textureFinish, setTextureFinish] = useState('');
  const [personalization, setPersonalization] = useState('');
  const [materialLook, setMaterialLook] = useState('');
  
  // State for Gemini API - keep required functionality but hide UI
  const [apiKey, setApiKey] = useState(API_KEY || '');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [isKeyValid, setIsKeyValid] = useState(true); // Default to true to hide validation
  const [isLoading, setIsLoading] = useState(false);
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [promptText, setPromptText] = useState('');
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [apiKeyErrorDetails, setApiKeyErrorDetails] = useState('');
  
  // State for 3D model generation
  const [isGenerating3DModel, setIsGenerating3DModel] = useState(false);
  const [modelGenerationStatus, setModelGenerationStatus] = useState('');
  const [modelUrl, setModelUrl] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  
  // State for email sending
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  
  // State for test email functionality
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  
  // Steps for the generation process
  const steps = [
    'Generate Description',
    'Create 3D Model',
    'View Model'
  ];

  // Validate API key silently on initial load, don't show UI
  useEffect(() => {
    const validateKey = async () => {
      try {
        const validationResult = await validateApiKey(apiKey);
        setIsKeyValid(validationResult.isValid);
        setApiKeyErrorDetails(validationResult.error || '');
        
        if (validationResult.isValid) {
          console.log("API key is valid");
        } else {
          console.log("API key validation failed:", validationResult.error);
        }
      } catch (err) {
        console.error("Error validating API key:", err);
        setIsKeyValid(false);
        setApiKeyErrorDetails('Unexpected error during validation');
      } finally {
        setIsValidatingKey(false);
      }
    };

    // If we have an API key, validate it silently
    if (apiKey) {
      validateKey();
    }
  }, [apiKey]);

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

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Navigation function to the model view page
  const handleViewModel = () => {
    navigate('/view-model');
  };

  // Handle test email dialog
  const handleOpenTestEmailDialog = () => {
    setTestEmailDialogOpen(true);
  };
  
  const handleCloseTestEmailDialog = () => {
    setTestEmailDialogOpen(false);
  };
  
  // Handle test email sending
  const handleSendTestEmail = async () => {
    try {
      setIsTestingEmail(true);
      setError('');
      setEmailSuccess(false);
      setEmailMessage('');
      
      // Create a test model URL
      const testModelUrl = "https://api.apify.com/v2/key-value-stores/vAW1ZfRmY28GBjbG5/records/exported.glb?attachment=true";
      const testDescription = "This is a test email to verify the email sending functionality works correctly.";
      
      // Call the arcade service to send the test email with isTest=true
      const result = await sendModelUrlEmail(testModelUrl, testDescription, true);
      
      if (result.success) {
        setEmailSuccess(true);
        setEmailMessage("Test email sent successfully!");
        setTestEmailDialogOpen(false);
        console.log("Test email sent successfully");
      } else if (result.requiresAuth && result.authUrl) {
        // If authorization is required, show the dialog with the auth URL
        setAuthUrl(result.authUrl);
        setAuthDialogOpen(true);
        setTestEmailDialogOpen(false);
        console.log("Auth URL:", result.authUrl);
      } else {
        throw new Error(result.message || 'Failed to send test email');
      }
    } catch (err) {
      console.error("Error sending test email:", err);
      setError('Error sending test email: ' + (err.message || 'Something went wrong'));
      setSnackbarOpen(true);
    } finally {
      setIsTestingEmail(false);
    }
  };

  // Handle generating the description
  const handleGenerateDescription = async () => {
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
      setActiveStep(0);

      // Use the hardcoded API key
      window.tempApiKey = API_KEY;
      
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
      
      if (result.description.includes("Error")) {
        // Handle error response
        setError(result.description);
        setSnackbarOpen(true);
        
        // Still set the prompt to show what would have been sent
        setPromptText(result.prompt);
      } else {
        // Set successful response
        setPromptText(result.prompt);
        setGeneratedDescription(result.description);
        
        // Save the description to localStorage for the email functionality
        localStorage.setItem('prostheticModelDescription', result.description);
        
        setActiveStep(1); // Move to next step
      }
      
      // Scroll to the result
      setTimeout(() => {
        document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error("App error:", err);
      setError('Error: ' + (err.message || 'Something went wrong. Please try again.'));
      setSnackbarOpen(true);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle generating the 3D model
  const handleGenerate3DModel = async () => {
    if (!generatedDescription) {
      setError('Please generate a description first');
      setSnackbarOpen(true);
      return;
    }
    
    try {
      setIsGenerating3DModel(true);
      setModelGenerationStatus('Preparing prompt for 3D model generation...');
      setError('');
      
      // Format the Gemini description into a shorter prompt for Apify
      const formattedPrompt = formatPromptForApify(generatedDescription);
      console.log("Formatted prompt for Apify:", formattedPrompt);
      
      // Save the prompt to localStorage
      localStorage.setItem('prostheticModelPrompt', formattedPrompt);
      
      setModelGenerationStatus('Generating 3D model (this may take a minute)...');
      
      // Call the Apify service to generate the 3D model
      const result = await generateProstheticModel(formattedPrompt);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to generate 3D model');
      }
      
      console.log("3D model generated successfully:", result.modelUrl);
      setModelUrl(result.modelUrl);
      
      // Save the model URL to localStorage so it can be accessed from the ModelViewPage
      localStorage.setItem('prostheticModelUrl', result.modelUrl);
      
      setModelGenerationStatus('3D model generated successfully!');
      setActiveStep(2); // Move to final step
      
    } catch (err) {
      console.error("Error generating 3D model:", err);
      setError('Error generating 3D model: ' + (err.message || 'Something went wrong'));
      setSnackbarOpen(true);
    } finally {
      setIsGenerating3DModel(false);
    }
  };

  // Handle sending the model URL via email
  const handleSendEmail = async () => {
    if (!modelUrl) {
      setError('Please generate a 3D model first');
      setSnackbarOpen(true);
      return;
    }
    
    try {
      setIsSendingEmail(true);
      setError('');
      setEmailSuccess(false);
      setEmailMessage('');
      
      // Call the arcade service to send the email with isTest=false
      const result = await sendModelUrlEmail(modelUrl, generatedDescription, false);
      
      if (result.success) {
        setEmailSent(true);
        setEmailSuccess(true);
        setEmailMessage(result.message || 'Email sent successfully!');
        console.log("Email sent successfully");
      } else if (result.requiresAuth && result.authUrl) {
        // If authorization is required, show the dialog with the auth URL
        setAuthUrl(result.authUrl);
        setAuthDialogOpen(true);
        console.log("Auth URL:", result.authUrl);
      } else {
        throw new Error(result.message || 'Failed to send email');
      }
      
    } catch (err) {
      console.error("Error sending email:", err);
      setError('Error sending email: ' + (err.message || 'Something went wrong'));
      setSnackbarOpen(true);
    } finally {
      setIsSendingEmail(false);
    }
  };
  
  // Handle closing the auth dialog
  const handleAuthDialogClose = () => {
    setAuthDialogOpen(false);
  };
  
  // Handle authorization completed
  const handleAuthCompleted = () => {
    setAuthDialogOpen(false);
    // Try sending the email again after authorization
    handleSendEmail();
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
        backgroundImage: `radial-gradient(rgba(255, 90, 60, 0.1) 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
        pt: 3,
        pb: 6
      }}>
        <Container maxWidth="md">
          <Box sx={{ my: 4 }}>
            <Typography 
              variant="h4" 
              component="h1" 
              align="center" 
              gutterBottom
              sx={{
                color: '#ff5a3c',
                textShadow: '0 0 10px rgba(0, 0, 0, 0.8), 0 0 5px rgba(0, 0, 0, 0.5)',
                fontWeight: 'bold',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 90, 60, 0.3)',
                display: 'inline-block',
                margin: '0 auto 20px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
              }}
            >
              Prosthetic Design Preferences
            </Typography>
            
            {/* Direct Model View Button at the top */}
            <Box sx={{ textAlign: 'center', my: 3 }}>
              <Button 
                variant="contained" 
                color="secondary" 
                size="large" 
                onClick={handleViewModel}
                sx={{ 
                  px: 4, 
                  py: 1.2,
                  borderRadius: '50px',
                  boxShadow: '0 4px 15px rgba(255, 90, 60, 0.4)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(255, 90, 60, 0.5)',
                  }
                }}
              >
                View 3D Prosthetic Model
              </Button>
              <Typography variant="body2" sx={{ mt: 1, color: '#d0d0d0' }}>
                Skip directly to viewing the interactive 3D model
              </Typography>
            </Box>
            
            {/* Process Stepper */}
            <Paper 
              elevation={4} 
              sx={{ 
                p: 2.5, 
                mb: 4, 
                backgroundColor: 'rgba(30, 30, 30, 0.7)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <Stepper 
                activeStep={activeStep} 
                sx={{ 
                  '& .MuiStepLabel-label': { 
                    color: '#d0d0d0',
                    '&.Mui-active': { color: '#ff7c5c' }
                  },
                  '& .MuiStepIcon-root': {
                    color: 'rgba(255, 255, 255, 0.2)',
                    '&.Mui-active': { color: '#ff5a3c' },
                    '&.Mui-completed': { color: '#ff7c5c' }
                  }
                }}
              >
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Paper>
            
            {/* Email Test Button */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Tooltip title="Test the email sending functionality with a sample model URL">
                <Button 
                  variant="outlined" 
                  color="primary"
                  onClick={handleOpenTestEmailDialog}
                  disabled={isTestingEmail}
                  sx={{
                    borderRadius: '50px',
                    borderWidth: '2px',
                    borderColor: 'rgba(255, 90, 60, 0.5)',
                    '&:hover': {
                      borderWidth: '2px',
                      borderColor: '#ff5a3c',
                      backgroundColor: 'rgba(255, 90, 60, 0.05)'
                    }
                  }}
                >
                  Test Email Functionality
                </Button>
              </Tooltip>
            </Box>
            
            <Paper elevation={4} sx={{ 
              p: 3, 
              mt: 3, 
              backgroundColor: 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }}>
              <Grid container spacing={4}>
                {/* Color Preferences */}
                <Grid item xs={12}>
                  <Typography variant="h6" component="h2" sx={{
                    position: 'relative',
                    pl: 2,
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: '80%',
                      width: '4px',
                      backgroundColor: '#ff5a3c',
                      borderRadius: '4px'
                    }
                  }}>
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
                          sx={{
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(255, 255, 255, 0.15)'
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(255, 90, 60, 0.5)'
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#ff5a3c'
                            }
                          }}
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
                          sx={{
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(255, 255, 255, 0.15)'
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(255, 90, 60, 0.5)'
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#ff5a3c'
                            }
                          }}
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
                  <Typography variant="h6" component="h2" sx={{
                    position: 'relative',
                    pl: 2,
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: '80%',
                      width: '4px',
                      backgroundColor: '#ff5a3c',
                      borderRadius: '4px'
                    }
                  }}>
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
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 255, 255, 0.15)'
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 90, 60, 0.5)'
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#ff5a3c'
                        }
                      }}
                    >
                      <MenuItem value="minimalist">Minimalist: Simple and clean design</MenuItem>
                      <MenuItem value="futuristic">Futuristic/Modern: Sleek, cutting-edge lines</MenuItem>
                      <MenuItem value="artistic">Artistic/Custom: Hand-drawn designs or personal artwork</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Texture/Finish */}
                <Grid item xs={12}>
                  <Typography variant="h6" component="h2" sx={{
                    position: 'relative',
                    pl: 2,
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: '80%',
                      width: '4px',
                      backgroundColor: '#ff5a3c',
                      borderRadius: '4px'
                    }
                  }}>
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
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 255, 255, 0.15)'
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 90, 60, 0.5)'
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#ff5a3c'
                        }
                      }}
                    >
                      <MenuItem value="matte">Matte: Soft, non-reflective surface</MenuItem>
                      <MenuItem value="glossy">Glossy: Shiny and reflective surface</MenuItem>
                      <MenuItem value="textured">Textured Surface: Patterns or tactile elements</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Personalization Elements */}
                <Grid item xs={12}>
                  <Typography variant="h6" component="h2" sx={{
                    position: 'relative',
                    pl: 2,
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: '80%',
                      width: '4px',
                      backgroundColor: '#ff5a3c',
                      borderRadius: '4px'
                    }
                  }}>
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
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 255, 255, 0.15)'
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 90, 60, 0.5)'
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#ff5a3c'
                        }
                      }}
                    >
                      <MenuItem value="monogram">Monogram or Initials: Adding personal letters</MenuItem>
                      <MenuItem value="motivational">Motivational Text or Symbol: Quotes or symbols</MenuItem>
                      <MenuItem value="none">None: No personalization</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Material Look */}
                <Grid item xs={12}>
                  <Typography variant="h6" component="h2" sx={{
                    position: 'relative',
                    pl: 2,
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: '80%',
                      width: '4px',
                      backgroundColor: '#ff5a3c',
                      borderRadius: '4px'
                    }
                  }}>
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
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 255, 255, 0.15)'
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 90, 60, 0.5)'
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#ff5a3c'
                        }
                      }}
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
                sx={{ 
                  px: 5, 
                  py: 1.5, 
                  mr: 2,
                  borderRadius: '50px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(255, 90, 60, 0.4)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(255, 90, 60, 0.5)',
                  }
                }}
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Generate Description'}
              </Button>
              
              {generatedDescription && (
                <Button 
                  variant="contained" 
                  color="primary" 
                  size="large" 
                  onClick={handleGenerate3DModel}
                  disabled={isGenerating3DModel || !generatedDescription}
                  sx={{ 
                    px: 5, 
                    py: 1.5,
                    borderRadius: '50px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(255, 90, 60, 0.4)',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 20px rgba(255, 90, 60, 0.5)',
                    }
                  }}
                >
                  {isGenerating3DModel ? <CircularProgress size={24} color="inherit" /> : 'Create 3D Model'}
                </Button>
              )}
            </Box>

            {/* Summary of selections */}
            {(colorPrefs.primaryColor || colorPrefs.accentColor || designStyle || textureFinish || personalization || materialLook) && (
              <Paper elevation={4} sx={{ 
                p: 3, 
                mt: 3, 
                backgroundColor: 'rgba(30, 30, 30, 0.8)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
              }}>
                <Typography variant="h6" component="h2" gutterBottom sx={{ 
                  color: '#ffffff',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  paddingBottom: '8px',
                  position: 'relative',
                  pl: 2,
                  '&:before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    height: '80%',
                    width: '4px',
                    backgroundColor: '#ff5a3c',
                    borderRadius: '4px'
                  }
                }}>
                  Your Selections
                </Typography>
                <Box sx={{ 
                  pl: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                  gap: 2
                }}>
                  {colorPrefs.primaryColor && (
                    <Typography variant="body1" sx={{ color: '#ffffff' }}>
                      <strong style={{ color: '#ff7c5c' }}>Primary Color:</strong> {colorPrefs.primaryColor}
                    </Typography>
                  )}
                  {colorPrefs.accentColor && (
                    <Typography variant="body1" sx={{ color: '#ffffff' }}>
                      <strong style={{ color: '#ff7c5c' }}>Accent Color:</strong> {colorPrefs.accentColor}
                    </Typography>
                  )}
                  {designStyle && (
                    <Typography variant="body1" sx={{ color: '#ffffff' }}>
                      <strong style={{ color: '#ff7c5c' }}>Design Style:</strong> {designStyle}
                    </Typography>
                  )}
                  {textureFinish && (
                    <Typography variant="body1" sx={{ color: '#ffffff' }}>
                      <strong style={{ color: '#ff7c5c' }}>Texture/Finish:</strong> {textureFinish}
                    </Typography>
                  )}
                  {personalization && (
                    <Typography variant="body1" sx={{ color: '#ffffff' }}>
                      <strong style={{ color: '#ff7c5c' }}>Personalization:</strong> {personalization}
                    </Typography>
                  )}
                  {materialLook && (
                    <Typography variant="body1" sx={{ color: '#ffffff' }}>
                      <strong style={{ color: '#ff7c5c' }}>Material Look:</strong> {materialLook}
                    </Typography>
                  )}
                </Box>
              </Paper>
            )}

            {/* Generated Result and Prompt */}
            {(promptText || generatedDescription || modelGenerationStatus) && (
              <Paper elevation={4} sx={{ 
                p: 3, 
                mt: 3,
                backgroundColor: 'rgba(30, 30, 30, 0.8)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
              }} id="result-section">
                {/* Description Section */}
                {generatedDescription && (
                  <>
                    <Typography variant="h6" component="h2" gutterBottom sx={{ 
                      color: '#ffffff',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      paddingBottom: '8px',
                      position: 'relative',
                      pl: 2,
                      '&:before': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        height: '80%',
                        width: '4px',
                        backgroundColor: '#ff5a3c',
                        borderRadius: '4px'
                      }
                    }}>
                      Prosthetic Design Description
                    </Typography>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'rgba(18, 18, 18, 0.7)', 
                      borderRadius: 1,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                    }}>
                      <Typography 
                        variant="body1" 
                        component="div" 
                        style={{ 
                          whiteSpace: 'pre-line',
                          color: '#ffffff',
                          lineHeight: '1.6',
                          textShadow: '0 0 1px rgba(255, 255, 255, 0.1)' // Subtle text shadow for better readability
                        }}
                      >
                        {generatedDescription}
                      </Typography>
                    </Box>
                    
                    {isGenerating3DModel && (
                      <Box sx={{ 
                        textAlign: 'center', 
                        my: 3, 
                        p: 3,
                        backgroundColor: 'rgba(18, 18, 18, 0.5)',
                        borderRadius: '8px'
                      }}>
                        <CircularProgress size={36} sx={{ color: '#ff7c5c' }} />
                        <Typography variant="body2" sx={{ mt: 2, color: '#ffffff' }}>
                          {modelGenerationStatus}
                        </Typography>
                      </Box>
                    )}
                    
                    {modelUrl && (
                      <Box sx={{ 
                        mt: 3, 
                        textAlign: 'center',
                        p: 3,
                        backgroundColor: 'rgba(18, 18, 18, 0.5)',
                        borderRadius: '12px',
                        border: '1px dashed rgba(255, 90, 60, 0.3)'
                      }}>
                        <Alert severity="success" sx={{ 
                          mb: 2,
                          backgroundColor: 'rgba(46, 125, 50, 0.2)', // Darken success alert background
                          color: '#ffffff', // White text
                          '& .MuiAlert-icon': {
                            color: '#81c784' // Brighter icon
                          }
                        }}>
                          3D model has been successfully generated!
                        </Alert>
                        
                        {/* Email Button */}
                        <Button 
                          variant="outlined" 
                          color="primary" 
                          size="large" 
                          onClick={handleSendEmail}
                          disabled={isSendingEmail || emailSent}
                          sx={{ 
                            px: 4, 
                            py: 1, 
                            mr: 2,
                            borderRadius: '50px',
                            borderWidth: '2px',
                            borderColor: 'rgba(255, 90, 60, 0.5)',
                            '&:hover': {
                              borderWidth: '2px', 
                              borderColor: '#ff5a3c',
                              backgroundColor: 'rgba(255, 90, 60, 0.05)'
                            }
                          }}
                        >
                          {isSendingEmail ? <CircularProgress size={24} color="inherit" /> : 
                           emailSent ? 'Email Sent ✓' : 'Send Model Via Email'}
                        </Button>
                        
                        {/* View Model Button */}
                        <Button 
                          variant="contained" 
                          color="secondary" 
                          size="large" 
                          onClick={handleViewModel}
                          sx={{ 
                            px: 4, 
                            py: 1,
                            borderRadius: '50px',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 15px rgba(255, 90, 60, 0.4)',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 6px 20px rgba(255, 90, 60, 0.5)',
                            }
                          }}
                          disabled={isGenerating3DModel && !modelUrl}
                        >
                          View 3D Prosthetic Model
                        </Button>
                        <Typography variant="caption" display="block" sx={{ 
                          mt: 1, 
                          color: '#ffffff',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          margin: '8px auto 0'
                        }}>
                          Explore an interactive 3D model based on your preferences
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Paper>
            )}
          </Box>
        </Container>
      </Box>

      {/* Error Snackbar */}
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      
      {/* Success Snackbar */}
      <Snackbar 
        open={emailSuccess} 
        autoHideDuration={6000} 
        onClose={() => setEmailSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setEmailSuccess(false)} severity="success" sx={{ width: '100%' }}>
          {emailMessage}
        </Alert>
      </Snackbar>
      
      {/* Test Email Dialog */}
      <Dialog open={testEmailDialogOpen} onClose={handleCloseTestEmailDialog}>
        <DialogTitle>Send Test Email</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will send a test email to {RECIPIENT_EMAIL} using a sample model URL.
            This is useful to verify that the email sending functionality is working correctly.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTestEmailDialog}>Cancel</Button>
          <Button 
            onClick={handleSendTestEmail} 
            variant="contained" 
            color="primary"
            disabled={isTestingEmail}
            startIcon={isTestingEmail ? <CircularProgress size={16} /> : null}
          >
            Send Test Email
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Authorization Dialog */}
      <Dialog 
        open={authDialogOpen} 
        onClose={handleAuthDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Authorization Required</DialogTitle>
        <DialogContent>
          <DialogContentText>
            To send emails, you need to authorize access to your Gmail account. Please follow these steps:
          </DialogContentText>
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="body1" component="div" gutterBottom>
              1. Click the link below to open the authorization page
            </Typography>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
              <Button 
                variant="contained" 
                color="primary"
                component="a"
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textTransform: 'none', mb: 2 }}
              >
                Open Authorization Link
              </Button>
            </Box>
            <Typography variant="body1" component="div" gutterBottom>
              2. Sign in with your Gmail account ({SENDER_EMAIL})
            </Typography>
            <Typography variant="body1" component="div" gutterBottom>
              3. Allow the requested permissions
            </Typography>
            <Typography variant="body1" component="div" gutterBottom>
              4. After completing authorization, come back here and click "I've Completed Authorization"
            </Typography>
          </Box>
          <Box sx={{ mt: 2, bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
            <Typography variant="caption" color="textSecondary">
              Authorization URL: <span style={{ wordBreak: 'break-all' }}>{authUrl}</span>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAuthDialogClose}>Cancel</Button>
          <Button onClick={handleAuthCompleted} variant="contained" color="primary">
            I've Completed Authorization
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default HomePage; 