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
        console.log('API Key exists:', !!ELEVENLABS_API_KEY);
        console.log('Question:', question);
        
        // ElevenLabs Conversational AI endpoint
        // Documentation: https://elevenlabs.io/docs/conversational-ai/api-reference
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/convai/conversation`,
            {
                agent_id: AGENT_ID,
                text: question,
                mode: "text-only"  // We only want text response, not audio
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
        
        // Extract the text response from the API
        const answer = response.data.text || 
                      response.data.response || 
                      response.data.message ||
                      response.data.output ||
                      response.data.answer ||
                      JSON.stringify(response.data);
        
        return answer;
        
    } catch (error) {
        console.error('❌ ElevenLabs API Error Details:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data));
        console.error('Message:', error.message);
        
        // Fallback response if ElevenLabs isn't configured
        if (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY === 'YOUR_API_KEY') {
            return "Hello! I'm Agent Westwood, your AI training assistant. I'm currently running in demo mode. To enable full AI responses, please configure your ElevenLabs API key in the Cloud Run environment variables.";
        }
        
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
