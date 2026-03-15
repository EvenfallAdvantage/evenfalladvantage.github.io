// Database Cleanup Utilities
// Run these functions from the browser console to clean up duplicate data

async function cleanupDuplicateAssessmentResults() {
    console.log('🧹 Starting cleanup of duplicate assessment results...');
    
    try {
        // Get all assessment results
        const { data: allResults, error: fetchError } = await supabase
            .from('assessment_results')
            .select('*')
            .order('completed_at', { ascending: false });
        
        if (fetchError) throw fetchError;
        
        console.log(`Found ${allResults.length} total assessment results`);
        
        // Group by student_id and assessment_id
        const grouped = {};
        allResults.forEach(result => {
            const key = `${result.student_id}_${result.assessment_id}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(result);
        });
        
        // Find duplicates and keep only the best score
        let totalDuplicates = 0;
        const idsToDelete = [];
        
        for (const [key, results] of Object.entries(grouped)) {
            if (results.length > 1) {
                console.log(`Found ${results.length} attempts for ${key}`);
                
                // Sort by score (descending) then by date (most recent first)
                results.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return new Date(b.completed_at) - new Date(a.completed_at);
                });
                
                // Keep the first one (best score, most recent), delete the rest
                const toKeep = results[0];
                const toDelete = results.slice(1);
                
                console.log(`  Keeping: Score ${toKeep.score} from ${toKeep.completed_at}`);
                console.log(`  Deleting: ${toDelete.length} duplicates`);
                
                toDelete.forEach(r => idsToDelete.push(r.id));
                totalDuplicates += toDelete.length;
            }
        }
        
        if (idsToDelete.length === 0) {
            console.log('✅ No duplicates found!');
            return;
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`  Total results: ${allResults.length}`);
        console.log(`  Duplicates to delete: ${idsToDelete.length}`);
        console.log(`  Results after cleanup: ${allResults.length - idsToDelete.length}`);
        
        // Ask for confirmation
        const confirmed = confirm(
            `⚠️ This will delete ${idsToDelete.length} duplicate assessment results.\n\n` +
            `Only the best score for each student/assessment will be kept.\n\n` +
            `Continue?`
        );
        
        if (!confirmed) {
            console.log('❌ Cleanup cancelled');
            return;
        }
        
        // Delete in batches of 100
        console.log('\n🗑️ Deleting duplicates...');
        const batchSize = 100;
        let deleted = 0;
        
        for (let i = 0; i < idsToDelete.length; i += batchSize) {
            const batch = idsToDelete.slice(i, i + batchSize);
            const { error: deleteError } = await supabase
                .from('assessment_results')
                .delete()
                .in('id', batch);
            
            if (deleteError) {
                console.error('Error deleting batch:', deleteError);
                throw deleteError;
            }
            
            deleted += batch.length;
            console.log(`  Deleted ${deleted}/${idsToDelete.length}...`);
        }
        
        console.log('\n✅ Cleanup complete!');
        console.log(`  Deleted ${deleted} duplicate records`);
        console.log(`  Database is now clean`);
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    }
}

// Add to window for easy access
window.cleanupDuplicateAssessmentResults = cleanupDuplicateAssessmentResults;

console.log('📦 Database cleanup utilities loaded');
console.log('Run: cleanupDuplicateAssessmentResults()');
