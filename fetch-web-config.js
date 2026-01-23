/**
 * Firebase Web App Configuration取得スクリプト (Management API使用)
 *
 * 必要: npm install googleapis
 */

const { google } = require('googleapis');
const fs = require('fs');

async function getWebAppConfig() {
  try {
    // Service Accountを読み込む
    const serviceAccount = JSON.parse(fs.readFileSync('./service-account-key.json', 'utf8'));
    const projectId = serviceAccount.project_id;

    // Google Auth
    const auth = new google.auth.GoogleAuth({
      keyFile: './service-account-key.json',
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const authClient = await auth.getClient();

    // Firebase Management API
    const firebase = google.firebase({
      version: 'v1beta1',
      auth: authClient
    });

    console.log('Fetching web apps...\n');

    // Webアプリ一覧を取得
    const webApps = await firebase.projects.webApps.list({
      parent: `projects/${projectId}`
    });

    if (!webApps.data.apps || webApps.data.apps.length === 0) {
      console.log('⚠️  Webアプリが見つかりません。');
      console.log('\nFirebase Consoleで新しいWebアプリを作成してください:');
      console.log(`1. https://console.firebase.google.com/project/${projectId}/settings/general`);
      console.log('2. "Your apps" セクションで "Add app" > Web (</>)');
      console.log('3. アプリ名を入力 (例: "Corevo Web")');
      console.log('4. 作成後、このスクリプトを再実行してください\n');
      return;
    }

    // 最初のWebアプリの設定を取得
    const webApp = webApps.data.apps[0];
    const appId = webApp.appId;

    console.log(`Found web app: ${webApp.displayName || 'Unnamed'} (${appId})\n`);

    // Web アプリの設定を取得
    const config = await firebase.projects.webApps.getConfig({
      name: `${webApp.name}/config`
    });

    const webConfig = config.data;

    console.log('========================================');
    console.log('Firebase Web App Configuration');
    console.log('========================================\n');

    const envContent = `# Firebase Web SDK Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=${webConfig.apiKey}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${webConfig.authDomain}
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${webConfig.projectId}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${webConfig.storageBucket}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${webConfig.messagingSenderId}
NEXT_PUBLIC_FIREBASE_APP_ID=${appId}

# Stripe Public Key (test key - 後で実際の値に置き換えてください)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51placeholder

# Application Environment
NEXT_PUBLIC_APP_ENV=dev
`;

    console.log(envContent);

    // .env.localに保存
    const envPath = './apps/web/.env.local';
    fs.writeFileSync(envPath, envContent);

    console.log('========================================');
    console.log(`✓ 設定を ${envPath} に保存しました！`);
    console.log('========================================\n');

  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('googleapis')) {
      console.log('\n📦 必要なパッケージをインストールしてください:');
      console.log('npm install googleapis');
    }
  }
}

getWebAppConfig();
