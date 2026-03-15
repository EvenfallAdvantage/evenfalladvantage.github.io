require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const puppeteer = require('puppeteer');

// ElevenLabs Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

// Google Meet Bot
class GoogleMeetBot {
  constructor(meetingUrl) {
    this.meetingUrl = meetingUrl;
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    console.log('🤖 Initializing Evenfall Advantage AI Bot...');
    
    // Launch browser
    this.browser = await puppeteer.launch({
      headless: false, // Set to true for production
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-web-security'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Set user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log('✅ Browser initialized');
  }

  async joinMeeting() {
    console.log('🔗 Joining Google Meet...');
    
    try {
      // Navigate to meeting
      await this.page.goto(this.meetingUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for page to load
      await this.page.waitForTimeout(5000);
      
      console.log('📝 Entering bot name...');
      
      // Try multiple selectors for name input
      try {
        await this.page.waitForSelector('input[type="text"]', { timeout: 10000 });
        const nameInputs = await this.page.$$('input[type="text"]');
        if (nameInputs.length > 0) {
          await nameInputs[0].click();
          await nameInputs[0].type('Clunt Westwood (AI Assistant)', { delay: 100 });
          console.log('✅ Name entered');
        }
      } catch (e) {
        console.log('⚠️ Could not find name input, continuing...');
      }
      
      // Wait a bit
      await this.page.waitForTimeout(2000);
      
      // Try to turn off camera and mic
      console.log('🎥 Disabling camera and microphone...');
      try {
        // Click camera button
        const buttons = await this.page.$$('button');
        for (const button of buttons) {
          const ariaLabel = await button.evaluate(el => el.getAttribute('aria-label'));
          if (ariaLabel && (ariaLabel.includes('camera') || ariaLabel.includes('Camera'))) {
            await button.click();
            console.log('✅ Camera disabled');
            break;
          }
        }
        
        // Click microphone button
        for (const button of buttons) {
          const ariaLabel = await button.evaluate(el => el.getAttribute('aria-label'));
          if (ariaLabel && (ariaLabel.includes('microphone') || ariaLabel.includes('Microphone'))) {
            await button.click();
            console.log('✅ Microphone disabled');
            break;
          }
        }
      } catch (e) {
        console.log('⚠️ Could not disable camera/mic, continuing...');
      }
      
      await this.page.waitForTimeout(2000);
      
      // Click join/ask to join button
      console.log('🚪 Attempting to join meeting...');
      try {
        const buttons = await this.page.$$('button');
        for (const button of buttons) {
          const text = await button.evaluate(el => el.textContent);
          const ariaLabel = await button.evaluate(el => el.getAttribute('aria-label'));
          
          if ((text && (text.includes('Join') || text.includes('Ask to join'))) ||
              (ariaLabel && (ariaLabel.includes('Join') || ariaLabel.includes('Ask to join')))) {
            await button.click();
            console.log('✅ Join button clicked');
            break;
          }
        }
      } catch (e) {
        console.log('⚠️ Could not find join button:', e.message);
      }
      
      // Wait for meeting to load
      await this.page.waitForTimeout(5000);
      console.log('✅ Bot should now be in the meeting');
      
      // Start monitoring chat
      this.monitorChat();
      
    } catch (error) {
      console.error('❌ Error joining meeting:', error.message);
      console.log('⚠️ Bot will continue running - you may need to manually approve it in the meeting');
    }
  }

  async monitorChat() {
    console.log('👀 Monitoring chat for questions...');
    
    // Monitor chat messages
    setInterval(async () => {
      try {
        const messages = await this.page.evaluate(() => {
          const chatMessages = document.querySelectorAll('[data-message-text]');
          return Array.from(chatMessages).map(msg => msg.textContent);
        });
        
        // Check for new messages
        if (messages.length > 0) {
          const latestMessage = messages[messages.length - 1];
          await this.processMessage(latestMessage);
        }
      } catch (error) {
        // Chat might not be open yet
      }
    }, 2000);
  }

  async processMessage(message) {
    console.log('📩 Received message:', message);
    
    // Call ElevenLabs API
    const response = await this.callElevenLabsAgent(message);
    
    if (response) {
      await this.sendChatMessage(response);
    }
  }

  async callElevenLabsAgent(message) {
    try {
      console.log('🤖 Asking Clunt Westwood...');
      
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/convai/conversation`,
        {
          agent_id: AGENT_ID,
          text: message
        },
        {
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Got response from AI');
      return response.data.text || response.data.response;
      
    } catch (error) {
      console.error('❌ Error calling ElevenLabs:', error.message);
      return null;
    }
  }

  async sendChatMessage(message) {
    try {
      console.log('💬 Sending response to chat...');
      
      // Find chat input
      const chatInput = await this.page.$('input[placeholder*="message" i], textarea[placeholder*="message" i]');
      
      if (chatInput) {
        await chatInput.type(message);
        await this.page.keyboard.press('Enter');
        console.log('✅ Message sent');
      }
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
    }
  }

  async leaveMeeting() {
    console.log('👋 Leaving meeting...');
    await this.browser.close();
  }
}

// Main execution
async function main() {
  // Get meeting URL from command line or use default
  const meetingUrl = process.argv[2] || 'YOUR_GOOGLE_MEET_URL_HERE';
  
  if (meetingUrl === 'YOUR_GOOGLE_MEET_URL_HERE') {
    console.error('❌ Please provide a Google Meet URL');
    console.log('Usage: node index.js <google-meet-url>');
    process.exit(1);
  }
  
  console.log('🎓 Evenfall Advantage - Google Meet AI Bot');
  console.log('==========================================\n');
  
  const bot = new GoogleMeetBot(meetingUrl);
  
  try {
    await bot.initialize();
    await bot.joinMeeting();
    
    // Keep bot running
    console.log('\n✅ Bot is now active in the meeting');
    console.log('Press Ctrl+C to stop the bot\n');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down bot...');
      await bot.leaveMeeting();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the bot
main();
