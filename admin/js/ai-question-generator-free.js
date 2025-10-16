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

        const prompt = `You are an expert security training assessment creator specializing in event security and emergency response. Based on the following training module content, generate 10 high-quality multiple-choice questions.

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

CRITICAL REQUIREMENTS:
1. **Question Quality:**
   - Each question MUST be based on SPECIFIC content from the slides above
   - Questions should test practical application and scenario-based understanding
   - Avoid vague questions like "What is the main topic?" - be specific!
   - Use real-world scenarios relevant to event security guards

2. **Answer Options:**
   - All 4 options must be plausible and related to the topic
   - Incorrect options should be common misconceptions or related concepts
   - Avoid obvious wrong answers like "Unrelated topic A/B/C"
   - Options should be similar in length and complexity
   - Randomize which position (A/B/C/D) contains the correct answer

3. **Difficulty Mix:**
   - 3 questions: Basic recall of key facts and definitions
   - 4 questions: Application of concepts to scenarios
   - 3 questions: Analysis and decision-making situations

4. **Content Focus:**
   - Prioritize safety-critical information
   - Include legal/regulatory requirements if mentioned
   - Cover proper procedures and protocols
   - Test understanding of when/how to apply knowledge

5. **Formatting:**
   - Keep questions clear and under 200 characters
   - Use professional security industry terminology
   - Include specific numbers, procedures, or requirements from the content
   - Explanations should reference the slide content

RESPOND ONLY WITH VALID JSON, NO OTHER TEXT OR MARKDOWN`;

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

// Fallback: Generate questions using improved template-based approach (NO API NEEDED)
function generateQuestionsLocally(slides, moduleName) {
    const questions = [];
    
    // Common security-related distractors
    const commonDistractors = {
        procedures: [
            'Follow standard operating procedures',
            'Contact your supervisor immediately',
            'Document the incident in writing',
            'Notify local law enforcement'
        ],
        safety: [
            'Ensure personal safety first',
            'Evacuate the area immediately',
            'Secure the perimeter',
            'Call for backup assistance'
        ],
        communication: [
            'Use clear and concise language',
            'Maintain radio silence',
            'Report to the command center',
            'Document all communications'
        ],
        legal: [
            'Follow company policy',
            'Comply with local regulations',
            'Obtain written consent',
            'Consult with legal counsel'
        ]
    };
    
    // Extract key concepts from slides
    slides.forEach((slide, index) => {
        if (slide.content && slide.content.length > 50 && questions.length < 10) {
            const content = slide.content;
            const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
            
            if (sentences.length > 0) {
                // Extract a key fact from the slide
                const keyFact = sentences[0].trim();
                const words = keyFact.split(' ');
                
                // Create a scenario-based question
                const questionTypes = [
                    {
                        question: `According to ${moduleName}, what is the correct procedure regarding ${slide.title?.toLowerCase() || 'this topic'}?`,
                        generateOptions: () => {
                            const distractorSet = commonDistractors.procedures;
                            return shuffleArray([
                                keyFact.length > 100 ? keyFact.substring(0, 100) + '...' : keyFact,
                                ...distractorSet.slice(0, 3)
                            ]);
                        }
                    },
                    {
                        question: `When dealing with ${slide.title?.toLowerCase() || 'this situation'}, what should a security guard prioritize?`,
                        generateOptions: () => {
                            const distractorSet = commonDistractors.safety;
                            return shuffleArray([
                                keyFact.length > 100 ? keyFact.substring(0, 100) + '...' : keyFact,
                                ...distractorSet.slice(0, 3)
                            ]);
                        }
                    }
                ];
                
                const template = questionTypes[questions.length % questionTypes.length];
                const options = template.generateOptions();
                const correctAnswer = options.findIndex(opt => opt.includes(keyFact.substring(0, 50)));
                
                questions.push({
                    question: template.question,
                    options: options,
                    correct: correctAnswer >= 0 ? correctAnswer : 0,
                    explanation: `This information is covered in ${slide.title}: ${keyFact.substring(0, 150)}...`
                });
            }
        }
    });
    
    // Fill remaining questions with general security knowledge if needed
    while (questions.length < 10) {
        const generalQuestions = [
            {
                question: 'What is the primary responsibility of an event security guard?',
                options: shuffleArray([
                    'Ensuring the safety and security of all attendees',
                    'Selling merchandise and concessions',
                    'Managing event logistics and scheduling',
                    'Providing entertainment for guests'
                ]),
                correct: 0,
                explanation: 'The primary responsibility is always safety and security.'
            },
            {
                question: 'When should you escalate a situation to your supervisor?',
                options: shuffleArray([
                    'When the situation exceeds your authority or training',
                    'Only during emergencies',
                    'Never, handle everything independently',
                    'Only at the end of your shift'
                ]),
                correct: 0,
                explanation: 'Always escalate when a situation is beyond your scope.'
            }
        ];
        
        questions.push(generalQuestions[questions.length % generalQuestions.length]);
    }
    
    return questions;
}

// Helper function to shuffle array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
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
