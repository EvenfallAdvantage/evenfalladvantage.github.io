// Supabase Integration for Student Portal
// This file extends the existing student-portal.js with database functionality

// Override saveProgress to save to Supabase
const originalSaveProgress = window.saveProgress;

window.saveProgress = async function() {
    // Call original function to save to localStorage
    if (originalSaveProgress) {
        originalSaveProgress();
    }
    
    // Also save to Supabase
    const user = await Auth.getCurrentUser();
    if (!user) return;
    
    // Save to database
    await saveProgressToDatabase(user.id);
};

// Save progress to Supabase database
async function saveProgressToDatabase(studentId) {
    const progressData = JSON.parse(localStorage.getItem('securityTrainingProgress') || '{}');
    
    // Save completed modules
    if (progressData.completedModules) {
        for (const moduleCode of progressData.completedModules) {
            // Get module ID from code
            const moduleResult = await TrainingData.getModuleByCode(moduleCode);
            if (moduleResult.success && moduleResult.data) {
                await StudentData.updateModuleProgress(studentId, moduleResult.data.id, {
                    progress_percentage: 100,
                    completed_at: new Date().toISOString()
                });
            }
        }
    }
    
    // Save assessment results
    if (progressData.assessmentResults) {
        for (const result of progressData.assessmentResults) {
            // Find assessment by module code
            const moduleResult = await TrainingData.getModuleByCode(result.module);
            if (moduleResult.success && moduleResult.data) {
                // Get assessment for this module
                const { data: assessments } = await supabase
                    .from('assessments')
                    .select('*')
                    .eq('module_id', moduleResult.data.id)
                    .limit(1);
                
                if (assessments && assessments.length > 0) {
                    await StudentData.saveAssessmentResult(studentId, assessments[0].id, {
                        score: result.score,
                        passed: result.passed,
                        time_taken_minutes: result.timeTaken || 0,
                        answers_json: result.answers || {}
                    });
                }
            }
        }
    }
}

// Load progress from Supabase on page load
async function loadProgressFromDatabase() {
    const user = await Auth.getCurrentUser();
    if (!user) return;
    
    // Get module progress
    const progressResult = await StudentData.getModuleProgress(user.id);
    if (progressResult.success && progressResult.data) {
        const completedModules = progressResult.data
            .filter(p => p.status === 'completed')
            .map(p => p.training_modules.module_code);
        
        // Update localStorage
        const localProgress = JSON.parse(localStorage.getItem('securityTrainingProgress') || '{}');
        localProgress.completedModules = completedModules;
        localStorage.setItem('securityTrainingProgress', JSON.stringify(localProgress));
    }
    
    // Get assessment results
    const resultsResult = await StudentData.getAssessmentResults(user.id);
    if (resultsResult.success && resultsResult.data) {
        const assessmentResults = resultsResult.data.map(r => ({
            module: r.assessments.assessment_name,
            score: r.score,
            passed: r.passed,
            date: r.completed_at,
            timeTaken: r.time_taken_minutes
        }));
        
        // Update localStorage
        const localProgress = JSON.parse(localStorage.getItem('securityTrainingProgress') || '{}');
        localProgress.assessmentResults = assessmentResults;
        localStorage.setItem('securityTrainingProgress', JSON.stringify(localProgress));
    }
    
    // Refresh the display
    if (window.updateProgressDisplay) {
        window.updateProgressDisplay();
    }
}

// Initialize on page load
(async function() {
    const user = await Auth.getCurrentUser();
    if (user) {
        await loadProgressFromDatabase();
    }
})();

// Export functions
window.saveProgressToDatabase = saveProgressToDatabase;
window.loadProgressFromDatabase = loadProgressFromDatabase;
