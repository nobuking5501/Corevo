# Corevo ローカル開発サーバー起動スクリプト
# このスクリプトは Next.js アプリケーションをローカル環境で起動します

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  Corevo 開発サーバー起動中..." -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "ポート: 3005" -ForegroundColor Green
Write-Host "URL: http://localhost:3005" -ForegroundColor Green
Write-Host ""
Write-Host "サーバーを停止するには Ctrl+C を押してください" -ForegroundColor Yellow
Write-Host ""

# Webアプリケーションを起動
npm run dev:web
