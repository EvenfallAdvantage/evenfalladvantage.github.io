// AI Question Generator for Assessments
// Uses OpenAI API to generate questions from module slides

const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY'; // Replace with your actual API key

// Generate assessment questions from module slides
async function generateQuestionsFromSlides(moduleId, moduleName, slides) {
    try {
        // Extract text content from all slides
        const slideContent = slides.map((slide, index) => {
            return `Slide ${index + 1}: ${slide.title || 'Untitled'}
${slide.content || ''}
${slide.notes || ''}`;
        }).join('\n\n');

        // Create prompt for OpenAI
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
- Focus on practical application and key concepts`;

        // Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at creating training assessments. Always respond with valid JSON only.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        const generatedText = data.choices[0].message.content;
        
        // Parse JSON response
        const questionsData = JSON.parse(generatedText);
        
        return questionsData.questions;
    } catch (error) {
        console.error('Error generating questions:', error);
        throw error;
    }
}

// Save generated questions to database
async function saveQuestionsToAssessment(assessmentId, questions) {
    try {
        // Get existing assessment
        const { data: assessment, error: fetchError } = await supabase
            .from('assessments')
            .select('*')
            .eq('id', assessmentId)
            .single();

        if (fetchError) throw fetchError;

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

        // Generate questions using AI
        const questions = await generateQuestionsFromSlides(moduleId, moduleName, slides);

        // Save questions to database
        await saveQuestionsToAssessment(assessment.id, questions);

        return {
            success: true,
            questionsGenerated: questions.length
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
