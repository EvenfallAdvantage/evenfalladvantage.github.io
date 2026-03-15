// Supabase Integration for Student Portal
// This file extends the existing student-portal.js with database functionality

// Override saveProgress to save to Supabase
const originalSaveProgress = window.saveProgress;

window.saveProgress = async function() {
    // Call original function to save to localStorage
    if (originalSaveProgress) {
        originalSaveProgress();
    }
    
    // Also save to Supabase (don't await to avoid blocking UI)
    const user = await Auth.getCurrentUser();
    if (!user) {
        console.warn('Cannot save to database: User not logged in');
        return;
    }
    
    // Save to database in background
    saveProgressToDatabase(user.id).catch(err => {
        console.error('Failed to sync progress to database:', err);
        // Show a non-intrusive notification
        showSyncError();
    });
};

// Show sync error notification
function showSyncError() {
    const existingError = document.querySelector('.sync-error-notification');
    if (existingError) return; // Don't show multiple errors
    
    const notification = document.createElement('div');
    notification.className = 'sync-error-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        Progress sync failed. Your progress is saved locally.
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

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
                    // Skip if module code is missing
                    if (!result.module) {
                        console.warn('Skipping assessment result with no module code:', result);
                        continue;
                    }
                    
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
                            // Determine if passed (default to true if score >= 70 and passed is undefined)
                            const passed = result.passed !== undefined 
                                ? result.passed 
                                : (result.score >= 70);
                            
                            // For Module 7 (Use of Force), include the state code
                            const assessmentData = {
                                score: result.score,
                                passed: passed,
                                time_taken_minutes: result.timeTaken || 0,
                                answers_json: {
                                    questions: result.questions || [],
                                    userAnswers: result.userAnswers || [],
                                    answers: result.answers || {}
                                }
                            };
                            
                            // Add state code if this is Module 7
                            if (result.module === 'use-of-force') {
                                const selectedState = localStorage.getItem('selectedState');
                                if (selectedState) {
                                    assessmentData.state_code = selectedState;
                                    console.log(`📍 Saving Module 7 assessment for state: ${selectedState}`);
                                }
                            }
                            
                            await StudentData.saveAssessmentResult(studentId, assessments[0].id, assessmentData);
                            console.log(`✅ Saved assessment result: ${result.module} (${passed ? 'passed' : 'failed'})`);
                            
                            // If passed, mark module as completed
                            if (passed) {
                                await StudentData.updateModuleProgress(studentId, moduleResult.data.id, {
                                    progress_percentage: 100,
                                    completed_at: new Date().toISOString()
                                });
                                console.log(`✅ Marked module as completed: ${result.module}`);
                            }
                        } else {
                            console.warn(`No assessment found for module: ${result.module}`);
                        }
                    } else {
                        console.warn(`Module not found: ${result.module}`);
                    }
                } catch (err) {
                    console.warn(`Failed to save assessment ${result.module}:`, err.message);
                }
            }
        }
        
        // Save scenario results (de-escalation personal bests)
        if (progressData.scenarioResults && Object.keys(progressData.scenarioResults).length > 0) {
            for (const [scenarioId, result] of Object.entries(progressData.scenarioResults)) {
                try {
                    // Check if a result already exists for this scenario
                    const { data: existingResults } = await supabase
                        .from('scenario_results')
                        .select('*')
                        .eq('student_id', studentId)
                        .eq('scenario_id', scenarioId)
                        .order('steps', { ascending: true })
                        .limit(1);
                    
                    // Only save if this is a new personal best (fewer steps) or first attempt
                    if (!existingResults || existingResults.length === 0 || result.steps < existingResults[0].steps) {
                        await supabase
                            .from('scenario_results')
                            .insert({
                                student_id: studentId,
                                scenario_id: scenarioId,
                                steps: result.steps,
                                success: result.success,
                                completed_at: result.date
                            });
                        console.log(`✅ Saved scenario result: ${scenarioId} (${result.steps} steps)`);
                    }
                } catch (err) {
                    console.warn(`Failed to save scenario ${scenarioId}:`, err.message);
                }
            }
        }
        
        // Show success notification
        showSyncSuccess();
    } catch (error) {
        console.error('❌ Database sync error:', error.message);
        console.error('Full error:', error);
        throw error; // Propagate error so user knows sync failed
    }
}

// Show sync success notification
function showSyncSuccess() {
    const notification = document.createElement('div');
    notification.className = 'sync-success-notification';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-size: 14px;
        opacity: 0;
        animation: fadeInOut 2s ease;
    `;
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i> Progress saved
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(20px); }
            20% { opacity: 1; transform: translateY(0); }
            80% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000);
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
            activities: [],
            scenarioResults: {}
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
            console.log('Raw assessment results from DB:', resultsResult.data.length);
            
            // Get module info to map assessment to module code
            const { data: modules } = await supabase
                .from('training_modules')
                .select('id, module_code');
            
            const moduleIdToCode = {};
            if (modules) {
                modules.forEach(m => moduleIdToCode[m.id] = m.module_code);
                console.log('Module mapping created:', Object.keys(moduleIdToCode).length, 'modules');
            }
            
            const assessmentResults = resultsResult.data
                .filter(r => r.assessments)
                .map(r => {
                    // Get module code from assessment's module_id
                    const moduleId = r.assessments?.module_id;
                    const moduleCode = moduleIdToCode[moduleId];
                    
                    if (!moduleCode) {
                        console.warn('Could not find module code for module_id:', moduleId, 'Assessment:', r.assessments?.assessment_name);
                    }
                    
                    // Extract questions and userAnswers from answers_json if available
                    const answersData = r.answers_json || {};
                    
                    return {
                        module: moduleCode || 'unknown',
                        assessment: moduleCode || 'unknown',
                        score: r.score,
                        passed: r.passed,
                        date: r.completed_at,
                        timeTaken: r.time_taken_minutes,
                        state_code: r.state_code, // Include state code for Module 7
                        questions: answersData.questions || [],
                        userAnswers: answersData.userAnswers || []
                    };
                });
            
            // Deduplicate: keep only the best attempt for each module
            // For Module 7 (use-of-force), keep separate entries for each state
            const bestAttempts = {};
            assessmentResults.forEach(result => {
                // For Module 7, create a unique key per state
                const key = result.module === 'use-of-force' && result.state_code
                    ? `${result.module}-${result.state_code}`
                    : result.module;
                    
                if (!bestAttempts[key] || result.score > bestAttempts[key].score) {
                    bestAttempts[key] = result;
                }
            });
            
            // Don't include 'unknown' assessments
            const validAttempts = Object.values(bestAttempts).filter(r => r.module !== 'unknown');
            
            localProgress.assessmentResults = validAttempts;
            console.log('Loaded assessment results:', validAttempts.length, '(deduplicated from', assessmentResults.length, 'total)');
        }
        
        // Get scenario results from database
        const { data: scenarioResults, error: scenarioError } = await supabase
            .from('scenario_results')
            .select('*')
            .eq('student_id', user.id)
            .order('completed_at', { ascending: false });
        
        if (!scenarioError && scenarioResults && scenarioResults.length > 0) {
            console.log('Raw scenario results from DB:', scenarioResults.length);
            
            // Keep only the best (lowest steps) for each scenario
            const bestScenarios = {};
            const completedScenarioIds = new Set();
            
            scenarioResults.forEach(result => {
                // Add to completed scenarios list (any successful completion)
                if (result.success) {
                    completedScenarioIds.add(result.scenario_id);
                }
                
                // Track best attempt
                if (!bestScenarios[result.scenario_id] || result.steps < bestScenarios[result.scenario_id].steps) {
                    bestScenarios[result.scenario_id] = {
                        steps: result.steps,
                        date: result.completed_at,
                        success: result.success
                    };
                }
            });
            
            localProgress.scenarioResults = bestScenarios;
            localProgress.completedScenarios = Array.from(completedScenarioIds);
            console.log('Loaded scenario results:', Object.keys(bestScenarios).length);
            console.log('Loaded completed scenarios:', localProgress.completedScenarios.length);
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
            activities: [],
            scenarioResults: {}
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
