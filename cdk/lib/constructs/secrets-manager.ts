import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Secrets Manager Construct Properties
 */
export interface SecretsManagerConstructProps {
  /**
   * 環境名（dev, staging, prod）
   */
  environment: string;

  /**
   * ローテーションを有効化するかどうか（デフォルト: true）
   */
  enableRotation?: boolean;

  /**
   * ローテーション間隔（日数、デフォルト: 90日）
   */
  rotationDays?: number;
}

/**
 * Secrets Manager Construct
 * 
 * TDnet Data CollectorプロジェクトのAPIキーを安全に管理するための
 * AWS Secrets Managerリソースを定義します。
 * 
 * 機能:
 * - /tdnet/api-key シークレットの作成
 * - Lambda関数へのシークレット読み取り権限付与
 * - 自動ローテーション設定（Phase 4で実装予定）
 */
export class SecretsManagerConstruct extends Construct {
  /**
   * APIキーシークレット
   * 
   * シークレット名: /tdnet/api-key
   * フォーマット: { "apiKey": "your-api-key-here" }
   */
  public readonly apiKeySecret: secretsmanager.Secret;

  /**
   * ローテーション用Lambda関数（ローテーション有効時のみ）
   */
  public readonly rotationFunction?: lambda.Function;

  constructor(scope: Construct, id: string, props: SecretsManagerConstructProps) {
    super(scope, id);

    const { environment, enableRotation = true, rotationDays = 90 } = props;

    // APIキーシークレット作成
    this.apiKeySecret = new secretsmanager.Secret(this, 'ApiKeySecret', {
      secretName: '/tdnet/api-key',
      description: 'TDnet API Key for authentication',
      // シークレット値の初期生成設定
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ apiKey: '' }),
        generateStringKey: 'apiKey',
        excludePunctuation: true,
        passwordLength: 32,
      },
      // 暗号化設定（AWS管理キーを使用）
      encryptionKey: undefined, // デフォルトのAWS管理キーを使用
      // 削除保護設定
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 本番環境では削除保護
    });

    // 自動ローテーション設定（Phase 4実装）
    if (enableRotation) {
      // ローテーション用Lambda関数を作成
      this.rotationFunction = new lambda.Function(this, 'RotationFunction', {
        functionName: `tdnet-api-key-rotation-${environment}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset('dist/src/lambda/api-key-rotation'),
        timeout: cdk.Duration.seconds(30),
        memorySize: 128,
        environment: {
          LOG_LEVEL: 'info',
          ENVIRONMENT: environment,
          NODE_OPTIONS: '--enable-source-maps',
        },
      });

      // ローテーション関数にSecrets Manager権限を付与
      this.apiKeySecret.grantRead(this.rotationFunction);
      this.apiKeySecret.grantWrite(this.rotationFunction);

      // 自動ローテーションスケジュールを設定
      this.apiKeySecret.addRotationSchedule('RotationSchedule', {
        rotationLambda: this.rotationFunction,
        automaticallyAfter: cdk.Duration.days(rotationDays), // 90日ごとにローテーション
      });
    }
  }

  /**
   * Lambda関数にシークレット読み取り権限を付与
   * 
   * @param lambdaFunction - シークレットにアクセスするLambda関数
   * 
   * 使用例:
   * ```typescript
   * const secretsManager = new SecretsManagerConstruct(this, 'SecretsManager');
   * secretsManager.grantRead(queryLambda);
   * secretsManager.grantRead(exportLambda);
   * ```
   */
  public grantRead(lambdaFunction: lambda.Function): void {
    this.apiKeySecret.grantRead(lambdaFunction);
  }

  /**
   * シークレットARNを取得
   * 
   * Lambda関数の環境変数に設定する際に使用します。
   * 
   * @returns シークレットARN
   */
  public getSecretArn(): string {
    return this.apiKeySecret.secretArn;
  }

  /**
   * シークレット値を取得（CDK内部でのみ使用）
   * 
   * 注意: この値は環境変数に直接設定しないでください。
   * Lambda関数内でAWS SDKを使用してシークレット値を取得してください。
   * 
   * @returns シークレット値（SecretValue型）
   */
  public getSecretValue(): any {
    return this.apiKeySecret.secretValue;
  }
}
