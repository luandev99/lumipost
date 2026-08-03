# Redeploy das Edge Functions que ficaram com a versão antiga do CORS.
#
# Sintoma: o preflight OPTIONS responde 204 normalmente, mas o POST seguinte
# é bloqueado pelo browser como "erro de CORS". Causa: a versão publicada
# dessas funções não lista `x-client-info` em Access-Control-Allow-Headers,
# e o supabase-js sempre envia esse header.
#
# O código em supabase/functions/_shared/http.ts já está correto — só falta
# publicar. Rode a partir da raiz do projeto:
#
#   npx supabase login
#   npx supabase link --project-ref djddjdjoarrwjiwqsnoa
#   ./scripts/redeploy-cors-fix.ps1

$funcoes = @(
  'account-bootstrap',
  'ai-weekly-plan',
  'brand-analyze-instagram',
  'credit-balance',
  'meta-disconnect',
  'meta-oauth-start',
  'queue-action',
  'schedule-content',
  'template-api'
)

foreach ($f in $funcoes) {
  Write-Host "Deploy: $f" -ForegroundColor Cyan
  npx supabase functions deploy $f
  if (-not $?) { Write-Host "Falhou em $f" -ForegroundColor Red; break }
}

Write-Host "`nConferindo se o header passou a aparecer..." -ForegroundColor Cyan
foreach ($f in $funcoes) {
  $r = curl.exe -s -X OPTIONS "https://djddjdjoarrwjiwqsnoa.supabase.co/functions/v1/$f" `
    -H "Origin: https://lumipost-ai.vercel.app" `
    -H "Access-Control-Request-Method: POST" -D - -o NUL 2>&1
  if ($r -match 'x-client-info') {
    Write-Host ("{0,-26} ok" -f $f) -ForegroundColor Green
  } else {
    Write-Host ("{0,-26} ainda sem x-client-info" -f $f) -ForegroundColor Red
  }
}
