# GitHubにプロジェクトをアップロードする手順

## ステップ1: GitHubでリポジトリを作成

1. https://github.com にアクセスしてログイン
2. 右上の「+」→「New repository」をクリック
3. 以下を入力:
   - **Repository name**: `Corevo`
   - **Private** を選択
   - **「Initialize this repository with a README」はチェックしない**
4. 「Create repository」をクリック

## ステップ2: リモートリポジトリを追加

GitHubで作成したリポジトリのURLをコピーして、以下のコマンドを実行:

```bash
# Corevoフォルダにいることを確認
cd ~/Desktop/Corevo  # Windowsの場合: cd /mnt/c/Users/user/Desktop/Corevo

# GitHubのリモートリポジトリを追加（URLは自分のものに変更）
git remote add origin https://github.com/あなたのユーザー名/Corevo.git

# 確認
git remote -v
# origin  https://github.com/あなたのユーザー名/Corevo.git (fetch)
# origin  https://github.com/あなたのユーザー名/Corevo.git (push)
```

## ステップ3: GitHubにプッシュ

```bash
# 現在のブランチを確認
git branch

# mainブランチにいない場合は、ブランチ名を変更
git branch -M master

# GitHubにアップロード
git push -u origin master
```

## ステップ4: 生徒さんを Collaborator に追加

1. GitHubのリポジトリページを開く
2. 「Settings」→「Collaborators」
3. 「Add people」をクリック
4. 生徒さんのGitHubユーザー名を入力
5. 生徒さんに招待メールが届くので、承認してもらう

## 生徒さんがクローンする手順

生徒さんは以下のコマンドでプロジェクトを取得できます:

```bash
# Macの場合
cd ~/Desktop
git clone https://github.com/あなたのユーザー名/Corevo.git
cd Corevo
npm install
```

以降は、前のセットアップガイドに従ってください。
