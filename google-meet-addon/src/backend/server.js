// Evenfall Advantage Meet Add-on - Cloud Run Server

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware - Enable CORS for all origins
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Handle preflight requests
app.options('*', cors());

// ElevenLabs Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_3501k7vzkxnzec2vbt1pjw2nxt47';

// Main endpoint
app.post('/', async (req, res) => {
    try {
        const { question, context } = req.body;
        
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }
        
        console.log('📩 Received question:', question);
        console.log('📍 Context:', context);
        
        // Call ElevenLabs API
        const answer = await askElevenLabsAgent(question);
        
        console.log('✅ Generated answer');
        
        // Return response
        res.status(200).json({
            answer: answer,
            timestamp: new Date().toISOString(),
            agent: 'Agent Westwood'
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Ask endpoint (for training room)
app.post('/ask', async (req, res) => {
    try {
        const { question } = req.body;
        
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }
        
        console.log('📩 Received question from training room:', question);
        
        // Call ElevenLabs API
        const answer = await askElevenLabsAgent(question);
        
        console.log('✅ Generated answer');
        
        // Return response
        res.status(200).json({
            answer: answer,
            timestamp: new Date().toISOString(),
            agent: 'Agent Westwood'
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'Evenfall Advantage Meet Add-on',
        timestamp: new Date().toISOString()
    });
});

// Call ElevenLabs Conversational AI API
async function askElevenLabsAgent(question) {
    try {
        console.log('🤖 Calling ElevenLabs API...');
        console.log('Agent ID:', AGENT_ID);
        console.log('API Key (first 10 chars):', ELEVENLABS_API_KEY?.substring(0, 10));
        console.log('Question:', question);
        
        // Try multiple possible endpoints
        const endpoints = [
            `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}/conversation`,
            `https://api.elevenlabs.io/v1/convai/conversation`,
            `https://api.elevenlabs.io/v1/text-to-speech/${AGENT_ID}`
        ];
        
        let lastError = null;
        
        // Try first endpoint (most likely correct)
        try {
            const response = await axios.post(
                `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}/conversation`,
                {
                    text: question
                },
                {
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );
            
            console.log('✅ ElevenLabs Response:', JSON.stringify(response.data));
            
            const answer = response.data.text || 
                          response.data.response || 
                          response.data.message ||
                          response.data.output ||
                          response.data.answer ||
                          'I apologize, but I couldn\'t generate a response. Please try again.';
            
            return answer;
        } catch (err) {
            lastError = err;
            console.log('First endpoint failed, trying alternative...');
        }
        
        // If first fails, try with agent_id in body
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/convai/conversation`,
            {
                agent_id: AGENT_ID,
                text: question
            },
            {
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        
        console.log('✅ ElevenLabs Response (alt endpoint):', JSON.stringify(response.data));
        
        const answer = response.data.text || 
                      response.data.response || 
                      response.data.message ||
                      response.data.output ||
                      response.data.answer ||
                      'I apologize, but I couldn\'t generate a response. Please try again.';
        
        return answer;
        
    } catch (error) {
        console.error('❌ ElevenLabs API Error Details:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data));
        console.error('Message:', error.message);
        console.error('Full error:', error);
        
        // Return more detailed error for debugging
        if (error.response?.data) {
            return `Error from ElevenLabs (${error.response.status}): ${JSON.stringify(error.response.data)}. Please verify your Agent ID in the ElevenLabs dashboard.`;
        }
        return 'I\'m having trouble connecting to ElevenLabs. Please check the Cloud Run logs for details.';
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`🎓 Evenfall Advantage Meet Add-on running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
});
