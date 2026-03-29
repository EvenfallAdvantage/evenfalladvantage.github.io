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
        
        
    }

    async login() {
        if (!GOOGLE_EMAIL || !GOOGLE_PASSWORD) {
            
            return;
        }

        
        
        try {
            await this.page.goto('https://accounts.google.com', { waitUntil: 'networkidle2' });
            
            // Enter email
            await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
            await this.page.type('input[type="email"]', GOOGLE_EMAIL, { delay: 100 });
            await this.page.keyboard.press('Enter');

                        // Wait and enter password
                        await this.page.waitForSelector('input[type="password"]', { timeout: 2000 });
            await this.page.waitForSelector('input[type="password"]', { timeout: 10000 });
            await this.page.type('input[type="password"]', GOOGLE_PASSWORD, { delay: 100 });
            await this.page.keyboard.press('Enter');
            
            await this.page.waitForSelector('.join-button', { timeout: 3000 });
            
            
        } catch (error) {
            
        }
    }

    async joinMeeting() {
        
        
        try {
            await this.page.goto(this.meetingUrl, { 
                waitUntil: 'networkidle2',
                timeout: 60000 
                            });

                            await this.page.waitForSelector('[class*="audio"], [class*="video"], .join-button', { timeout: 5000 });
            
            
            
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

                                                break;
                                            }
                                        }
                                    } catch (e) {

                                    }

                                    await this.page.waitForSelector('[class*="media"], .camera-button, .mic-button', { timeout: 2000 });
            
            // Turn off camera and microphone initially
            
            await this.toggleMediaDevices();

                        await this.page.waitForSelector('.join-button, [role="button"]', { timeout: 2000 });

                        // Click join button
            
            await this.clickJoinButton();

                        await this.page.waitForSelector('[class*="caption"], [class*="chat"], .in-meeting', { timeout: 5000 });


                        // Start listening for captions/questions
            this.startListening();
            
        } catch (error) {
            
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

                                        await this.page.waitForSelector('[class*="camera"], [class*="video"]', { timeout: 500 });
                    }
                }
                
                // Keep microphone on for speaking
                                if (label.includes('microphone') || label.includes('mic')) {
                                    if (label.includes('off')) {
                                        await button.click();

                                        await this.page.waitForSelector('[class*="microphone"], [class*="mic"]', { timeout: 500 });
                    }
                }
            }
        } catch (error) {
            
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
                    
                    return;
                }
            }
            
            
        } catch (error) {
            
        }
    }

    startListening() {
        
        this.isListening = true;
        
        // Monitor captions for questions
        this.monitorCaptions();
        
        // Monitor chat for questions
        this.monitorChat();
    }

    async monitorCaptions() {
        
        
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
        
        
        
        // Get response from ElevenLabs
        const response = await this.getAIResponse(question);
        
        if (response) {
            // Speak the response
            await this.speakResponse(response);
        }
    }

    async getAIResponse(question) {
        try {
            
            
            // Use ElevenLabs widget endpoint (since direct API doesn't work)
            // For now, return a placeholder
            // In production, you'd integrate with the working widget or use a different approach
            
            return `Based on my 40 years of security experience, here's what I can tell you about that: [Response would come from ElevenLabs agent here]`;
            
        } catch (error) {
            
            return null;
        }
    }

    async speakResponse(text) {
        try {
            
            
            // Use browser's speech synthesis
            await this.page.evaluate((text) => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                window.speechSynthesis.speak(utterance);
            }, text);
            
            
            
        } catch (error) {
            
        }
    }

    async leaveMeeting() {
        
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
        
        
        process.exit(1);
    }
    
    
    
    
    const bot = new GoogleMeetBot(meetingUrl);
    
    try {
        await bot.initialize();
        await bot.login();
        await bot.joinMeeting();
        
        
        
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            
            await bot.leaveMeeting();
            process.exit(0);
        });
        
    } catch (error) {
        
        await bot.leaveMeeting();
        process.exit(1);
    }
}

// Run the bot
if (require.main === module) {
    main();
}

module.exports = GoogleMeetBot;
