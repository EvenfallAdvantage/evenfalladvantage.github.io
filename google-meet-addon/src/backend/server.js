// Evenfall Advantage Meet Add-on - Cloud Run Server

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const OpenAI = require('openai');

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

// API Keys
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'YOUR_API_KEY';
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_3501k7vzkxnzec2vbt1pjw2nxt47';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize OpenAI
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

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

// Call AI Agent (OpenAI GPT-4 with fallback)
async function askElevenLabsAgent(question) {
    try {
        console.log('🤖 Processing question...');
        console.log('Question:', question);
        
        // Check if this is actually a question
        const fallbackAnswer = generateSecurityTrainingResponse(question);
        if (fallbackAnswer === null) {
            // Not a question, don't respond
            return null;
        }
        
        // Try OpenAI GPT-4 if configured
        if (openai) {
            try {
                console.log('🤖 Calling OpenAI GPT-4 as Agent Westwood...');
                
                const completion = await openai.chat.completions.create({
                    model: "gpt-4",
                    messages: [
                        {
                            role: "system",
                            content: `You are Agent Westwood, a highly experienced security training expert with over 40 years of experience in law enforcement, emergency response, and security operations. 

Your expertise includes:
- STOP THE BLEED and emergency medical response
- Incident Command System (ICS) and NIMS
- Use of force and legal requirements
- Active shooter and active threat response
- Security procedures and protocols
- Emergency response planning
- Trespassing and unauthorized access handling
- Workplace violence prevention
- Festival and venue security

Provide professional, concise, and practical answers. Keep responses under 150 words. Use your experience to give actionable advice. Be authoritative but approachable.`
                        },
                        {
                            role: "user",
                            content: question
                        }
                    ],
                    max_tokens: 300,
                    temperature: 0.7
                });
                
                const aiResponse = completion.choices[0].message.content;
                console.log('✅ Got OpenAI response');
                return aiResponse;
                
            } catch (openaiError) {
                console.error('❌ OpenAI error:', openaiError.message);
                console.log('📝 Falling back to pre-programmed responses');
                return fallbackAnswer;
            }
        }
        
        // No OpenAI, use fallback
        console.log('💡 Using Agent Westwood knowledge base (no OpenAI key)');
        return fallbackAnswer;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        const fallback = generateSecurityTrainingResponse(question);
        return fallback;
    }
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
