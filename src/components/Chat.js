import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, Button, Paper, Typography, Container, Alert, Snackbar, IconButton, Fab } from '@mui/material';
import io from 'socket.io-client';
import LoadingSpinner from './LoadingSpinner';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';
import ChatIcon from '@mui/icons-material/Chat';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SendIcon from '@mui/icons-material/Send';

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

// Add TypedMessage component for letter-by-letter animation
const TypedMessage = ({ content, forceShow }) => {
  const [displayedContent, setDisplayedContent] = useState(forceShow ? content : '');
  const [isTyping, setIsTyping] = useState(!forceShow);
  const indexRef = useRef(0);

  useEffect(() => {
    if (forceShow) {
      setDisplayedContent(content);
      setIsTyping(false);
      return;
    }
    if (indexRef.current < content.length) {
      const timer = setTimeout(() => {
        setDisplayedContent(prev => prev + content[indexRef.current]);
        indexRef.current += 1;
      }, 30);
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [displayedContent, content, forceShow]);

  useEffect(() => {
    if (forceShow) {
      setDisplayedContent(content);
      setIsTyping(false);
    }
  }, [forceShow, content]);

  return (
    <Typography>
      {displayedContent}
      {isTyping && <span className="cursor">|</span>}
    </Typography>
  );
};

// Custom hook to listen to host app's viewport information
const useHostViewport = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  const [isHostMobile, setIsHostMobile] = useState(null);

  useEffect(() => {
    // Listen for messages from host app
    const handleMessage = (event) => {
      // Only process messages from the expected origin
      if (event.origin !== window.location.origin) return;

      try {
        let data = event.data;
        if (typeof data === 'string') {
          // Only try to parse if it looks like JSON
          if (data.startsWith('{') || data.startsWith('[')) {
            data = JSON.parse(data);
          } else {
            return; // Ignore non-JSON strings
          }
        }
        if (data.type === 'VIEWPORT_INFO') {
          setIsHostMobile(data.isMobile);
        }
      } catch (error) {
        // Optionally: console.warn('Ignored non-JSON message', event.data);
      }
    };

    // Request viewport info from host app
    const requestViewportInfo = () => {
      if (window.parent !== window) {
        window.parent.postMessage(JSON.stringify({
          type: 'REQUEST_VIEWPORT_INFO'
        }), '*');
      }
    };

    window.addEventListener('message', handleMessage);
    requestViewportInfo();

    // Fallback to window resize if no host info is received
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Use host's mobile info if available, otherwise fallback to window width
  return isHostMobile !== null ? isHostMobile : isMobile;
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
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [initialWindowHeight] = useState(window.innerHeight);
  const inputRef = useRef(null);
  const [lastAnimatedBotMsgIndex, setLastAnimatedBotMsgIndex] = useState(null);

  // Use the custom hook instead of local state
  const isMobile = useHostViewport();

  const deleteSession = async () => {
    if (socket) {
      socket.emit('deleteSession', { sessionId: socket.id });
    }
  };

  useEffect(() => {
    const newSocket = io('https://vangelis-be-72a501737d30.herokuapp.com', {
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
      console.log('Received assistant response:', data.message);
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

  useEffect(() => {
    // Set the last bot message index to animate when a new assistant message arrives
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      setLastAnimatedBotMsgIndex(messages.length - 1);
    }
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && socket) {
      socket.emit('message', { message: input });
      setMessages(prev => [...prev, { role: 'user', content: input }]);
      setInput('');
      setShowQuickReplies(false);
      setIsTyping(true);
      setLastAnimatedBotMsgIndex(null); // Stop animation for all bot messages
    }
  };

  const handleQuickReply = (reply) => {
    console.log('Quick reply clicked:', reply, 'Socket:', !!socket);
    if (socket) {
      socket.emit('message', { message: reply });
      setMessages(prev => [...prev, { role: 'user', content: reply }]);
      setShowQuickReplies(false);
      setIsTyping(true);
      setLastAnimatedBotMsgIndex(null); // Stop animation for all bot messages
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
      // If height decreased significantly from initial, keyboard is likely visible
      if (isMobile && initialWindowHeight - newHeight > 100) {
        setKeyboardVisible(true);
      } else {
        setKeyboardVisible(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initialWindowHeight, isMobile]);

  if (!isVisible) return null;

  // Header bar with controls
  const HeaderBar = (
    <Box
      sx={{
        width: '100%', // Always fill parent
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
      <Box sx={{ 
        display: 'flex', 
        gap: 1,
        ml: 'auto', // Push to the right
      }}>
        <IconButton 
          size="small" 
          onClick={e => { 
            e.stopPropagation(); 
            setIsMinimized(true); 
          }}
          sx={{
            minWidth: '32px',
            width: '32px',
            height: '32px'
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
          sx={{
            minWidth: '32px',
            width: '32px',
            height: '32px'
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

  console.log('Rendering messages:', messages);
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
            {messages.filter(m => m && m.content).map((message, index) => {
              const isInitialBotMessage = index === 0 && message.role === 'assistant';
              const isLastAssistantMessage = message.role === 'assistant' && index === messages.length - 1;
              return (
                <React.Fragment key={index}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                      mb: 2,
                    }}
                  >
                    <Paper
                      elevation={1}
                      sx={{
                        p: 2,
                        maxWidth: '70%',
                        backgroundColor: isInitialBotMessage ? '#f5f5f5' : (message.role === 'user' ? '#e3f2fd' : '#f5f5f5'),
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                      }}
                    >
                      {isInitialBotMessage && (
                        <InsertDriveFileIcon sx={{ color: '#8B5CF6', mt: 0.5 }} />
                      )}
                      {message.role === 'assistant'
                        ? (isTyping && isLastAssistantMessage
                            ? <TypedMessage content={message.content} forceShow={false} />
                            : <Typography>{message.content}</Typography>
                          )
                        : <Typography>{message.content}</Typography>
                      }
                    </Paper>
                  </Box>
                </React.Fragment>
              );
            })}
            {isTyping && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  mb: 2,
                }}
              >
                <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                  <TypingIndicator />
                </Paper>
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
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5
          }}>
            {showQuickReplies && (
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ mb: 0.5, fontSize: '0.85rem', color: '#888', fontWeight: 500 }}>
                  Common questions are:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {quickReplies.map((reply, i) => (
                    <Button
                      key={i}
                      variant="outlined"
                      fullWidth
                      onClick={() => handleQuickReply(reply)}
                      disabled={!socket}
                      sx={{
                        borderRadius: 999,
                        textTransform: 'none',
                        fontWeight: 400,
                        fontSize: '0.95rem',
                        justifyContent: 'flex-start',
                        bgcolor: 'white',
                        borderColor: '#e0e0e0',
                        color: '#222',
                        boxShadow: 'none',
                        px: 2.5,
                        py: 1.2,
                        minHeight: '36px',
                        '&:hover': {
                          bgcolor: '#f5f5f5',
                          borderColor: '#bdbdbd',
                        },
                      }}
                    >
                      {reply}
                    </Button>
                  ))}
                </Box>
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                inputRef={inputRef}
                fullWidth
                value={input}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Tell us how we can help..."
                variant="outlined"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 999,
                    fontSize: '0.95rem',
                    bgcolor: '#fafafa',
                    paddingRight: 0,
                  },
                  '& input': {
                    padding: '10px 16px',
                  },
                  flex: 1
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={!input.trim()}
                sx={{
                  bgcolor: '#ece9f6',
                  borderRadius: 999,
                  width: 40,
                  height: 40,
                  ml: 0.5,
                  '&:hover': {
                    bgcolor: '#e0e0e0',
                  },
                  '&.Mui-disabled': {
                    bgcolor: '#f3f3f3',
                  }
                }}
              >
                <SendIcon sx={{ fontSize: 22, color: '#8B5CF6' }} />
              </IconButton>
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