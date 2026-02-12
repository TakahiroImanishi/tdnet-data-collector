/**
 * APIキーローテーション Lambda関数
 * 
 * Secrets Managerの自動ローテーション機能により90日ごとに呼び出され、
 * TDnet APIキーを新しい値に更新します。
 * 
 * ローテーションステップ:
 * 1. createSecret: 新しいシークレット値を生成
 * 2. setSecret: 新しいシークレット値を設定
 * 3. testSecret: 新しいシークレット値をテスト
 * 4. finishSecret: ローテーションを完了
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  DescribeSecretCommand,
  UpdateSecretVersionStageCommand,
} from '@aws-sdk/client-secrets-manager';
import { logger } from '../../utils/logger';

const secretsManager = new SecretsManagerClient({});

/**
 * Lambda handler
 */
export const handler = async (event: any): Promise<void> => {
  logger.info('APIキーローテーション開始', { event });

  const { SecretId, Token, Step } = event;

  try {
    switch (Step) {
      case 'createSecret':
        await createSecret(SecretId, Token);
        break;
      case 'setSecret':
        await setSecret(SecretId, Token);
        break;
      case 'testSecret':
        await testSecret(SecretId, Token);
        break;
      case 'finishSecret':
        await finishSecret(SecretId, Token);
        break;
      default:
        throw new Error(`不明なローテーションステップ: ${Step}`);
    }

    logger.info('APIキーローテーション完了', { SecretId, Step });
  } catch (error) {
    logger.error('APIキーローテーション失敗', {
      error_type: error instanceof Error ? error.name : 'UnknownError',
      error_message: error instanceof Error ? error.message : String(error),
      context: { SecretId, Token, Step },
      stack_trace: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

/**
 * ステップ1: 新しいシークレット値を生成
 */
async function createSecret(secretId: string, token: string): Promise<void> {
  logger.info('createSecret開始', { secretId, token });

  // 現在のシークレット値を取得
  const describeCommand = new DescribeSecretCommand({ SecretId: secretId });
  const describeResponse = await secretsManager.send(describeCommand);

  // 既にPENDINGバージョンが存在する場合はスキップ
  if (describeResponse.VersionIdsToStages?.[token]?.includes('AWSPENDING')) {
    logger.info('PENDINGバージョン既存、スキップ', { token });
    return;
  }

  // 新しいAPIキーを生成（32文字のランダム文字列）
  const newApiKey = generateRandomApiKey(32);

  // 新しいシークレット値を設定
  const putCommand = new PutSecretValueCommand({
    SecretId: secretId,
    ClientRequestToken: token,
    SecretString: JSON.stringify({ apiKey: newApiKey }),
    VersionStages: ['AWSPENDING'],
  });

  await secretsManager.send(putCommand);
  logger.info('新しいシークレット値を生成', { token });
}

/**
 * ステップ2: 新しいシークレット値を設定
 * 
 * 注: TDnet APIキーは外部サービスのため、実際のAPI更新は手動で行う必要があります。
 * このステップでは、新しい値が正しく保存されていることを確認するのみです。
 */
async function setSecret(secretId: string, token: string): Promise<void> {
  logger.info('setSecret開始', { secretId, token });

  // PENDINGバージョンのシークレット値を取得して確認
  const getCommand = new GetSecretValueCommand({
    SecretId: secretId,
    VersionId: token,
    VersionStage: 'AWSPENDING',
  });

  const response = await secretsManager.send(getCommand);
  
  if (!response.SecretString) {
    throw new Error('シークレット値が見つかりません');
  }

  const secretValue = JSON.parse(response.SecretString);
  
  if (!secretValue.apiKey || secretValue.apiKey.length < 16) {
    throw new Error('無効なAPIキー形式');
  }

  logger.info('シークレット値の設定を確認', { token });
}

/**
 * ステップ3: 新しいシークレット値をテスト
 * 
 * 注: TDnet APIへの実際の接続テストは、手動でAPIキーを更新した後に行う必要があります。
 * このステップでは、シークレット値の形式が正しいことのみを確認します。
 */
async function testSecret(secretId: string, token: string): Promise<void> {
  logger.info('testSecret開始', { secretId, token });

  // PENDINGバージョンのシークレット値を取得
  const getCommand = new GetSecretValueCommand({
    SecretId: secretId,
    VersionId: token,
    VersionStage: 'AWSPENDING',
  });

  const response = await secretsManager.send(getCommand);
  
  if (!response.SecretString) {
    throw new Error('シークレット値が見つかりません');
  }

  const secretValue = JSON.parse(response.SecretString);
  
  // APIキー形式の検証
  if (!secretValue.apiKey || typeof secretValue.apiKey !== 'string') {
    throw new Error('無効なAPIキー形式');
  }

  if (secretValue.apiKey.length < 16) {
    throw new Error('APIキーが短すぎます（最低16文字必要）');
  }

  logger.info('シークレット値のテスト完了', { token });
  
  // 注: 実際のTDnet API接続テストは手動で行う必要があります
  logger.warn('TDnet APIキーの手動更新が必要です', {
    message: '新しいAPIキーをTDnetポータルで更新してください',
    newApiKey: secretValue.apiKey,
  });
}

/**
 * ステップ4: ローテーションを完了
 */
async function finishSecret(secretId: string, token: string): Promise<void> {
  logger.info('finishSecret開始', { secretId, token });

  // 現在のバージョン情報を取得
  const describeCommand = new DescribeSecretCommand({ SecretId: secretId });
  const describeResponse = await secretsManager.send(describeCommand);

  let currentVersion: string | undefined;
  
  // CURRENTバージョンを見つける
  for (const [versionId, stages] of Object.entries(describeResponse.VersionIdsToStages || {})) {
    if (stages.includes('AWSCURRENT')) {
      currentVersion = versionId;
      break;
    }
  }

  // PENDINGをCURRENTに昇格
  const updateCommand = new UpdateSecretVersionStageCommand({
    SecretId: secretId,
    VersionStage: 'AWSCURRENT',
    MoveToVersionId: token,
    RemoveFromVersionId: currentVersion,
  });

  await secretsManager.send(updateCommand);
  logger.info('ローテーション完了、PENDINGをCURRENTに昇格', { token, previousVersion: currentVersion });
}

/**
 * ランダムなAPIキーを生成
 */
function generateRandomApiKey(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // crypto.randomBytesを使用してセキュアなランダム文字列を生成
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
}
