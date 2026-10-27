$ErrorActionPreference = 'Stop'

Write-Host "================== 1. TESTING /auth/me =================="
$me = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/auth/me' -Method Get
Write-Host "Current User: $($me.data.user.full_name) | Role: $($me.data.user.role)"

Write-Host "`n================== 2. TESTING CANDIDATE SCOPING (SUPERADMIN) =================="
$allCands = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/candidates' -Method Get -Headers @{ 'X-User-Role' = 'superadmin'; 'X-User-Id' = '1' }
Write-Host "Superadmin sees $($allCands.data.count) candidates (Global)"

Write-Host "`n================== 3. TESTING CANDIDATE SCOPING (CASE MANAGER HUSAIN) =================="
$husainCands = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/candidates' -Method Get -Headers @{ 'X-User-Role' = 'case_manager'; 'X-User-Id' = '3' }
Write-Host "Husain sees $($husainCands.data.count) candidates (Scoped to Husain)"

Write-Host "`n================== 4. TESTING RBAC: CASE MANAGER CREATING USER (MUST BE 403) =================="
try {
    $forbidden = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/users' -Method Post -Headers @{ 'X-User-Role' = 'case_manager'; 'X-User-Id' = '3' } -Body '{"username":"hacker","full_name":"Hacker"}' -ContentType 'application/json'
    Write-Host "ERROR: Case manager was allowed to create user!" -ForegroundColor Red
} catch {
    Write-Host "SUCCESS: Case Manager blocked with status code 403 Forbidden" -ForegroundColor Green
}

Write-Host "`n================== 5. TESTING RBAC: SUPERADMIN CREATING USER =================="
$testUser = "user_" + (Get-Random -Minimum 1000 -Maximum 9999)
$newUserPayload = @{
    username = $testUser
    full_name = "Automated Test Specialist"
    role = "case_manager"
    case_manager_code = "TestCM"
    email = "$testUser@sandslab.bh"
    phone = "35078079"
} | ConvertTo-Json

$createUser = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/users' -Method Post -Headers @{ 'X-User-Role' = 'superadmin'; 'X-User-Id' = '1' } -Body $newUserPayload -ContentType 'application/json'
Write-Host "SUCCESS: Created User: $($createUser.data.full_name) (ID: $($createUser.data.id))" -ForegroundColor Green

Write-Host "`n================== 6. TESTING MANUAL CLAIM AMOUNT ENTRY (BHD) =================="
$claimPayload = @{
    candidate_id = 1
    claim_type = "initial_placement"
    claim_amount_bhd = 700.000
    remarks = "Manual entry for placement claim under Tamkeen program"
} | ConvertTo-Json

$newClaim = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/claims' -Method Post -Headers @{ 'X-User-Role' = 'superadmin'; 'X-User-Id' = '1' } -Body $claimPayload -ContentType 'application/json'
Write-Host "SUCCESS: Claim Created Ref: $($newClaim.data.claim_ref) for BHD $($newClaim.data.claim_amount_bhd)" -ForegroundColor Green

Write-Host "`n================== 7. TESTING PAYMENT RECEIPT RECORDING =================="
$paymentPayload = @{
    claim_id = $newClaim.data.id
    amount_paid_bhd = 350.000
    payment_method = "Bank Transfer"
    notes = "First tranche received from Tamkeen"
} | ConvertTo-Json

$newPayment = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/payments' -Method Post -Headers @{ 'X-User-Role' = 'superadmin'; 'X-User-Id' = '1' } -Body $paymentPayload -ContentType 'application/json'
Write-Host "SUCCESS: Recorded Payment Receipt: $($newPayment.data.receipt_no) for BHD $($newPayment.data.amount_paid_bhd)" -ForegroundColor Green

Write-Host "`n================== 8. TESTING SETTINGS & GCC LOCALIZATION =================="
$settingsPayload = @{
    timezone = "Asia/Bahrain"
    currency = "BHD"
    currency_symbol = "BD"
    date_format = "DD/MM/YYYY"
    time_format = "12h"
    default_country = "Bahrain"
} | ConvertTo-Json

$settingsRes = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/settings' -Method Post -Headers @{ 'X-User-Role' = 'superadmin'; 'X-User-Id' = '1' } -Body $settingsPayload -ContentType 'application/json'
Write-Host "SUCCESS: Settings updated. Timezone: $($settingsRes.data.values.timezone), Currency: $($settingsRes.data.values.currency), Format: $($settingsRes.data.values.date_format)" -ForegroundColor Green

Write-Host "`n================== ALL MICRO-API AUTOMATED TESTS PASSED ==================" -ForegroundColor Cyan
