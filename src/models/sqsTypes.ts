import * as vscode from 'vscode';

/**
 * SQS Command type definition
 */
export type SQSCommandType = 'SEND' | 'RECEIVE' | 'PURGE';

/**
 * Interface representing a parsed SQS command
 */
export interface SQSCommand {
    type: SQSCommandType;
    queueUrl: string;
    profile: string;
    region: string;
    messageBody?: any;
    messageAttributes?: any;
    maxMessages?: number;
    visibilityTimeout?: number;
    waitTimeSeconds?: number;
    range: vscode.Range;
}