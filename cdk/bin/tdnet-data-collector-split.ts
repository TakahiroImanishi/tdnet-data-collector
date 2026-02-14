#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import { TdnetFoundationStack } from '../lib/stacks/foundation-stack';
import { TdnetComputeStack } from '../lib/stacks/compute-stack';
import { TdnetApiStack } from '../lib/stacks/api-stack';
import { TdnetMonitoringStack } from '../lib/stacks/monitoring-stack';
import { Environment } from '../lib/config/environment-config';

const app = new cdk.App();

// Get environment from context or environment variable (default: 'dev')
const environment = (app.node.tryGetContext('environment') || 
                     process.env.ENVIRONMENT || 
                     'dev') as Environment;

// Validate environment value
if (environment !== 'dev' && environment !== 'prod') {
  throw new Error(`Invalid environment: ${environment}. Must be 'dev' or 'prod'.`);
}

// Common stack properties
const commonProps: cdk.StackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
  tags: {
    Project: 'TdnetDataCollector',
    Environment: environment,
  },
};

// ========================================
// Stack 1: Foundation (基盤層)
// ========================================
const foundationStack = new TdnetFoundationStack(app, `TdnetFoundation-${environment}`, {
  ...commonProps,
  environment,
  description: `TDnet Data Collector - Foundation Stack (${environment})`,
});

// ========================================
// SNS Topic for Alerts (Compute Stackより前に作成)
// ========================================
const alertTopic = new sns.Topic(foundationStack, 'AlertTopic', {
  displayName: `TDnet Alerts - ${environment}`,
  topicName: `tdnet-alerts-${environment}`,
});

new cdk.CfnOutput(foundationStack, 'AlertTopicArn', {
  value: alertTopic.topicArn,
  description: 'SNS Topic ARN for alerts',
  exportName: `TdnetAlertTopicArn-${environment}`,
});

// ========================================
// Stack 2: Compute (コンピュート層)
// ========================================
const computeStack = new TdnetComputeStack(app, `TdnetCompute-${environment}`, {
  ...commonProps,
  environment,
  description: `TDnet Data Collector - Compute Stack (${environment})`,
  disclosuresTable: foundationStack.disclosuresTable,
  executionsTable: foundationStack.executionsTable,
  exportStatusTable: foundationStack.exportStatusTable,
  pdfsBucket: foundationStack.pdfsBucket,
  exportsBucket: foundationStack.exportsBucket,
  apiKeySecret: foundationStack.secretsManager.apiKeySecret,
  alertTopic,
});

// Compute StackはFoundation Stackに依存
computeStack.addDependency(foundationStack);

// ========================================
// Stack 3: API (API層)
// ========================================
const apiStack = new TdnetApiStack(app, `TdnetApi-${environment}`, {
  ...commonProps,
  environment,
  description: `TDnet Data Collector - API Stack (${environment})`,
  queryFunction: computeStack.queryFunction,
  exportFunction: computeStack.exportFunction,
  collectFunction: computeStack.collectFunction,
  collectStatusFunction: computeStack.collectStatusFunction,
  exportStatusFunction: computeStack.exportStatusFunction,
  pdfDownloadFunction: computeStack.pdfDownloadFunction,
  dashboardBucket: foundationStack.dashboardBucket,
});

// API StackはCompute Stackに依存
apiStack.addDependency(computeStack);

// ========================================
// Stack 4: Monitoring (監視層)
// ========================================
const monitoringStack = new TdnetMonitoringStack(app, `TdnetMonitoring-${environment}`, {
  ...commonProps,
  environment,
  description: `TDnet Data Collector - Monitoring Stack (${environment})`,
  lambdaFunctions: {
    collector: computeStack.collectorFunction,
    query: computeStack.queryFunction,
    export: computeStack.exportFunction,
    collect: computeStack.collectFunction,
    collectStatus: computeStack.collectStatusFunction,
    exportStatus: computeStack.exportStatusFunction,
    pdfDownload: computeStack.pdfDownloadFunction,
  },
  dynamodbTables: {
    disclosures: foundationStack.disclosuresTable,
    executions: foundationStack.executionsTable,
    exportStatus: foundationStack.exportStatusTable,
  },
  s3Buckets: {
    pdfs: foundationStack.pdfsBucket,
    exports: foundationStack.exportsBucket,
    cloudtrailLogs: foundationStack.cloudtrailLogsBucket,
  },
  api: apiStack.api,
  alertTopic,
});

// Monitoring StackはAPI Stackに依存
monitoringStack.addDependency(apiStack);

app.synth();
