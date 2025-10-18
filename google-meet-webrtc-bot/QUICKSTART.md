# Quick Start - Custom Google Meet Bot

Get your bot running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd google-meet-webrtc-bot
npm install
```

## Step 2: Test the Bot

```bash
# Create a test Google Meet
# Copy the URL
# Run:
node bot.js https://meet.google.com/your-meeting-url
```

## Step 3: Watch It Work

You'll see:
```
🎓 Evenfall Advantage - Google Meet WebRTC Bot
=============================================

🤖 Initializing Evenfall Advantage Meet Bot...
✅ Browser initialized
🚪 Joining Google Meet...
✅ Successfully joined meeting!
👂 Starting to listen for questions...

✅ Bot is active in the meeting!
```

## Step 4: Test Questions

In the meeting:
1. **Enable captions** (CC button)
2. **Ask a question:** "What is STOP THE BLEED?"
3. **Or type in chat:** "How does ICS work?"
4. **Bot will detect and respond!**

## What Works Now

✅ Bot joins Google Meet
✅ Appears as "Clunt Westwood (AI Assistant)"
✅ Monitors captions for questions
✅ Monitors chat for questions
✅ Detects question keywords
✅ Speaks responses using browser voice

## What Needs Work

⚠️ **ElevenLabs Integration** - Currently using placeholder responses
⚠️ **Voice Quality** - Using browser TTS (can upgrade to ElevenLabs)
⚠️ **Question Detection** - Basic keywords (can improve with NLP)

## Next: Fix ElevenLabs Integration

The bot framework works, but we need to connect it properly to your ElevenLabs agent.

**Options:**

1. **Use ElevenLabs Widget in Bot** - Inject the widget we tested
2. **Use ElevenLabs TTS API** - Get text, convert to speech
3. **Contact ElevenLabs** - Get proper Conversational AI API docs

**For now, the bot demonstrates the concept and can be enhanced once we solve the ElevenLabs API issue.**

## Tips

- Test in a private meeting first
- Enable captions for better question detection
- Use clear question words (what, how, why)
- Bot needs ~5 seconds to process and respond

## Stop the Bot

Press `Ctrl+C` in the terminal

---

**Ready to test?** Create a meeting and run the bot! 🚀
