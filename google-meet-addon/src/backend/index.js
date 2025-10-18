// Evenfall Advantage Meet Add-on - Backend Cloud Function

const functions = require('@google-cloud/functions-framework');
const axios = require('axios');
const cors = require('cors');

// CORS middleware
const corsMiddleware = cors({ origin: true });

// ElevenLabs Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_3501k7vzkxnzec2vbt1pjw2nxt47';

// Main Cloud Function
functions.http('evenfallMeetAddon', async (req, res) => {
    // Handle CORS
    corsMiddleware(req, res, async () => {
        // Only accept POST requests
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        
        try {
            const { question, context } = req.body;
            
            if (!question) {
                res.status(400).json({ error: 'Question is required' });
                return;
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
                timeout: 30000 // 30 second timeout
            }
        );
        
        // Extract answer from response
        const answer = response.data.text || 
                      response.data.response || 
                      response.data.message ||
                      'I apologize, but I couldn\'t generate a response. Please try again.';
        
        return answer;
        
    } catch (error) {
        console.error('❌ ElevenLabs API Error:', error.response?.data || error.message);
        
        // Return fallback response
        return 'I\'m having trouble connecting right now. This could be a temporary issue with the AI service. Please try asking your question again in a moment.';
    }
}

// Health check endpoint
functions.http('health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'Evenfall Advantage Meet Add-on',
        timestamp: new Date().toISOString()
    });
});
