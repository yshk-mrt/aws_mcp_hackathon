import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Container, Typography, Box, CircularProgress, Button, Paper, ThemeProvider, createTheme, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { sendModelUrlEmail } from '../services/arcadeService';

// Dark theme with orange accents matching HomePage
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff5a3c', // Orange/coral highlight color
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
    body1: {
      color: '#ffffff', // Ensure body text is white
    },
    body2: {
      color: '#e0e0e0', // Ensure secondary body text has good contrast
    },
    caption: {
      color: '#cccccc', // Ensure captions are visible
    },
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
          textTransform: 'none',
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
  },
});

// Fallback model URL in case no custom model is found
const FALLBACK_MODEL_URL = "https://api.apify.com/v2/key-value-stores/vAW1ZfRmY28GBjbG5/records/exported.glb?attachment=true";

// Loading component for the Suspense fallback
function ModelLoader() {
  return (
    <mesh>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial color="#ff5a3c" wireframe={true} />
    </mesh>
  );
}

// Model component that loads and displays the GLB file
function Model({ modelUrl }) {
  const { scene } = useGLTF(modelUrl);
  
  // Just center the model without adding any effects
  useEffect(() => {
    if (scene) {
      // Center the model
      scene.position.set(0, 0, 0);
      
      // Reset any shadow or material settings
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
    }
  }, [scene]);
  
  return <primitive object={scene} scale={1.2} position={[0, -0.5, 0]} />;
}

// Error boundary for the 3D content
class ModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Model error caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI when an error occurs
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="error" variant="h6">
            Failed to load 3D model
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            There was a problem rendering the 3D model. The error was: {this.state.error?.message || "Unknown error"}
          </Typography>
        </Box>
      );
    }

    return this.props.children;
  }
}

function ModelViewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modelUrl, setModelUrl] = useState(FALLBACK_MODEL_URL);
  const [modelSource, setModelSource] = useState('fallback');
  const [modelDescription, setModelDescription] = useState('');
  
  // Email functionality state
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  
  // Reference to track if WebGL is supported
  const canvasRef = useRef(null);
  
  // Check WebGL support and get model URL from localStorage
  useEffect(() => {
    // Check WebGL support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setError("WebGL is not supported in your browser. The 3D model may not display correctly.");
      }
    } catch (e) {
      setError("Error checking WebGL support: " + e.message);
    }
    
    // Get saved model URL and description from localStorage if available
    try {
      const savedModelUrl = localStorage.getItem('prostheticModelUrl');
      const savedPrompt = localStorage.getItem('prostheticModelPrompt');
      const savedDescription = localStorage.getItem('prostheticModelDescription');
      
      if (savedModelUrl) {
        console.log("Found saved model URL:", savedModelUrl);
        setModelUrl(savedModelUrl);
        setModelSource('custom');
      } else {
        console.log("No saved model URL found, using fallback");
      }
      
      if (savedDescription) {
        setModelDescription(savedDescription);
      }
    } catch (err) {
      console.error("Error accessing localStorage:", err);
    }
  }, []);

  useEffect(() => {
    // Check if we can access the model URL
    const testModelAccess = async () => {
      try {
        const response = await fetch(modelUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`Failed to access model: ${response.status} ${response.statusText}`);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error loading 3D model:", err);
        
        // If custom model fails, try fallback
        if (modelSource === 'custom') {
          console.log("Custom model failed to load, trying fallback");
          setModelUrl(FALLBACK_MODEL_URL);
          setModelSource('fallback');
          // Test the fallback URL
          try {
            const fallbackResponse = await fetch(FALLBACK_MODEL_URL, { method: 'HEAD' });
            if (!fallbackResponse.ok) {
              throw new Error("Fallback model also failed to load");
            }
            setLoading(false);
          } catch (fallbackErr) {
            setError("Unable to load any 3D model. Please try again later.");
            setLoading(false);
          }
        } else {
          setError("Unable to load the 3D model. Please try again later.");
          setLoading(false);
        }
      }
    };
    
    testModelAccess();
  }, [modelUrl, modelSource]);

  // Handle sending the model URL via email
  const handleSendEmail = async () => {
    if (!modelUrl) {
      setError('No model URL available to send');
      return;
    }
    
    try {
      setIsSendingEmail(true);
      setError(null);
      setEmailSuccess(false);
      setEmailMessage('');
      
      const description = modelDescription || 'Custom prosthetic model';
      
      // Call the arcade service to send the email
      const result = await sendModelUrlEmail(modelUrl, description, false);
      
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
        background: '#000000',
        pt: 4,
        pb: 6
      }}>
        <Container maxWidth="lg">
          <Box sx={{ my: 4, textAlign: 'center' }}>
            <Typography 
              variant="h4" 
              component="h1" 
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
              Your Prosthetic Model
            </Typography>
            
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
                <CircularProgress size={60} sx={{ color: '#ff5a3c' }} />
                <Typography variant="body2" sx={{ mt: 2, color: '#aaaaaa' }}>
                  Loading 3D model from external server...
                </Typography>
              </Box>
            ) : error ? (
              <Box sx={{ my: 4 }}>
                <Typography color="error">{error}</Typography>
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={() => window.history.back()}
                  sx={{ mt: 2 }}
                >
                  Back to Preferences
                </Button>
              </Box>
            ) : (
              <>
                <Paper 
                  elevation={6} 
                  sx={{ 
                    height: '550px', 
                    width: '100%', 
                    overflow: 'hidden', 
                    mb: 2,
                    border: '1px solid rgba(255, 90, 60, 0.3)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(255, 90, 60, 0.2)'
                  }}
                >
                  <ModelErrorBoundary>
                    <Canvas 
                      ref={canvasRef}
                      camera={{ position: [0, 0, 4], fov: 45 }}
                      shadows={false}
                      onError={(e) => {
                        console.error("Canvas error:", e);
                        setError("An error occurred with the 3D renderer. Please try refreshing the page.");
                      }}
                      style={{ background: '#ffffff' }}
                    >
                      <color attach="background" args={['#ffffff']} />
                      
                      {/* Simple neutral lighting */}
                      <ambientLight intensity={0.8} />
                      <directionalLight 
                        position={[5, 5, 5]} 
                        intensity={0.7} 
                        castShadow={false}
                        color="#ffffff"
                      />
                      <directionalLight 
                        position={[-5, 5, -5]} 
                        intensity={0.5} 
                        castShadow={false}
                        color="#ffffff"
                      />
                      
                      <Suspense fallback={<ModelLoader />}>
                        <Model modelUrl={modelUrl} />
                      </Suspense>
                      
                      <OrbitControls 
                        enableDamping={true}
                        dampingFactor={0.25}
                        rotateSpeed={0.5}
                        minDistance={2}
                        maxDistance={10}
                      />
                    </Canvas>
                  </ModelErrorBoundary>
                </Paper>

                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <Typography variant="body2" component="div" sx={{ 
                    maxWidth: '600px', 
                    textAlign: 'center', 
                    color: '#ffffff',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 90, 60, 0.3)'
                  }}>
                    <strong style={{ color: '#ff7c5c' }}>Controls:</strong> Rotate (left click + drag), Zoom (scroll/pinch), Pan (right click + drag)
                  </Typography>
                </Box>
                
                <Typography variant="caption" sx={{ 
                  display: 'block', 
                  textAlign: 'center', 
                  mt: 1, 
                  mb: 3, 
                  color: '#ffffff',
                  backgroundColor: 'rgba(255, 90, 60, 0.1)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  maxWidth: '500px',
                  margin: '1rem auto 3rem'
                }}>
                  {modelSource === 'custom' ? 
                    "Displaying your custom prosthetic model based on your preferences" : 
                    "Displaying a default prosthetic model"}
                </Typography>
                
                {/* Email Sending Section */}
                <Box sx={{ 
                  mt: 3, 
                  mb: 4, 
                  textAlign: 'center',
                  backgroundColor: 'rgba(30, 30, 30, 0.7)',
                  borderRadius: '12px',
                  padding: '20px',
                  maxWidth: '600px',
                  margin: '0 auto',
                  border: '1px solid rgba(255, 90, 60, 0.2)'
                }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: '#ffffff', 
                      mb: 2,
                      position: 'relative',
                      pl: 2,
                      display: 'inline-block',
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
                    }}
                  >
                    Share Your Design
                  </Typography>
                  
                  {emailSuccess && (
                    <Alert severity="success" sx={{ 
                      mb: 2,
                      backgroundColor: 'rgba(46, 125, 50, 0.2)',
                      color: '#ffffff',
                      '& .MuiAlert-icon': {
                        color: '#81c784'
                      }
                    }}>
                      {emailMessage}
                    </Alert>
                  )}
                  
                  {error && (
                    <Alert severity="error" sx={{ 
                      mb: 2,
                      backgroundColor: 'rgba(211, 47, 47, 0.2)',
                      color: '#ffffff',
                      '& .MuiAlert-icon': {
                        color: '#f48fb1'
                      }
                    }}>
                      {error}
                    </Alert>
                  )}
                  
                  <Typography variant="body2" sx={{ color: '#d0d0d0', mb: 2 }}>
                    Send the model URL to your email for later access or to share with others.
                  </Typography>
                  
                  <Button 
                    variant="contained" 
                    color="primary"
                    onClick={handleSendEmail}
                    disabled={isSendingEmail || emailSent}
                    sx={{ 
                      px: 4, 
                      py: 1.2,
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
                    {isSendingEmail ? <CircularProgress size={24} color="inherit" /> : 
                     emailSent ? 'Email Sent ✓' : 'Send Model via Email'}
                  </Button>
                </Box>
              </>
            )}
            
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => window.history.back()}
              sx={{ 
                mt: 3,
                px: 5,
                py: 1.5,
                borderRadius: '50px',
                boxShadow: '0 4px 15px rgba(255, 90, 60, 0.4)'
              }}
            >
              Back to Preferences
            </Button>
          </Box>
        </Container>
      </Box>
      
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
              2. Sign in with your Gmail account
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

export default ModelViewPage; 