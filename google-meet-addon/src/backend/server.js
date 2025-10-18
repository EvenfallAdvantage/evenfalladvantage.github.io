// Evenfall Advantage Meet Add-on - Cloud Run Server

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

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
            agent: 'Clunt Westwood'
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
        
        const answer = response.data.text || 
                      response.data.response || 
                      response.data.message ||
                      'I apologize, but I couldn\'t generate a response. Please try again.';
        
        return answer;
        
    } catch (error) {
        console.error('❌ ElevenLabs API Error:', error.response?.data || error.message);
        return 'I\'m having trouble connecting right now. Please try again in a moment.';
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`🎓 Evenfall Advantage Meet Add-on running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
});
