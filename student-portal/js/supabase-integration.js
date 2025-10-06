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
    try {
        const progressData = JSON.parse(localStorage.getItem('securityTrainingProgress') || '{}');
        
        console.log('Syncing progress to database...');
        
        // Save completed modules
        if (progressData.completedModules && progressData.completedModules.length > 0) {
            for (const moduleCode of progressData.completedModules) {
                try {
                    // Get module ID from code
                    const moduleResult = await TrainingData.getModuleByCode(moduleCode);
                    if (moduleResult.success && moduleResult.data) {
                        await StudentData.updateModuleProgress(studentId, moduleResult.data.id, {
                            progress_percentage: 100,
                            completed_at: new Date().toISOString()
                        });
                        console.log(`Saved module progress: ${moduleCode}`);
                    }
                } catch (err) {
                    console.warn(`Failed to save module ${moduleCode}:`, err.message);
                }
            }
        }
        
        // Save assessment results
        if (progressData.assessmentResults && progressData.assessmentResults.length > 0) {
            for (const result of progressData.assessmentResults) {
                try {
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
                            console.log(`Saved assessment result: ${result.module}`);
                        }
                    }
                } catch (err) {
                    console.warn(`Failed to save assessment ${result.module}:`, err.message);
                }
            }
        }
        
        console.log('Database sync complete!');
    } catch (error) {
        console.error('Database sync error:', error.message);
        throw error; // Propagate error so user knows sync failed
    }
}

// Load progress from Supabase on page load
async function loadProgressFromDatabase() {
    try {
        const user = await Auth.getCurrentUser();
        if (!user) return;
        
        console.log('Loading progress from database...');
        
        // Initialize localStorage structure
        let localProgress = {
            completedModules: [],
            completedScenarios: [],
            assessmentResults: [],
            activities: []
        };
        
        // Get module progress from database
        const progressResult = await StudentData.getModuleProgress(user.id);
        if (progressResult.success && progressResult.data && progressResult.data.length > 0) {
            const completedModules = progressResult.data
                .filter(p => p.status === 'completed' && p.training_modules)
                .map(p => p.training_modules.module_code);
            
            localProgress.completedModules = completedModules;
            console.log('Loaded completed modules:', completedModules);
        }
        
        // Get assessment results from database
        const resultsResult = await StudentData.getAssessmentResults(user.id);
        if (resultsResult.success && resultsResult.data && resultsResult.data.length > 0) {
            const assessmentResults = resultsResult.data
                .filter(r => r.assessments)
                .map(r => ({
                    module: r.assessments.assessment_name.replace(' Assessment', ''),
                    score: r.score,
                    passed: r.passed,
                    date: r.completed_at,
                    timeTaken: r.time_taken_minutes
                }));
            
            localProgress.assessmentResults = assessmentResults;
            console.log('Loaded assessment results:', assessmentResults.length);
        }
        
        // Save to localStorage (as cache)
        localStorage.setItem('securityTrainingProgress', JSON.stringify(localProgress));
        
        // Refresh the display
        if (window.updateProgressDisplay) {
            window.updateProgressDisplay();
        }
        
        console.log('Progress loaded from database successfully!');
    } catch (error) {
        console.error('Error loading progress from database:', error);
        // Initialize empty progress if load fails
        const emptyProgress = {
            completedModules: [],
            completedScenarios: [],
            assessmentResults: [],
            activities: []
        };
        localStorage.setItem('securityTrainingProgress', JSON.stringify(emptyProgress));
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
