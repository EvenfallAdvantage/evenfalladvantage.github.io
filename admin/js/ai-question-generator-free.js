// FREE AI Question Generator for Assessments
// Uses free alternatives: Hugging Face API (free tier) or Google Gemini (free)

// Option 1: Hugging Face (Free - 30,000 characters/month)
const HUGGINGFACE_API_KEY = 'YOUR_HF_API_KEY'; // Get free at https://huggingface.co/settings/tokens

// Option 2: Google Gemini (Free - 60 requests/minute)
const GEMINI_API_KEY = 'AIzaSyCAYqCl-Gxz67P86_6DPGTrXS-nyNuTpbY'; // Get free at https://makersuite.google.com/app/apikey

// Choose which API to use
const USE_GEMINI = true; // Set to false to use Hugging Face instead

// Generate assessment questions from module slides using FREE AI
async function generateQuestionsFromSlides(moduleId, moduleName, slides) {
    try {
        // Extract text content from all slides
        const slideContent = slides.map((slide, index) => {
            return `Slide ${index + 1}: ${slide.title || 'Untitled'}
${slide.content || ''}
${slide.notes || ''}`;
        }).join('\n\n');

        const prompt = `You are an expert training assessment creator. Based on the following training module content, generate 10 multiple-choice questions to test comprehension.

Module: ${moduleName}

Content:
${slideContent}

Generate exactly 10 questions in the following JSON format:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of the correct answer"
    }
  ]
}

Requirements:
- Questions should test understanding, not just memorization
- Include a mix of difficulty levels
- Options should be plausible but only one clearly correct
- Correct answer index (0-3) should be randomized
- Keep questions clear and concise
- Focus on practical application and key concepts
- RESPOND ONLY WITH VALID JSON, NO OTHER TEXT`;

        let questions;
        
        if (USE_GEMINI) {
            questions = await generateWithGemini(prompt);
        } else {
            questions = await generateWithHuggingFace(prompt);
        }
        
        return questions;
    } catch (error) {
        console.error('Error generating questions:', error);
        throw error;
    }
}

// Generate using Google Gemini (FREE - 60 requests/minute)
async function generateWithGemini(prompt) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.statusText}`);
        }

        const data = await response.json();
        const generatedText = data.candidates[0].content.parts[0].text;
        
        // Extract JSON from response (sometimes Gemini adds markdown formatting)
        let jsonText = generatedText.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
        }
        
        const questionsData = JSON.parse(jsonText);
        return questionsData.questions;
    } catch (error) {
        console.error('Gemini API error:', error);
        throw error;
    }
}

// Generate using Hugging Face (FREE - 30,000 chars/month)
async function generateWithHuggingFace(prompt) {
    try {
        const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 2000,
                    temperature: 0.7,
                    return_full_text: false
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Hugging Face API error: ${response.statusText}`);
        }

        const data = await response.json();
        const generatedText = data[0].generated_text;
        
        // Extract JSON from response
        let jsonText = generatedText.trim();
        if (jsonText.includes('```json')) {
            jsonText = jsonText.split('```json')[1].split('```')[0];
        } else if (jsonText.includes('{')) {
            jsonText = jsonText.substring(jsonText.indexOf('{'));
            jsonText = jsonText.substring(0, jsonText.lastIndexOf('}') + 1);
        }
        
        const questionsData = JSON.parse(jsonText);
        return questionsData.questions;
    } catch (error) {
        console.error('Hugging Face API error:', error);
        throw error;
    }
}

// Fallback: Generate questions using simple template-based approach (NO API NEEDED)
function generateQuestionsLocally(slides, moduleName) {
    const questions = [];
    
    // Extract key concepts from slides
    slides.forEach((slide, index) => {
        if (slide.content && slide.content.length > 50) {
            // Simple question templates
            const templates = [
                {
                    question: `What is the main topic covered in "${slide.title}"?`,
                    generateOptions: (content) => {
                        return [
                            slide.title || 'Main concept',
                            'Unrelated topic A',
                            'Unrelated topic B',
                            'Unrelated topic C'
                        ];
                    },
                    correct: 0
                },
                {
                    question: `According to the module, which statement about ${slide.title} is correct?`,
                    generateOptions: (content) => {
                        const firstSentence = content.split('.')[0];
                        return [
                            firstSentence,
                            'This is not mentioned in the module',
                            'This contradicts the module content',
                            'This is partially incorrect'
                        ];
                    },
                    correct: 0
                }
            ];
            
            if (questions.length < 10) {
                const template = templates[questions.length % templates.length];
                questions.push({
                    question: template.question,
                    options: template.generateOptions(slide.content),
                    correct: template.correct,
                    explanation: `This information is covered in the slide: ${slide.title}`
                });
            }
        }
    });
    
    // Fill remaining questions with general ones
    while (questions.length < 10) {
        questions.push({
            question: `What is an important concept from the ${moduleName} module?`,
            options: [
                'Key concept from the training',
                'Unrelated concept A',
                'Unrelated concept B',
                'Unrelated concept C'
            ],
            correct: 0,
            explanation: 'This is covered throughout the module content.'
        });
    }
    
    return questions;
}

// Save generated questions to database
async function saveQuestionsToAssessment(assessmentId, questions) {
    try {
        // Delete existing questions
        const { error: deleteError } = await supabase
            .from('assessment_questions')
            .delete()
            .eq('assessment_id', assessmentId);

        if (deleteError) throw deleteError;

        // Insert new questions
        const questionRecords = questions.map((q, index) => ({
            assessment_id: assessmentId,
            question_number: index + 1,
            question_text: q.question,
            option_a: q.options[0],
            option_b: q.options[1],
            option_c: q.options[2],
            option_d: q.options[3],
            correct_answer: ['A', 'B', 'C', 'D'][q.correct],
            explanation: q.explanation
        }));

        const { error: insertError } = await supabase
            .from('assessment_questions')
            .insert(questionRecords);

        if (insertError) throw insertError;

        // Update assessment total_questions
        const { error: updateError } = await supabase
            .from('assessments')
            .update({ total_questions: questions.length })
            .eq('id', assessmentId);

        if (updateError) throw updateError;

        return true;
    } catch (error) {
        console.error('Error saving questions:', error);
        throw error;
    }
}

// Generate and save questions for a module
async function generateAssessmentQuestions(moduleId, moduleName) {
    try {
        // Get module slides
        const { data: slides, error: slidesError } = await supabase
            .from('module_slides')
            .select('*')
            .eq('module_id', moduleId)
            .order('slide_number');

        if (slidesError) throw slidesError;

        if (!slides || slides.length === 0) {
            throw new Error('No slides found for this module');
        }

        // Get assessment for this module
        const { data: assessment, error: assessmentError } = await supabase
            .from('assessments')
            .select('*')
            .eq('module_id', moduleId)
            .single();

        if (assessmentError) throw assessmentError;

        let questions;
        
        try {
            // Try AI generation first
            questions = await generateQuestionsFromSlides(moduleId, moduleName, slides);
        } catch (aiError) {
            console.warn('AI generation failed, using local fallback:', aiError);
            // Fallback to local generation
            questions = generateQuestionsLocally(slides, moduleName);
        }

        // Save questions to database
        await saveQuestionsToAssessment(assessment.id, questions);

        return {
            success: true,
            questionsGenerated: questions.length,
            method: questions.length === 10 ? 'AI' : 'Local'
        };
    } catch (error) {
        console.error('Error in generateAssessmentQuestions:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Export functions
window.generateQuestionsFromSlides = generateQuestionsFromSlides;
window.saveQuestionsToAssessment = saveQuestionsToAssessment;
window.generateAssessmentQuestions = generateAssessmentQuestions;
