import * as vscode from 'vscode';
import { SQSCommand, SQSCommandType } from '../models/sqsTypes';

/**
 * Parse SQS commands from a document
 */
export function parseSQSCommands(document: vscode.TextDocument): SQSCommand[] {
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
                profile: vscode.workspace.getConfiguration('sqs-client').get('defaultProfile') || 'default',
                region: vscode.workspace.getConfiguration('sqs-client').get('defaultRegion') || 'us-east-1'
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