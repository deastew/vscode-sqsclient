import * as vscode from 'vscode';
import { SQSCommand } from './models/sqsTypes';
import { SQSCommandCodeLensProvider } from './providers/sqsCodeLensProvider';
import { SQSService } from './services/sqsService';
import { createOutputPanel, getHtmlForResponse } from './views/responseView';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('AWS SQS Client extension is now active!');

    // Register the CodeLens provider
    const codeLensProvider = new SQSCommandCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ language: 'sqs', scheme: 'file' }, codeLensProvider)
    );

    // Register the SEND command
    const sendCommand = vscode.commands.registerCommand('sqs-client.sendSQSCommand', async (command: SQSCommand) => {
        try {
            vscode.window.showInformationMessage(`Sending message to ${command.queueUrl}`);

            const sqsService = new SQSService(command.profile, command.region);
            
            if (!command.messageBody) {
                vscode.window.showErrorMessage('No message body provided for SEND command');
                return;
            }

            const result = await sqsService.sendMessage(
                command.queueUrl,
                command.messageBody,
                command.messageAttributes
            );
            
            const panel = createOutputPanel();
            panel.webview.html = getHtmlForResponse('SEND', result);
            
            vscode.window.showInformationMessage(`Message sent successfully: ${result.MessageId}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error sending message: ${error.message}`);
            console.error('Error sending message:', error);
        }
    });

    // Register the RECEIVE command
    const receiveCommand = vscode.commands.registerCommand('sqs-client.receiveSQSMessages', async (command: SQSCommand) => {
        try {
            vscode.window.showInformationMessage(`Receiving messages from ${command.queueUrl}`);
            
            const sqsService = new SQSService(command.profile, command.region);
            
            const result = await sqsService.receiveMessages(
                command.queueUrl,
                command.maxMessages || 10,
                command.visibilityTimeout || 30,
                command.waitTimeSeconds || 0
            );
            
            const panel = createOutputPanel();
            panel.webview.html = getHtmlForResponse('RECEIVE', result);
            
            if (result.Messages && result.Messages.length > 0) {
                vscode.window.showInformationMessage(`Received ${result.Messages.length} message(s)`);
            } else {
                vscode.window.showInformationMessage('No messages available');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error receiving messages: ${error.message}`);
            console.error('Error receiving messages:', error);
        }
    });

    // Register the PURGE command
    const purgeCommand = vscode.commands.registerCommand('sqs-client.purgeSQSQueue', async (command: SQSCommand) => {
        try {
            // Show a confirmation dialog
            const confirmation = await vscode.window.showWarningMessage(
                `Are you sure you want to purge all messages from ${command.queueUrl}?`,
                { modal: true },
                'Yes', 'No'
            );
            
            if (confirmation !== 'Yes') {
                return;
            }
            
            vscode.window.showInformationMessage(`Purging queue ${command.queueUrl}`);
            
            const sqsService = new SQSService(command.profile, command.region);
            await sqsService.purgeQueue(command.queueUrl);
            
            vscode.window.showInformationMessage(`Queue ${command.queueUrl} purged successfully`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error purging queue: ${error.message}`);
            console.error('Error purging queue:', error);
        }
    });

    // Add commands to subscriptions
    context.subscriptions.push(sendCommand, receiveCommand, purgeCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
