import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, Button, Paper, Typography, Container, Alert, Snackbar, IconButton, Fab } from '@mui/material';
import io from 'socket.io-client';
import axios from 'axios';
import LoadingSpinner from './LoadingSpinner';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';
import ChatIcon from '@mui/icons-material/Chat';

const quickReplies = [
  'Θέλω να σχεδιάσω κουζίνα',
  'Θέλω να δω επιλογές κουζινών',
  'Θέλω βοήθεια με αγορά & εγκατάσταση',
];

const initialBotMessage = {
  role: 'assistant',
  content: 'Γεια σου! Είμαι ο Lucca, ο ψηφιακός βοηθός της Gruppo Cucine. Πώς μπορώ να σε βοηθήσω;',
};

// Add TypingIndicator component
const TypingIndicator = () => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      <Typography>typing</Typography>
      <Typography sx={{ minWidth: '24px' }}>{dots}</Typography>
    </Box>
  );
};

const Chat = () => {
  const [messages, setMessages] = useState([initialBotMessage]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const inputRef = useRef(null);

  const deleteSession = async () => {
    if (socket) {
      try {
        await axios.delete(`https://vangelis-1d9a0def0dc8.herokuapp.com/api/sessions/${socket.id}`);
      } catch (error) {
        console.error('Error deleting session:', error);
      }
    }
  };

  useEffect(() => {
    const newSocket = io('https://vangelis-1d9a0def0dc8.herokuapp.com', {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsLoading(false);
      newSocket.emit('startChat');
    });

    newSocket.on('connect_error', (error) => {
      setError('Failed to connect to the server. Please try again later.');
      setIsLoading(false);
    });

    newSocket.on('response', (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    });

    newSocket.on('typing', (data) => {
      if (data.sessionId === 'assistant') {
        setIsTyping(true);
      }
    });

    newSocket.on('stopTyping', (data) => {
      if (data.sessionId === 'assistant') {
        setIsTyping(false);
      }
    });

    newSocket.on('error', (data) => {
      setError(data.message || 'An error occurred');
    });

    // Add beforeunload event listener
    const handleBeforeUnload = () => {
      deleteSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      deleteSession();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      newSocket.close();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = () => {
    if (input.trim() && socket) {
      socket.emit('message', { message: input });
      setMessages(prev => [...prev, { role: 'user', content: input }]);
      setInput('');
      setShowQuickReplies(false);
      setIsTyping(true);
    }
  };

  const handleQuickReply = (reply) => {
    if (socket) {
      socket.emit('message', { message: reply });
      setMessages(prev => [...prev, { role: 'user', content: reply }]);
      setShowQuickReplies(false);
      setIsTyping(true);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Emit typing event
    if (socket) {
      socket.emit('typing');
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (socket) {
        socket.emit('stopTyping');
      }
    }, 1000);
  };

  const handleCloseError = () => {
    setError(null);
  };

  useEffect(() => {
    const handleResize = () => {
      const newHeight = window.innerHeight;
      setWindowHeight(newHeight);
      // If height decreased significantly, keyboard is likely visible
      if (newHeight < windowHeight - 100) {
        setKeyboardVisible(true);
      } else {
        setKeyboardVisible(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [windowHeight]);

  if (!isVisible) return null;

  // Header bar with controls
  const HeaderBar = (
    <Box
      sx={{
        width: isMobile ? '100%' : 300,
        height: 40,
        bgcolor: 'white',
        borderBottom: '1px solid rgba(0,0,0,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        borderTopLeftRadius: isMobile ? 12 : 12,
        borderTopRightRadius: isMobile ? 12 : 12,
        boxShadow: isMinimized ? 3 : 0,
        cursor: isMinimized ? 'pointer' : 'default',
      }}
      onClick={isMinimized ? async () => {
        if (sessionEnded) {
          setMessages([initialBotMessage]);
          setShowQuickReplies(true);
          setSessionEnded(false);
        }
        setIsMinimized(false);
      } : undefined}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 500, fontSize: '1rem' }}>
        Lucca
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton 
          size="small" 
          onClick={e => { 
            e.stopPropagation(); 
            setIsMinimized(true); 
          }}
        >
          <RemoveIcon fontSize="small" />
        </IconButton>
        <IconButton 
          size="small" 
          onClick={async e => { 
            e.stopPropagation(); 
            await deleteSession(); 
            setIsMinimized(true); 
            setSessionEnded(true); 
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );

  if (isMinimized) {
    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 1300,
        }}
      >
        {isMobile ? (
          <Fab
            color="primary"
            onClick={async () => {
              if (sessionEnded) {
                setMessages([initialBotMessage]);
                setShowQuickReplies(true);
                setSessionEnded(false);
              }
              setIsMinimized(false);
            }}
            sx={{
              bgcolor: '#8B5CF6',
              '&:hover': {
                bgcolor: '#7C3AED',
              },
            }}
          >
            <ChatIcon />
          </Fab>
        ) : (
          HeaderBar
        )}
      </Box>
    );
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 1300,
      }}
    >
      <Container maxWidth="md" sx={{ p: 0 }}>
        <Paper 
          elevation={3} 
          sx={{ 
            width: isMobile ? '100vw' : 420,
            height: isMobile ? '50vh' : 470,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: isMobile ? '12px 12px 0 0' : 3,
            overflow: 'hidden',
            fontSize: '0.85rem',
            position: isMobile ? 'fixed' : 'relative',
            top: isMobile ? 'auto' : 'auto',
            left: isMobile ? 0 : 'auto',
            right: isMobile ? 0 : 'auto',
            bottom: isMobile ? (keyboardVisible ? '0' : '0') : 'auto',
            m: isMobile ? 0 : 'auto',
            transform: isMobile && keyboardVisible ? 'translateY(-50%)' : 'none',
            transition: 'transform 0.3s ease-in-out',
          }}
        >
          {HeaderBar}
          <Box sx={{ 
            flex: 1, 
            minHeight: 0,
            overflowY: 'auto', 
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            bgcolor: '#f5f5f5',
          }}>
            {messages.map((message, index) => (
              <Box
                key={index}
                sx={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                }}
              >
                {message.role === 'assistant' && index === 0 && showQuickReplies && (
                  <Box sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        bgcolor: 'white',
                        p: 2,
                        borderRadius: 2,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        display: 'flex',
                        gap: 2,
                        alignItems: 'flex-start',
                      }}
                    >
                      <Box
                        component="div"
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: '#8B5CF6',
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography sx={{ color: 'white' }}>📄</Typography>
                      </Box>
                      <Typography>{message.content}</Typography>
                    </Box>
                    
                    <Typography sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
                      Αυτές είναι οι πιο συχνές ερωτήσεις:
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {quickReplies.map((reply, i) => (
                        <Button
                          key={i}
                          variant="outlined"
                          sx={{
                            color: 'text.primary',
                            borderColor: 'rgba(0, 0, 0, 0.12)',
                            bgcolor: 'white',
                            justifyContent: 'flex-start',
                            textTransform: 'none',
                            p: 2,
                            borderRadius: 3,
                            '&:hover': {
                              bgcolor: 'rgba(0, 0, 0, 0.04)',
                              borderColor: 'rgba(0, 0, 0, 0.12)',
                            }
                          }}
                          onClick={() => handleQuickReply(reply)}
                        >
                          {reply}
                        </Button>
                      ))}
                    </Box>
                  </Box>
                )}
                {(message.role !== 'assistant' || index !== 0) && (
                  <Box
                    sx={{
                      bgcolor: message.role === 'user' ? '#8B5CF6' : 'white',
                      color: message.role === 'user' ? 'white' : 'text.primary',
                      p: 2,
                      borderRadius: 2,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    <Typography>{message.content}</Typography>
                  </Box>
                )}
              </Box>
            ))}
            {isTyping && (
              <Box
                sx={{
                  alignSelf: 'flex-start',
                  maxWidth: '70%',
                  bgcolor: 'white',
                  p: 2,
                  borderRadius: 2,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <TypingIndicator />
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>
          <Box sx={{ 
            p: 2, 
            bgcolor: 'white', 
            borderTop: '1px solid rgba(0, 0, 0, 0.12)',
            position: isMobile ? 'sticky' : 'relative',
            bottom: 0,
          }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                inputRef={inputRef}
                fullWidth
                value={input}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                variant="outlined"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={!input.trim()}
                sx={{
                  bgcolor: '#8B5CF6',
                  borderRadius: 2,
                  minWidth: 'auto',
                  px: 3,
                  '&:hover': {
                    bgcolor: '#7C3AED',
                  },
                  '&.Mui-disabled': {
                    bgcolor: 'rgba(139, 92, 246, 0.5)',
                  }
                }}
              >
                Send
              </Button>
            </Box>
          </Box>
        </Paper>
        {!isMobile && (
          <Box sx={{ 
            textAlign: 'center', 
            py: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: 'white',
            borderRadius: 3,
            mt: 1,
            width: 420,
            fontSize: '0.85rem'
          }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              AI may generate inaccurate information
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#8B5CF6',
                fontWeight: 500
              }}
            >
              Powered by Agenty
            </Typography>
          </Box>
        )}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={handleCloseError}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
};

export default Chat; 