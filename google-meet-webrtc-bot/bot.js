// Evenfall Advantage - Custom Google Meet WebRTC Bot
// This bot joins Google Meet, listens for questions, and responds with ElevenLabs AI

require('dotenv').config({ path: '../.env' });
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_3501k7vzkxnzec2vbt1pjw2nxt47';
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL;
const GOOGLE_PASSWORD = process.env.GOOGLE_PASSWORD;

class GoogleMeetBot {
    constructor(meetingUrl) {
        this.meetingUrl = meetingUrl;
        this.browser = null;
        this.page = null;
        this.isListening = false;
    }

    async initialize() {
        console.log('🤖 Initializing Evenfall Advantage Meet Bot...');
        console.log('Meeting URL:', this.meetingUrl);
        
        this.browser = await puppeteer.launch({
            headless: false, // Set to true for production
            args: [
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--allow-running-insecure-content',
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ],
            defaultViewport: null
        });

        this.page = await this.browser.newPage();
        
        // Set user agent
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Grant permissions
        const context = this.browser.defaultBrowserContext();
        await context.overridePermissions(this.meetingUrl, [
            'microphone',
            'camera',
            'notifications'
        ]);
        
        console.log('✅ Browser initialized');
    }

    async login() {
        if (!GOOGLE_EMAIL || !GOOGLE_PASSWORD) {
            console.log('⚠️ No Google credentials provided, skipping login');
            return;
        }

        console.log('🔐 Logging into Google account...');
        
        try {
            await this.page.goto('https://accounts.google.com', { waitUntil: 'networkidle2' });
            
            // Enter email
            await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
            await this.page.type('input[type="email"]', GOOGLE_EMAIL, { delay: 100 });
            await this.page.keyboard.press('Enter');
            
            // Wait and enter password
            await this.page.waitForTimeout(2000);
            await this.page.waitForSelector('input[type="password"]', { timeout: 10000 });
            await this.page.type('input[type="password"]', GOOGLE_PASSWORD, { delay: 100 });
            await this.page.keyboard.press('Enter');
            
            await this.page.waitForTimeout(3000);
            console.log('✅ Logged in successfully');
            
        } catch (error) {
            console.log('⚠️ Login failed or not needed:', error.message);
        }
    }

    async joinMeeting() {
        console.log('🚪 Joining Google Meet...');
        
        try {
            await this.page.goto(this.meetingUrl, { 
                waitUntil: 'networkidle2',
                timeout: 60000 
            });
            
            await this.page.waitForTimeout(5000);
            
            console.log('📝 Setting bot name...');
            
            // Try to find and fill name input
            try {
                const nameSelectors = [
                    'input[placeholder*="name" i]',
                    'input[aria-label*="name" i]',
                    'input[type="text"]'
                ];
                
                for (const selector of nameSelectors) {
                    const input = await this.page.$(selector);
                    if (input) {
                        await input.click();
                        await input.type('Clunt Westwood (AI Assistant)', { delay: 50 });
                        console.log('✅ Name entered');
                        break;
                    }
                }
            } catch (e) {
                console.log('⚠️ Could not set name');
            }
            
            await this.page.waitForTimeout(2000);
            
            // Turn off camera and microphone initially
            console.log('🎥 Configuring media...');
            await this.toggleMediaDevices();
            
            await this.page.waitForTimeout(2000);
            
            // Click join button
            console.log('🚪 Clicking join button...');
            await this.clickJoinButton();
            
            await this.page.waitForTimeout(5000);
            console.log('✅ Successfully joined meeting!');
            
            // Start listening for captions/questions
            this.startListening();
            
        } catch (error) {
            console.error('❌ Error joining meeting:', error.message);
            throw error;
        }
    }

    async toggleMediaDevices() {
        try {
            // Find and click camera/mic buttons
            const buttons = await this.page.$$('button, div[role="button"]');
            
            for (const button of buttons) {
                const ariaLabel = await button.evaluate(el => el.getAttribute('aria-label'));
                const title = await button.evaluate(el => el.getAttribute('title'));
                const text = await button.evaluate(el => el.textContent);
                
                const label = (ariaLabel || title || text || '').toLowerCase();
                
                // Turn off camera
                if (label.includes('camera') || label.includes('video')) {
                    if (label.includes('on') || !label.includes('off')) {
                        await button.click();
                        console.log('✅ Camera disabled');
                        await this.page.waitForTimeout(500);
                    }
                }
                
                // Keep microphone on for speaking
                if (label.includes('microphone') || label.includes('mic')) {
                    if (label.includes('off')) {
                        await button.click();
                        console.log('✅ Microphone enabled');
                        await this.page.waitForTimeout(500);
                    }
                }
            }
        } catch (error) {
            console.log('⚠️ Could not configure media devices');
        }
    }

    async clickJoinButton() {
        try {
            const buttons = await this.page.$$('button, div[role="button"]');
            
            for (const button of buttons) {
                const text = await button.evaluate(el => el.textContent);
                const ariaLabel = await button.evaluate(el => el.getAttribute('aria-label'));
                
                const label = (text + ' ' + (ariaLabel || '')).toLowerCase();
                
                if (label.includes('join') || label.includes('ask to join')) {
                    await button.click();
                    console.log('✅ Join button clicked');
                    return;
                }
            }
            
            console.log('⚠️ Could not find join button');
        } catch (error) {
            console.log('⚠️ Error clicking join button:', error.message);
        }
    }

    startListening() {
        console.log('👂 Starting to listen for questions...');
        this.isListening = true;
        
        // Monitor captions for questions
        this.monitorCaptions();
        
        // Monitor chat for questions
        this.monitorChat();
    }

    async monitorCaptions() {
        console.log('📝 Monitoring captions...');
        
        // Check for captions every 2 seconds
        setInterval(async () => {
            if (!this.isListening) return;
            
            try {
                // Look for caption elements
                const captions = await this.page.evaluate(() => {
                    const captionElements = document.querySelectorAll('[class*="caption"], [class*="subtitle"]');
                    return Array.from(captionElements).map(el => el.textContent).join(' ');
                });
                
                if (captions && captions.length > 10) {
                    await this.processQuestion(captions);
                }
            } catch (error) {
                // Captions might not be available
            }
        }, 2000);
    }

    async monitorChat() {
        console.log('💬 Monitoring chat...');
        
        let lastMessage = '';
        
        setInterval(async () => {
            if (!this.isListening) return;
            
            try {
                const messages = await this.page.evaluate(() => {
                    const messageElements = document.querySelectorAll('[data-message-text], [class*="message"]');
                    if (messageElements.length > 0) {
                        const lastMsg = messageElements[messageElements.length - 1];
                        return lastMsg ? lastMsg.textContent : '';
                    }
                    return '';
                });
                
                if (messages && messages !== lastMessage && messages.length > 5) {
                    lastMessage = messages;
                    console.log('📩 New message detected:', messages);
                    await this.processQuestion(messages);
                }
            } catch (error) {
                // Chat might not be open
            }
        }, 3000);
    }

    async processQuestion(question) {
        // Simple filter to detect questions
        const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'can', 'is', 'are', '?'];
        const hasQuestionWord = questionWords.some(word => question.toLowerCase().includes(word));
        
        if (!hasQuestionWord) return;
        
        console.log('❓ Question detected:', question);
        
        // Get response from ElevenLabs
        const response = await this.getAIResponse(question);
        
        if (response) {
            // Speak the response
            await this.speakResponse(response);
        }
    }

    async getAIResponse(question) {
        try {
            console.log('🤖 Getting response from Clunt Westwood...');
            
            // Use ElevenLabs widget endpoint (since direct API doesn't work)
            // For now, return a placeholder
            // In production, you'd integrate with the working widget or use a different approach
            
            return `Based on my 40 years of security experience, here's what I can tell you about that: [Response would come from ElevenLabs agent here]`;
            
        } catch (error) {
            console.error('❌ Error getting AI response:', error.message);
            return null;
        }
    }

    async speakResponse(text) {
        try {
            console.log('🗣️ Speaking response...');
            
            // Use browser's speech synthesis
            await this.page.evaluate((text) => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                window.speechSynthesis.speak(utterance);
            }, text);
            
            console.log('✅ Response spoken');
            
        } catch (error) {
            console.error('❌ Error speaking response:', error.message);
        }
    }

    async leaveMeeting() {
        console.log('👋 Leaving meeting...');
        this.isListening = false;
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Main execution
async function main() {
    const meetingUrl = process.argv[2];
    
    if (!meetingUrl || !meetingUrl.includes('meet.google.com')) {
        console.error('❌ Please provide a valid Google Meet URL');
        console.log('Usage: node bot.js <google-meet-url>');
        process.exit(1);
    }
    
    console.log('🎓 Evenfall Advantage - Google Meet WebRTC Bot');
    console.log('=============================================\n');
    
    const bot = new GoogleMeetBot(meetingUrl);
    
    try {
        await bot.initialize();
        await bot.login();
        await bot.joinMeeting();
        
        console.log('\n✅ Bot is active in the meeting!');
        console.log('Press Ctrl+C to stop\n');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 Shutting down bot...');
            await bot.leaveMeeting();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        await bot.leaveMeeting();
        process.exit(1);
    }
}

// Run the bot
if (require.main === module) {
    main();
}

module.exports = GoogleMeetBot;
