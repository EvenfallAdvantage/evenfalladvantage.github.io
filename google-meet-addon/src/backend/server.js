// Evenfall Advantage Meet Add-on - Cloud Run Server

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const WebSocket = require('ws');

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
        
        // If answer is null, it means Agent Westwood shouldn't respond
        if (answer === null) {
            console.log('⏭️ Skipping response - not a direct question');
            return res.status(200).json({
                answer: null,
                shouldRespond: false,
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('✅ Generated answer');
        
        // Return response
        res.status(200).json({
            answer: answer,
            shouldRespond: true,
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

// Call ElevenLabs Conversational AI via WebSocket
async function askElevenLabsAgent(question) {
    return new Promise((resolve, reject) => {
        try {
            console.log('🤖 Connecting to ElevenLabs WebSocket...');
            console.log('Agent ID:', AGENT_ID);
            console.log('API Key exists:', !!ELEVENLABS_API_KEY);
            console.log('Question:', question);
            
            // Check if this is actually a question
            const answer = generateSecurityTrainingResponse(question);
            if (answer === null) {
                // Not a question, don't call API
                resolve(null);
                return;
            }
            
            // If no API key, use fallback responses
            if (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY === 'YOUR_API_KEY') {
                console.log('📝 Using fallback response (no API key)');
                resolve(answer);
                return;
            }
            
            // Connect to ElevenLabs WebSocket with signed URL
            const signedUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT_ID}`;
            
            console.log('🔗 Connecting to:', signedUrl);
            
            const ws = new WebSocket(signedUrl, {
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY
                }
            });
            
            let fullResponse = '';
            let timeout;
            let hasReceivedResponse = false;
            
            ws.on('open', () => {
                console.log('✅ WebSocket connected to ElevenLabs');
                
                // Send the question as text input
                const message = {
                    type: 'conversation_initiation_client_data',
                    conversation_config_override: {
                        agent: {
                            prompt: {
                                prompt: `You are Agent Westwood, a security training expert with 40+ years of experience. Answer questions about security, emergency response, STOP THE BLEED, ICS, use of force, and related topics professionally and concisely.`
                            }
                        }
                    }
                };
                
                console.log('📤 Sending initiation');
                ws.send(JSON.stringify(message));
                
                // Send the actual question
                setTimeout(() => {
                    console.log('📤 Sending question:', question);
                    ws.send(JSON.stringify({
                        type: 'user_audio_done'
                    }));
                    
                    ws.send(JSON.stringify({
                        type: 'user_transcript',
                        user_transcript: question
                    }));
                }, 500);
                
                // Set timeout for response
                timeout = setTimeout(() => {
                    console.log('⏱️ Response timeout (15s), using fallback');
                    ws.close();
                    if (!hasReceivedResponse) {
                        resolve(answer);
                    }
                }, 15000);
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log('📨 Received message type:', message.type);
                    console.log('📨 Full message:', JSON.stringify(message));
                    
                    // Handle different message types from ElevenLabs
                    if (message.type === 'agent_response') {
                        hasReceivedResponse = true;
                        fullResponse += message.agent_response || '';
                        console.log('💬 Agent response chunk:', message.agent_response);
                    }
                    
                    if (message.type === 'audio' && message.audio_transcript) {
                        hasReceivedResponse = true;
                        fullResponse += message.audio_transcript;
                        console.log('💬 Audio transcript:', message.audio_transcript);
                    }
                    
                    if (message.type === 'interruption' || message.type === 'agent_response_correction') {
                        // Handle corrections
                        console.log('🔄 Response correction');
                    }
                    
                    if (message.type === 'conversation_initiation_metadata') {
                        console.log('✅ Conversation initialized');
                    }
                    
                    // Check if conversation is done
                    if (message.type === 'ping') {
                        ws.send(JSON.stringify({ type: 'pong', event_id: message.event_id }));
                    }
                    
                } catch (err) {
                    console.error('❌ Error parsing message:', err);
                    console.error('Raw data:', data.toString());
                }
            });
            
            ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
                console.error('Full error:', error);
                clearTimeout(timeout);
                if (!hasReceivedResponse) {
                    resolve(answer);
                }
            });
            
            ws.on('close', (code, reason) => {
                console.log('🔌 WebSocket closed. Code:', code, 'Reason:', reason.toString());
                clearTimeout(timeout);
                
                if (fullResponse && hasReceivedResponse) {
                    console.log('✅ Returning ElevenLabs response:', fullResponse);
                    resolve(fullResponse);
                } else {
                    console.log('📝 No response received, using fallback');
                    resolve(answer);
                }
            });
            
        } catch (error) {
            console.error('❌ Error:', error.message);
            // Use fallback on any error
            const fallback = generateSecurityTrainingResponse(question);
            resolve(fallback);
        }
    });
}

// Generate security training responses
function generateSecurityTrainingResponse(question) {
    const q = question.toLowerCase().trim();
    
    // Check if this is actually a question or directed at Agent Westwood
    const isQuestion = q.includes('?') || 
                      q.startsWith('what') || 
                      q.startsWith('how') || 
                      q.startsWith('why') || 
                      q.startsWith('when') || 
                      q.startsWith('where') || 
                      q.startsWith('who') || 
                      q.startsWith('can you') || 
                      q.startsWith('could you') || 
                      q.startsWith('would you') || 
                      q.startsWith('explain') || 
                      q.startsWith('tell me') || 
                      q.startsWith('describe') ||
                      q.includes('agent westwood') ||
                      q.includes('westwood');
    
    // If not a question, don't respond
    if (!isQuestion) {
        return null; // Return null to indicate no response needed
    }
    
    // STOP THE BLEED
    if (q.includes('stop the bleed') || q.includes('bleeding') || q.includes('hemorrhage')) {
        return "STOP THE BLEED is a national awareness campaign and training program designed to teach bystanders how to control life-threatening bleeding. The key steps are: 1) Apply direct pressure to the wound, 2) Pack the wound with gauze if needed, 3) Apply a tourniquet if bleeding doesn't stop. Remember: You can't help if you become a victim yourself - ensure scene safety first.";
    }
    
    // ICS Structure
    if (q.includes('ics') || q.includes('incident command')) {
        return "The Incident Command System (ICS) is a standardized approach to emergency management. The five major functional areas are: Command, Operations, Planning, Logistics, and Finance/Administration. ICS provides a flexible structure that can expand or contract based on incident complexity. Key principles include unity of command, manageable span of control, and common terminology.";
    }
    
    // Use of Force
    if (q.includes('use of force') || q.includes('force continuum')) {
        return "Use of force must be objectively reasonable based on the totality of circumstances. The force continuum typically includes: Officer presence, Verbal commands, Empty-hand control, Less-lethal methods, and Lethal force. Security personnel must be able to articulate why each level of force was necessary. Always use the minimum force required to control the situation, and de-escalate when possible.";
    }
    
    // Active Shooter
    if (q.includes('active shooter') || q.includes('active threat')) {
        return "In an active shooter situation, remember RUN-HIDE-FIGHT: RUN - evacuate if possible, leave belongings behind. HIDE - if evacuation isn't possible, find a secure location, lock doors, silence phones. FIGHT - as a last resort, be aggressive and committed to your actions. Call 911 when safe. Provide first aid to injured if trained and scene is secure.";
    }
    
    // Emergency Response
    if (q.includes('emergency') || q.includes('response')) {
        return "Effective emergency response follows these priorities: 1) Life safety - protect people first, 2) Incident stabilization - prevent the situation from worsening, 3) Property conservation - protect assets when safe to do so. Always maintain situational awareness, communicate clearly, and follow your organization's emergency action plan.";
    }
    
    // Security Procedures
    if (q.includes('security') || q.includes('procedure')) {
        return "Core security procedures include: Access control - verify credentials before granting entry, Patrol protocols - maintain visible presence and document observations, Incident reporting - document all incidents thoroughly and promptly, Communication - maintain radio contact and report suspicious activity. Always follow your post orders and escalate concerns to supervisors.";
    }
    
    // Legal Requirements
    if (q.includes('legal') || q.includes('law') || q.includes('liability')) {
        return "Security personnel must understand key legal concepts: Duty of care - obligation to act reasonably to prevent harm, Negligence - failure to exercise reasonable care, Liability - legal responsibility for actions or inactions. Always document your actions, follow established procedures, and seek guidance when uncertain. Remember: you can be held personally liable for your actions.";
    }
    
    // Training/General
    return "I'm Agent Westwood, your AI training assistant with 40+ years of security experience. I can help with topics like STOP THE BLEED, ICS structure, use of force, active shooter response, emergency procedures, security protocols, and legal requirements. What specific topic would you like to learn about?";
}

// Start server
app.listen(PORT, () => {
    console.log(`🎓 Evenfall Advantage Meet Add-on running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`🔑 ElevenLabs API configured: ${!!ELEVENLABS_API_KEY}`);
    console.log(`🤖 Agent ID: ${AGENT_ID}`);
});
