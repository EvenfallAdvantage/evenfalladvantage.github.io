# Evenfall Advantage - Custom Google Meet WebRTC Bot

A custom bot that joins Google Meet, listens for questions, and responds using your ElevenLabs AI agent.

## Features

- 🤖 Joins Google Meet automatically as "Clunt Westwood (AI Assistant)"
- 👂 Listens to captions and chat for questions
- 🗣️ Responds with voice using browser speech synthesis
- 🎯 Integrates with your ElevenLabs agent
- 📊 Real-time question detection

## Setup

### 1. Install Dependencies

```bash
cd google-meet-webrtc-bot
npm install
```

### 2. Configure Environment Variables

Add to your `.env` file in the parent directory:

```
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_AGENT_ID=agent_3501k7vzkxnzec2vbt1pjw2nxt47
GOOGLE_EMAIL=your_email@gmail.com (optional)
GOOGLE_PASSWORD=your_password (optional)
```

**Note:** Google credentials are optional. If not provided, you'll need to manually approve the bot in the meeting.

### 3. Run the Bot

```bash
node bot.js https://meet.google.com/your-meeting-code
```

## How It Works

1. **Launches Browser:** Opens Chrome with special flags to allow media access
2. **Joins Meeting:** Navigates to the meeting URL and joins as "Clunt Westwood"
3. **Listens:** Monitors captions and chat for questions
4. **Detects Questions:** Uses keyword detection (what, how, why, etc.)
5. **Responds:** Gets answer from ElevenLabs and speaks it in the meeting

## Question Detection

The bot detects questions by looking for:
- Question words: what, how, why, when, where, who, can, is, are
- Question marks (?)
- Messages in chat
- Spoken words in captions (if enabled)

## Current Limitations

1. **ElevenLabs API:** The direct API integration is still being worked on. Currently uses placeholder responses.
2. **Voice Quality:** Uses browser's built-in speech synthesis. Can be upgraded to use ElevenLabs TTS.
3. **Question Detection:** Basic keyword matching. Can be improved with NLP.
4. **Manual Approval:** May need to manually approve bot entry to meeting.

## Improvements Needed

### Priority 1: Fix ElevenLabs Integration

The bot needs to properly integrate with your ElevenLabs Conversational AI agent. Options:

1. **Use the widget programmatically** - Inject the widget into the page
2. **Use ElevenLabs TTS API** - Get text response, convert to speech
3. **Use WebSocket connection** - If ElevenLabs supports it
4. **Contact ElevenLabs support** - Get proper API documentation

### Priority 2: Better Voice

Replace browser speech synthesis with:
- ElevenLabs Text-to-Speech API
- Higher quality voice
- Clunt Westwood's actual voice

### Priority 3: Smarter Question Detection

Upgrade from keyword matching to:
- Natural Language Processing (NLP)
- Context awareness
- Multi-turn conversations

## Usage in Training

### Starting the Bot

```bash
# 1. Create your Google Meet
# 2. Copy the meeting URL
# 3. Run the bot
node bot.js https://meet.google.com/abc-defg-hij
```

### During Training

- Bot joins as "Clunt Westwood (AI Assistant)"
- Students can ask questions verbally or in chat
- Bot detects questions and responds
- You can focus on teaching while bot handles Q&A

### Stopping the Bot

Press `Ctrl+C` to gracefully shut down

## Troubleshooting

### Bot Can't Join Meeting

- Check meeting URL is correct
- Ensure meeting allows guests
- Try providing Google credentials in `.env`

### Bot Doesn't Respond

- Check console for errors
- Verify question contains trigger words
- Enable captions in Google Meet
- Check ElevenLabs API key is valid

### Audio Not Working

- Check microphone permissions
- Verify browser has audio access
- Test with `--use-fake-device-for-media-stream` flag

## Next Steps

1. **Test the bot** in a private meeting
2. **Fix ElevenLabs integration** (see Priority 1 above)
3. **Improve voice quality** with ElevenLabs TTS
4. **Enhance question detection** with better NLP
5. **Add conversation memory** for context-aware responses

## Security Notes

⚠️ **Important:**
- Never commit `.env` file with credentials
- Use app-specific passwords for Google account
- Consider using service account for production
- Review Google's automation policies

## Support

For issues:
- Check browser console for errors
- Review bot console output
- Verify all dependencies are installed
- Test with a simple meeting first

---

**Status:** 🚧 In Development

The bot framework is complete, but ElevenLabs integration needs work. The bot can join meetings and detect questions, but responses are currently placeholders.

**Next:** Fix the ElevenLabs API integration to get real responses from Clunt Westwood.
