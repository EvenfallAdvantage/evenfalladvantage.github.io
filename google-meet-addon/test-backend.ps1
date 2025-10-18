$url = "https://evenfall-meet-addon-717441135149.us-central1.run.app/"
$body = @{
    question = "What is STOP THE BLEED?"
} | ConvertTo-Json

Write-Host "Testing backend..." -ForegroundColor Yellow
Write-Host "URL: $url"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
    
    Write-Host "Success!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response from Clunt Westwood:" -ForegroundColor Cyan
    Write-Host $response.answer
    Write-Host ""
    Write-Host "Agent: $($response.agent)"
    Write-Host "Timestamp: $($response.timestamp)"
} catch {
    Write-Host "Error!" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
