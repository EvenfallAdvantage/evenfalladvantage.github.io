# Evenfall Advantage - Google Meet AI Bot

This bot integrates your ElevenLabs AI agent (Clunt Westwood) into Google Meet sessions.

## Features

- 🤖 Automatically joins Google Meet sessions
- 💬 Monitors chat for student questions
- 🎯 Responds using your ElevenLabs AI agent
- 📚 Has full knowledge of all 8 training modules
- 🔒 Secure API key management

## Setup

### 1. Install Dependencies

```bash
cd google-meet-bot
npm install
```

### 2. Configure API Key

Make sure your `.env` file in the parent directory has:

```
ELEVENLABS_API_KEY=your_actual_key_here
ELEVENLABS_AGENT_ID=agent_3501k7vzkxnzec2vbt1pjw2nxt47
```

### 3. Run the Bot

```bash
node index.js https://meet.google.com/your-meeting-code
```

Or with npm:

```bash
npm start https://meet.google.com/your-meeting-code
```

## How It Works

1. **Bot joins meeting** as "Clunt Westwood (AI Assistant)"
2. **Monitors chat** for questions from students
3. **Sends questions** to your ElevenLabs agent
4. **Posts responses** back to the chat
5. **Stays active** throughout the session

## Usage During Training

### Starting the Bot

1. Create your Google Meet session
2. Copy the meeting URL
3. Run: `node index.js <meeting-url>`
4. Bot will join automatically

### During the Session

- Students ask questions in the chat
- Bot responds with Clunt Westwood's expertise
- Instructor can focus on teaching while bot handles Q&A
- Bot has knowledge of all 8 modules

### Stopping the Bot

Press `Ctrl+C` to gracefully shut down the bot

## Customization

### Change Bot Name

Edit `index.js` line 47:
```javascript
await nameInput.type('Your Custom Name');
```

### Adjust Response Time

Edit `index.js` line 74 (monitoring interval):
```javascript
setInterval(async () => {
  // Check every 2 seconds (2000ms)
}, 2000);
```

### Enable Headless Mode

For production, edit `index.js` line 19:
```javascript
headless: true, // Bot runs invisibly
```

## Troubleshooting

### Bot Can't Join Meeting

- Make sure meeting URL is correct
- Check if meeting requires approval to join
- Verify Google account permissions

### Bot Not Responding

- Check API key is correct in `.env`
- Verify ElevenLabs agent ID is correct
- Check console for error messages

### Chat Not Working

- Make sure chat is open in the meeting
- Check if bot has permission to send messages
- Try manually opening chat panel

## Important Notes

⚠️ **Google Meet Limitations:**
- Bot appears as a participant (counts toward limit)
- May require approval to join meeting
- Chat monitoring depends on Google Meet's interface

⚠️ **API Costs:**
- Each question/response uses ElevenLabs API credits
- Monitor your usage in ElevenLabs dashboard

⚠️ **Best Practices:**
- Test bot before live training sessions
- Have backup plan if bot fails
- Monitor bot activity during sessions
- Keep API key secure

## Alternative: Manual Mode

If automated bot has issues, you can run in "manual mode":

1. Open ElevenLabs widget in browser
2. Share screen showing the widget
3. Students ask questions in chat
4. You copy/paste to widget
5. Copy/paste responses back

## Support

For issues or questions:
- Check ElevenLabs API documentation
- Review console error messages
- Test with a private meeting first

---

**Evenfall Advantage LLC**  
Raising the standard for safety and readiness
