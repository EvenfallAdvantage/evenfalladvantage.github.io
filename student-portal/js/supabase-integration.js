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
    try {
        const user = await Auth.getCurrentUser();
        if (!user) return;
        
        // Initialize localStorage if it doesn't exist
        let localProgress = JSON.parse(localStorage.getItem('securityTrainingProgress') || '{}');
        if (!localProgress.completedModules) localProgress.completedModules = [];
        if (!localProgress.completedScenarios) localProgress.completedScenarios = [];
        if (!localProgress.assessmentResults) localProgress.assessmentResults = [];
        if (!localProgress.activities) localProgress.activities = [];
        
        // Get module progress
        const progressResult = await StudentData.getModuleProgress(user.id);
        if (progressResult.success && progressResult.data && progressResult.data.length > 0) {
            const completedModules = progressResult.data
                .filter(p => p.status === 'completed' && p.training_modules)
                .map(p => p.training_modules.module_code);
            
            localProgress.completedModules = completedModules;
        }
        
        // Get assessment results
        const resultsResult = await StudentData.getAssessmentResults(user.id);
        if (resultsResult.success && resultsResult.data && resultsResult.data.length > 0) {
            const assessmentResults = resultsResult.data
                .filter(r => r.assessments)
                .map(r => ({
                    module: r.assessments.assessment_name,
                    score: r.score,
                    passed: r.passed,
                    date: r.completed_at,
                    timeTaken: r.time_taken_minutes
                }));
            
            localProgress.assessmentResults = assessmentResults;
        }
        
        // Save to localStorage
        localStorage.setItem('securityTrainingProgress', JSON.stringify(localProgress));
        
        // Refresh the display
        if (window.updateProgressDisplay) {
            window.updateProgressDisplay();
        }
    } catch (error) {
        console.error('Error loading progress from database:', error);
        // Don't fail - just use local data
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
