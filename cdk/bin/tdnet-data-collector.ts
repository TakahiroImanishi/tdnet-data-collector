#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TdnetDataCollectorStack } from '../lib/tdnet-data-collector-stack';

const app = new cdk.App();

// Get environment from context or environment variable (default: 'dev')
const environment = (app.node.tryGetContext('environment') || 
                     process.env.ENVIRONMENT || 
                     'dev') as 'dev' | 'prod';

// Validate environment value
if (environment !== 'dev' && environment !== 'prod') {
  throw new Error(`Invalid environment: ${environment}. Must be 'dev' or 'prod'.`);
}

// Generate stack name with environment suffix
const stackName = `TdnetDataCollectorStack-${environment}`;

new TdnetDataCollectorStack(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
  description:
    `TDnet Data Collector - Serverless application for collecting disclosure information (${environment})`,
  tags: {
    Project: 'TdnetDataCollector',
    Environment: environment,
  },
  environmentConfig: {
    environment,
  },
});

app.synth();
