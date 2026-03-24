# AI Question Generator Setup

This system automatically generates assessment questions from module slide content using OpenAI's GPT-4 API.

## Setup Instructions

### 1. Create OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the API key (starts with `sk-`)
5. **Important**: Save this key securely - you won't be able to see it again!

### 2. Configure the API Key

**Option A: Environment Variable (Recommended for Security)**
1. Create a `.env` file in the root directory
2. Add: `OPENAI_API_KEY=your_api_key_here`
3. Update `ai-question-generator.js` to read from environment

**Option B: Direct Configuration (Quick Setup)**
1. Open `admin/js/ai-question-generator.js`
2. Find line: `const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY';`
3. Replace `YOUR_OPENAI_API_KEY` with your actual API key
4. **Warning**: Don't commit this file to public repositories!

### 3. Create Database Table

1. Open Supabase SQL Editor
2. Run the script: `CREATE_ASSESSMENT_QUESTIONS_TABLE.sql`
3. Verify the table was created successfully

### 4. Test the System

1. Go to Admin Dashboard → Courses
2. Create a new module with slides
3. The system will automatically:
   - Create the module
   - Save the slides
   - Create an assessment
   - Generate 10 AI questions from the slide content
4. Check the console for success messages

## How It Works

1. **Content Extraction**: Extracts text from all slides (title, content, notes)
2. **AI Generation**: Sends content to GPT-4 with specific instructions
3. **Question Creation**: Generates 10 multiple-choice questions with:
   - 4 options each
   - Correct answer index
   - Explanation for the correct answer
4. **Database Storage**: Saves questions to `assessment_questions` table
5. **Auto-Update**: Updates `total_questions` count on the assessment

## Question Quality

The AI generates questions that:
- Test understanding, not just memorization
- Include a mix of difficulty levels
- Have plausible but clearly distinguishable options
- Focus on practical application and key concepts
- Are clear and concise

## Cost Considerations

- GPT-4 API costs approximately $0.03 per 1K input tokens
- Average module (5-10 slides) costs ~$0.10-0.30 per generation
- Questions are cached in database - only regenerated when module is updated

## Troubleshooting

### "OpenAI API error: 401"
- Check that your API key is correct
- Verify the key hasn't expired
- Ensure you have API credits in your OpenAI account

### "No slides found for this module"
- Make sure slides are saved before generating questions
- Check that slides have content (not just empty slides)

### Questions seem off-topic
- Ensure slide content is detailed and relevant
- Add more context in slide notes
- Consider manually reviewing and editing generated questions

## Manual Question Editing

You can manually edit generated questions:
1. Questions are stored in `assessment_questions` table
2. Edit directly in Supabase or create an admin UI
3. Fields: question_text, option_a/b/c/d, correct_answer, explanation

## Future Enhancements

- [ ] Question difficulty tagging
- [ ] Question bank and reuse
- [ ] Manual question review UI
- [ ] Question analytics and improvement
- [ ] Support for other question types (true/false, fill-in-blank)
