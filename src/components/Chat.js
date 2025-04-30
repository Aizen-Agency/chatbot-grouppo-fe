import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, Button, Paper, Typography, Container, Alert, Snackbar, IconButton } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import io from 'socket.io-client';
import axios from 'axios';
import LoadingSpinner from './LoadingSpinner';

const quickReplies = [
  'Θέλω να σχεδιάσω κουζίνα',
  'Θέλω να δω επιλογές κουζινών',
  'Θέλω βοήθεια με αγορά & εγκατάσταση',
];

const initialBotMessage = {
  role: 'assistant',
  content: 'Γεια σου! Είμαι ο Lucca, ο ψηφιακός βοηθός της Gruppo Cucine. Πώς μπορώ να σε βοηθήσω;',
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

  const handleCloseChat = () => {
    deleteSession();
    window.close();
  };

  const handleDeleteChat = () => {
    deleteSession();
    setMessages([initialBotMessage]);
    setShowQuickReplies(true);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  
  return (
    <Container maxWidth="md" sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Paper elevation={0} sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 0, mb: 1 }}>
        <Box sx={{ 
          p: 2, 
          bgcolor: 'white', 
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 500 }}>Lucca</Typography>
          <Box>
            <IconButton size="small">
              <LinkIcon />
            </IconButton>
            <IconButton size="small" onClick={handleDeleteChat}>
              <DeleteIcon />
            </IconButton>
            <IconButton size="small" onClick={handleCloseChat}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto', 
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          bgcolor: '#f5f5f5',
          minHeight: 0
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
              <Typography>Assistant is typing...</Typography>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>

        <Box sx={{ p: 2, bgcolor: 'white', borderTop: '1px solid rgba(0, 0, 0, 0.12)' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
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

      <Box sx={{ 
        textAlign: 'center', 
        py: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: 'white'
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
  );
};

export default Chat; 