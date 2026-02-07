#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TdnetDataCollectorStack } from '../lib/tdnet-data-collector-stack';

const app = new cdk.App();

new TdnetDataCollectorStack(app, 'TdnetDataCollectorStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
  description: 'TDnet Data Collector - Serverless application for collecting disclosure information',
  tags: {
    Project: 'TdnetDataCollector',
    Environment: process.env.ENVIRONMENT || 'dev',
  },
});

app.synth();
