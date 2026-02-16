# Emulator起動エラー - トラブルシューティングガイド

Emulatorが起動しないときの対処法です。

---

## まず確認: エラーメッセージを教えてください

生徒さんに以下を確認してください：

**ターミナルに表示されているエラーメッセージの全文をコピーして送ってください。**

---

## よくあるエラーと対処法

### ケース1: 「firebase: command not found」

**原因**: Firebase CLIがインストールされていない

**対処法**:
```bash
# Firebase CLIをインストール
npm install -g firebase-tools

# 確認
firebase --version
```

---

### ケース2: 「Error: Cannot find module...」

**原因**: Functionsの依存関係がインストールされていない

**対処法**:
```bash
# ルートで依存関係をインストール
npm install

# Functionsフォルダでも念のため
cd backend/functions
npm install
cd ../..
```

---

### ケース3: 「Port 8080 is already in use」（ポートが使用中）

**原因**: 既に別のプロセスがポートを使用している

**対処法**:
```bash
# ポートを使用しているプロセスを確認
lsof -i :8080
lsof -i :9099
lsof -i :5001
lsof -i :4000

# プロセスを終了（<PID>は上記で表示された数字）
kill -9 <PID>

# または、すべてのJavaプロセスを終了
killall java

# Emulatorを再起動
npm run emulator
```

---

### ケース4: 「Functions build error」

**原因**: TypeScriptのビルドエラー

**対処法**:
```bash
# Functionsフォルダに移動
cd backend/functions

# ビルドを実行
npm run build

# エラーが出る場合は、エラーメッセージを確認
# 型エラーなどが表示されます

# エラーを修正後、再度ビルド
npm run build

# ルートに戻る
cd ../..

# Emulatorを起動
npm run emulator
```

---

### ケース5: 「Node version mismatch」

**原因**: Node.jsのバージョンが古い

**対処法**:
```bash
# Node.jsのバージョンを確認
node --version
# v20.x.x と表示されるべき

# v20未満の場合はアップグレード
brew upgrade node@20

# または、新規インストール
brew install node@20

# 確認
node --version
```

---

### ケース6: 「firebase.json not found」

**原因**: Corevoフォルダにいない

**対処法**:
```bash
# 現在のディレクトリを確認
pwd

# Corevoフォルダに移動
cd ~/Desktop/Corevo

# 確認
ls firebase.json
# firebase.json が表示されればOK

# Emulatorを起動
npm run emulator
```

---

### ケース7: 「Permission denied」

**原因**: 権限の問題

**対処法**:
```bash
# npm キャッシュをクリア
sudo npm cache clean --force

# 再度インストール
npm install

# Emulatorを起動
npm run emulator
```

---

## 完全リセット手順（最終手段）

どうしても解決しない場合は、以下の手順で完全リセット：

```bash
# ステップ1: Emulatorを停止（Ctrl + C）

# ステップ2: node_modulesを削除
rm -rf node_modules
rm -rf apps/web/node_modules
rm -rf backend/functions/node_modules

# ステップ3: ビルド成果物を削除
rm -rf backend/functions/lib
rm -rf apps/web/.next

# ステップ4: Emulatorデータを削除
rm -rf emulator-data

# ステップ5: 再インストール
npm install

# ステップ6: Functionsをビルド
cd backend/functions
npm run build
cd ../..

# ステップ7: Emulatorを起動
npm run emulator

# ステップ8: 新しいターミナルでテストデータ投入
npm run emulator:seed

# ステップ9: 新しいターミナルでWeb起動
npm run dev:web
```

---

## デバッグモードで起動

より詳細なエラー情報を取得する場合:

```bash
# デバッグモードでEmulatorを起動
firebase emulators:start --debug --import=./emulator-data --export-on-exit
```

---

## 確認すべき環境

生徒さんに以下のコマンドを実行してもらい、結果を共有してもらってください:

```bash
# 環境情報を確認
echo "=== Node.js ==="
node --version

echo "=== npm ==="
npm --version

echo "=== Firebase CLI ==="
firebase --version

echo "=== 現在のディレクトリ ==="
pwd

echo "=== firebase.json の存在確認 ==="
ls firebase.json

echo "=== Functionsのビルド確認 ==="
ls backend/functions/lib/index.js

echo "=== package.json の存在確認 ==="
ls package.json
```

この結果を送ってもらえば、原因が特定できます。

---

## それでも解決しない場合

以下の情報を先生に共有してください:

1. **エラーメッセージの全文**（スクリーンショットでもOK）
2. **上記の環境情報**
3. **実行したコマンド**
4. **macOSのバージョン**

---

## よくある質問

### Q: Emulatorが起動したが、UIが開かない

A: ブラウザで以下のURLを手動で開いてください:
```
http://127.0.0.1:4000
```

### Q: Emulatorは起動したが、Webアプリが動かない

A: 別のターミナルで以下を実行:
```bash
npm run dev:web
```

### Q: ログインできない

A:
1. Emulatorが起動しているか確認
2. `.env.local` で `NEXT_PUBLIC_APP_ENV=dev` になっているか確認
3. テストデータを投入したか確認: `npm run emulator:seed`

---

## 成功時の画面

正常に起動すると、以下のように表示されます:

```
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://127.0.0.1:4000                │
└─────────────────────────────────────────────────────────────┘

┌────────────┬────────────────┬─────────────────────────────────┐
│ Emulator   │ Host:Port      │ View in Emulator UI             │
├────────────┼────────────────┼─────────────────────────────────┤
│ Auth       │ 0.0.0.0:9099   │ http://127.0.0.1:4000/auth      │
│ Functions  │ 0.0.0.0:5001   │ http://127.0.0.1:4000/functions │
│ Firestore  │ 0.0.0.0:8080   │ http://127.0.0.1:4000/firestore │
│ Storage    │ 0.0.0.0:9199   │ http://127.0.0.1:4000/storage   │
└────────────┴────────────────┴─────────────────────────────────┘
```

この表示が出たら成功です！
