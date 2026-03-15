# FREE AI Question Generator Setup

Generate assessment questions automatically using **100% FREE** AI services!

## 🎉 Free Options

### Option 1: Google Gemini (RECOMMENDED - Completely Free!)

**Limits**: 60 requests/minute (more than enough!)

**Setup**:
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key
5. Open `admin/js/ai-question-generator-free.js`
6. Replace `YOUR_GEMINI_API_KEY` with your key (line 7)
7. Make sure `USE_GEMINI = true` (line 10)

**Cost**: $0 forever! ✨

---

### Option 2: Hugging Face (Free Tier)

**Limits**: 30,000 characters/month

**Setup**:
1. Go to https://huggingface.co/settings/tokens
2. Create free account
3. Click "New token" → "Read" access
4. Copy the token
5. Open `admin/js/ai-question-generator-free.js`
6. Replace `YOUR_HF_API_KEY` with your token (line 4)
7. Set `USE_GEMINI = false` (line 10)

**Cost**: $0/month (free tier)

---

### Option 3: Local Fallback (NO API NEEDED!)

If both APIs fail, the system automatically falls back to a template-based generator that works offline!

**Features**:
- No API key needed
- Works offline
- Generates basic questions from slide content
- Good for testing/development

---

## Quick Setup (5 minutes)

1. **Create Database Table**
   ```sql
   -- Run in Supabase SQL Editor
   -- File: CREATE_ASSESSMENT_QUESTIONS_TABLE.sql
   ```

2. **Get FREE Gemini API Key**
   - Visit: https://makersuite.google.com/app/apikey
   - Click "Create API Key"
   - Copy it

3. **Configure**
   - Open: `admin/js/ai-question-generator-free.js`
   - Line 7: Paste your Gemini API key
   - Save file

4. **Test**
   - Create a module with slides
   - Questions auto-generate!

---

## How It Works

1. **Extracts** text from all slides
2. **Sends** to FREE AI (Gemini or Hugging Face)
3. **Generates** 10 multiple-choice questions
4. **Saves** to database
5. **Fallback** to local generation if AI fails

---

## Comparison

| Feature | Google Gemini | Hugging Face | Local Fallback |
|---------|---------------|--------------|----------------|
| Cost | FREE | FREE | FREE |
| Quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Speed | Fast | Medium | Instant |
| Limit | 60/min | 30K chars/mo | Unlimited |
| Setup | 2 min | 3 min | 0 min |

---

## Question Quality

**AI-Generated (Gemini/HF)**:
- Tests understanding
- Mix of difficulty levels
- Practical application
- Clear explanations
- Context-aware

**Local Fallback**:
- Basic comprehension
- Template-based
- Good for testing
- Can be manually improved

---

## Troubleshooting

### "Gemini API error: 400"
- Check API key is correct
- Ensure you copied the full key
- Try regenerating the key

### "Rate limit exceeded"
- Gemini: Wait 1 minute (60 requests/min limit)
- Hugging Face: Wait until next month or upgrade

### Questions are generic
- Add more detailed content to slides
- Use slide notes for additional context
- AI needs good content to generate good questions!

### No API key? No problem!
- System automatically uses local fallback
- Questions will be simpler but functional
- Perfect for development/testing

---

## Cost Breakdown

| Service | Monthly Cost | Annual Cost |
|---------|--------------|-------------|
| Google Gemini | $0 | $0 |
| Hugging Face | $0 | $0 |
| Local Fallback | $0 | $0 |
| **TOTAL** | **$0** | **$0** |

Compare to OpenAI GPT-4: ~$30-100/month

---

## Tips for Best Results

1. **Write detailed slide content** - More context = better questions
2. **Use slide notes** - Add instructor notes for AI to reference
3. **Review generated questions** - Edit in Supabase if needed
4. **Test with students** - Improve based on feedback

---

## Next Steps

1. ✅ Run `CREATE_ASSESSMENT_QUESTIONS_TABLE.sql`
2. ✅ Get free Gemini API key
3. ✅ Update `ai-question-generator-free.js`
4. ✅ Create a test module
5. ✅ Watch questions generate automatically!

**Questions? Issues? Check the console for detailed logs!**
