// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as AWS from 'aws-sdk';

/**
 * SQS Command type definition
 */
type SQSCommandType = 'SEND' | 'RECEIVE' | 'PURGE';

/**
 * Interface representing a parsed SQS command
 */
interface SQSCommand {
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

/**
 * CodeLens provider for SQS commands
 */
class SQSCommandCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        // Watch for changes in the editor
        vscode.workspace.onDidChangeTextDocument(_event => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        if (document.languageId !== 'sqs') {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();
        const commands = parseSQSCommands(document);

        for (const command of commands) {
            // Get the first line of the command
            const firstLine = command.range.start.line;
            const commandRange = new vscode.Range(
                new vscode.Position(firstLine, 0),
                new vscode.Position(firstLine, 0)
            );

            const title = `Send ${command.type} Command`;
            let commandId = '';
            
            switch (command.type) {
                case 'SEND':
                    commandId = 'aws-sqs-client.sendSQSCommand';
                    break;
                case 'RECEIVE':
                    commandId = 'aws-sqs-client.receiveSQSMessages';
                    break;
                case 'PURGE':
                    commandId = 'aws-sqs-client.purgeSQSQueue';
                    break;
            }

            const codeLens = new vscode.CodeLens(commandRange, {
                title,
                command: commandId,
                arguments: [command]
            });

            codeLenses.push(codeLens);
        }

        return codeLenses;
    }
}

/**
 * Parse SQS commands from a document
 */
function parseSQSCommands(document: vscode.TextDocument): SQSCommand[] {
    const text = document.getText();
    const lines = text.split('\n');
    const commands: SQSCommand[] = [];

    // A regex pattern to find command blocks with the queue URL on the same line
    const commandBlockPattern = /^(SEND|RECEIVE|PURGE)\s+([^\s]+)/;

    // Parameter patterns
    const profilePattern = /^profile\s*:\s*(.+)$/;
    const regionPattern = /^region\s*:\s*(.+)$/;
    const maxMessagesPattern = /^max-messages\s*:\s*(\d+)$/;
    const visibilityTimeoutPattern = /^visibility-timeout\s*:\s*(\d+)$/;
    const waitTimePattern = /^wait-time\s*:\s*(\d+)$/;
    
    let currentCommand: Partial<SQSCommand> | null = null;
    let commandBodyStartLine = -1;
    let commandBodyLines: string[] = [];
    let inJsonBody = false;
    let jsonStartLine = -1;
    let bracesCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines and comments
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        
        // Check if this line starts a new command
        const commandMatch = line.match(commandBlockPattern);
        if (commandMatch) {
            // If we were already parsing a command, add it to our list
            if (currentCommand && currentCommand.type && currentCommand.queueUrl) {
                finalizeCommand(currentCommand, commandBodyStartLine, i - 1, commandBodyLines);
                commands.push(currentCommand as SQSCommand);
                commandBodyLines = [];
            }
            
            // Start a new command
            const commandType = commandMatch[1] as SQSCommandType;
            const queueUrl = commandMatch[2];
            
            currentCommand = {
                type: commandType,
                queueUrl,
                // Default values that might be overridden
                profile: vscode.workspace.getConfiguration('awsSQSClient').get('defaultProfile') || 'default',
                region: vscode.workspace.getConfiguration('awsSQSClient').get('defaultRegion') || 'us-east-1'
            };
            
            commandBodyStartLine = i;
            inJsonBody = false;
            jsonStartLine = -1;
        }
        // Check if this line is a command parameter
        else if (currentCommand && !inJsonBody) {
            // Check for profile parameter
            const profileMatch = line.match(profilePattern);
            if (profileMatch) {
                currentCommand.profile = profileMatch[1].trim();
                continue;
            }
            
            // Check for region parameter
            const regionMatch = line.match(regionPattern);
            if (regionMatch) {
                currentCommand.region = regionMatch[1].trim();
                continue;
            }
            
            // For RECEIVE commands, check for optional parameters
            if (currentCommand.type === 'RECEIVE') {
                // Check for max-messages parameter
                const maxMessagesMatch = line.match(maxMessagesPattern);
                if (maxMessagesMatch) {
                    currentCommand.maxMessages = parseInt(maxMessagesMatch[1], 10);
                    continue;
                }
                
                // Check for visibility-timeout parameter
                const visibilityTimeoutMatch = line.match(visibilityTimeoutPattern);
                if (visibilityTimeoutMatch) {
                    currentCommand.visibilityTimeout = parseInt(visibilityTimeoutMatch[1], 10);
                    continue;
                }
                
                // Check for wait-time parameter
                const waitTimeMatch = line.match(waitTimePattern);
                if (waitTimeMatch) {
                    currentCommand.waitTimeSeconds = parseInt(waitTimeMatch[1], 10);
                    continue;
                }
            }
            
            // Check if this line starts a JSON body (for SEND commands)
            if (currentCommand.type === 'SEND' && line.startsWith('{')) {
                inJsonBody = true;
                jsonStartLine = i;
                bracesCount = 1; // We've seen one opening brace
                commandBodyLines.push(line);
            }
            // If it's the ### delimiter, end the current command
            else if (line === '###') {
                if (currentCommand && currentCommand.type && currentCommand.queueUrl) {
                    finalizeCommand(currentCommand, commandBodyStartLine, i, commandBodyLines);
                    commands.push(currentCommand as SQSCommand);
                    commandBodyLines = [];
                }
                
                // Reset for the next command
                currentCommand = null;
                commandBodyStartLine = -1;
                inJsonBody = false;
                jsonStartLine = -1;
            }
        }
        // If we're in a JSON body, keep track of braces to know when it ends
        else if (inJsonBody) {
            commandBodyLines.push(line);
            
            // Count braces to track nested JSON objects
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '{') {
                    bracesCount++;
                } else if (line[j] === '}') {
                    bracesCount--;
                }
            }
            
            // If we've closed all braces, we're done with the JSON body
            if (bracesCount === 0) {
                inJsonBody = false;
                
                // Try to parse the JSON body
                if (currentCommand && currentCommand.type === 'SEND') {
                    try {
                        const jsonBody = commandBodyLines.join('\n');
                        currentCommand.messageBody = JSON.parse(jsonBody);
                    } catch (error) {
                        console.error('Failed to parse message body as JSON:', error);
                    }
                }
            }
        }
    }
    
    // If we have a command at the end of the file without a ### marker
    if (currentCommand && currentCommand.type && currentCommand.queueUrl) {
        finalizeCommand(currentCommand, commandBodyStartLine, lines.length - 1, commandBodyLines);
        commands.push(currentCommand as SQSCommand);
    }
    
    return commands;
}

/**
 * Helper function to finalize command processing
 */
function finalizeCommand(command: Partial<SQSCommand>, startLine: number, endLine: number, bodyLines: string[]): void {
    // Set the range for the command
    command.range = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(endLine, 1000) // Using a large column number to ensure we get the full line
    );
    
    // For SEND commands, try to parse the JSON body if not already done
    if (command.type === 'SEND' && !command.messageBody && bodyLines.length > 0) {
        try {
            const jsonBody = bodyLines.join('\n');
            command.messageBody = JSON.parse(jsonBody);
        } catch (error) {
            console.error('Failed to parse message body as JSON:', error);
        }
    }
}

/**
 * Create and show a response output panel
 */
function createOutputPanel(): vscode.WebviewPanel {
    return vscode.window.createWebviewPanel(
        'sqsResponse',
        'SQS Response',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            localResourceRoots: []
        }
    );
}

/**
 * Initialize AWS SDK with the specified profile and region
 */
function initializeAWS(profile: string, region: string): AWS.SQS {
    const credentials = new AWS.SharedIniFileCredentials({ profile });
    AWS.config.credentials = credentials;
    AWS.config.update({ region });
    return new AWS.SQS();
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('AWS SQS Client extension is now active!');

    // Register the CodeLens provider
    const codeLensProvider = new SQSCommandCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ language: 'sqs', scheme: 'file' }, codeLensProvider)
    );

    // Register the SEND command
    const sendCommand = vscode.commands.registerCommand('aws-sqs-client.sendSQSCommand', async (command: SQSCommand) => {
        try {
            vscode.window.showInformationMessage(`Sending message to ${command.queueUrl}`);

            const sqs = initializeAWS(command.profile, command.region);
            
            if (!command.messageBody) {
                vscode.window.showErrorMessage('No message body provided for SEND command');
                return;
            }

            const params = {
                QueueUrl: command.queueUrl,
                MessageBody: JSON.stringify(command.messageBody),
                MessageAttributes: command.messageAttributes || {}
            };

            const result = await sqs.sendMessage(params).promise();
            
            const panel = createOutputPanel();
            panel.webview.html = getHtmlForResponse('SEND', result);
            
            vscode.window.showInformationMessage(`Message sent successfully: ${result.MessageId}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error sending message: ${error.message}`);
            console.error('Error sending message:', error);
        }
    });

    // Register the RECEIVE command
    const receiveCommand = vscode.commands.registerCommand('aws-sqs-client.receiveSQSMessages', async (command: SQSCommand) => {
        try {
            vscode.window.showInformationMessage(`Receiving messages from ${command.queueUrl}`);
            
            const sqs = initializeAWS(command.profile, command.region);
            
            const params = {
                QueueUrl: command.queueUrl,
                MaxNumberOfMessages: command.maxMessages || 10,
                VisibilityTimeout: command.visibilityTimeout || 30,
                WaitTimeSeconds: command.waitTimeSeconds || 0
            };

            const result = await sqs.receiveMessage(params).promise();
            
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
    const purgeCommand = vscode.commands.registerCommand('aws-sqs-client.purgeSQSQueue', async (command: SQSCommand) => {
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
            
            const sqs = initializeAWS(command.profile, command.region);
            
            const params = {
                QueueUrl: command.queueUrl
            };

            await sqs.purgeQueue(params).promise();
            
            vscode.window.showInformationMessage(`Queue ${command.queueUrl} purged successfully`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error purging queue: ${error.message}`);
            console.error('Error purging queue:', error);
        }
    });

    // Add commands to subscriptions
    context.subscriptions.push(sendCommand, receiveCommand, purgeCommand);
}

/**
 * Generate HTML to display SQS response
 */
function getHtmlForResponse(type: string, response: any): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SQS ${type} Response</title>
        <style>
            body {
                font-family: var(--vscode-editor-font-family);
                font-size: var(--vscode-editor-font-size);
                color: var(--vscode-editor-foreground);
                background-color: var(--vscode-editor-background);
                padding: 10px;
            }
            pre {
                background-color: var(--vscode-textCodeBlock-background);
                padding: 10px;
                border-radius: 5px;
                overflow: auto;
            }
            .message {
                margin-bottom: 20px;
                padding: 10px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 5px;
            }
            .message-header {
                font-weight: bold;
                margin-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <h1>SQS ${type} Response</h1>
        <pre>${JSON.stringify(response, null, 2)}</pre>
        ${type === 'RECEIVE' && response.Messages && response.Messages.length > 0 ? 
            `<h2>Messages</h2>
            ${response.Messages.map((msg: any, index: number) => `
                <div class="message">
                    <div class="message-header">Message ${index + 1} (ID: ${msg.MessageId})</div>
                    <pre>${formatMessageBody(msg.Body)}</pre>
                </div>
            `).join('')}` 
            : ''}
    </body>
    </html>
    `;
}

/**
 * Attempt to format message body as JSON if possible
 */
function formatMessageBody(body: string): string {
    try {
        const parsed = JSON.parse(body);
        return JSON.stringify(parsed, null, 2);
    } catch (e) {
        // If it's not valid JSON, return as is
        return body;
    }
}

// This method is called when your extension is deactivated
export function deactivate() {}
