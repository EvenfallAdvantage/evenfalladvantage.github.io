-- Verify Systema Scout module codes exist
SELECT 
    id,
    module_code,
    module_name
FROM training_modules
WHERE module_code LIKE 'systema-scout%'
ORDER BY module_code;
