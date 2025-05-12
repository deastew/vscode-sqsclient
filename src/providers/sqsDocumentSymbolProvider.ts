import * as vscode from 'vscode';
import { SQSCommandType } from '../models/sqsTypes';
import { parseSQSCommands } from '../utils/commandParser';

/**
 * Document Symbol Provider for SQS commands
 * Provides document symbols for outline view and breadcrumb navigation
 */
export class SQSDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        if (document.languageId !== 'sqs') {
            return [];
        }

        const symbols: vscode.DocumentSymbol[] = [];
        const commands = parseSQSCommands(document);
        const text = document.getText();
        const lines = text.split('\n');

        for (const command of commands) {
            const startLine = command.range.start.line;
            const endLine = command.range.end.line;
            
            // Get the first line of the command which contains the command type and queue URL
            const firstLine = lines[startLine];
            
            // Create symbol for the command
            const commandSymbol = new vscode.DocumentSymbol(
                `${command.type} ${command.queueUrl.split('/').pop()}`,
                `Queue: ${command.queueUrl}`,
                this.getSymbolKindForCommandType(command.type),
                command.range,
                new vscode.Range(
                    new vscode.Position(startLine, 0),
                    new vscode.Position(startLine, firstLine.length)
                )
            );
            
            // Add child symbols for parameters
            this.addParameterSymbols(commandSymbol, command, document, lines, startLine, endLine);
            
            symbols.push(commandSymbol);
        }

        return symbols;
    }
    
    /**
     * Returns the symbol kind based on the command type
     */
    private getSymbolKindForCommandType(type: SQSCommandType): vscode.SymbolKind {
        switch (type) {
            case 'SEND':
                return vscode.SymbolKind.Function;
            case 'RECEIVE':
                return vscode.SymbolKind.Event;
            case 'PURGE':
                return vscode.SymbolKind.Interface;
            default:
                return vscode.SymbolKind.Module;
        }
    }
    
    /**
     * Adds parameter symbols as children of a command symbol
     */
    private addParameterSymbols(
        commandSymbol: vscode.DocumentSymbol,
        command: any,
        document: vscode.TextDocument,
        lines: string[],
        startLine: number,
        endLine: number
    ): void {
        // Check each line for parameters
        for (let i = startLine + 1; i <= endLine; i++) {
            const line = lines[i]?.trim();
            
            if (!line || line === '###' || line.startsWith('#')) {
                continue;
            }
            
            // Parameter patterns
            if (line.startsWith('profile:')) {
                this.addParameterSymbol(commandSymbol, 'Profile', command.profile, document, i, vscode.SymbolKind.Constant);
            } else if (line.startsWith('region:')) {
                this.addParameterSymbol(commandSymbol, 'Region', command.region, document, i, vscode.SymbolKind.Constant);
            } else if (line.startsWith('max-messages:')) {
                this.addParameterSymbol(commandSymbol, 'Max Messages', command.maxMessages?.toString() || '', document, i, vscode.SymbolKind.Number);
            } else if (line.startsWith('visibility-timeout:')) {
                this.addParameterSymbol(commandSymbol, 'Visibility Timeout', command.visibilityTimeout?.toString() || '', document, i, vscode.SymbolKind.Number);
            } else if (line.startsWith('wait-time:')) {
                this.addParameterSymbol(commandSymbol, 'Wait Time', command.waitTimeSeconds?.toString() || '', document, i, vscode.SymbolKind.Number);
            } else if (line.startsWith('{') && command.type === 'SEND') {
                // Find the end of the JSON body
                let jsonEndLine = i;
                let bracesCount = 1;
                
                for (let j = i + 1; j <= endLine; j++) {
                    const jsonLine = lines[j];
                    for (let k = 0; k < jsonLine.length; k++) {
                        if (jsonLine[k] === '{') {
                            bracesCount++;
                        } else if (jsonLine[k] === '}') {
                            bracesCount--;
                        }
                    }
                    
                    if (bracesCount === 0) {
                        jsonEndLine = j;
                        break;
                    }
                }
                
                // Add JSON body as a symbol
                const jsonBodySymbol = new vscode.DocumentSymbol(
                    'Message Body',
                    'JSON Payload',
                    vscode.SymbolKind.Object,
                    new vscode.Range(
                        new vscode.Position(i, 0),
                        new vscode.Position(jsonEndLine, lines[jsonEndLine].length)
                    ),
                    new vscode.Range(
                        new vscode.Position(i, 0),
                        new vscode.Position(i, lines[i].length)
                    )
                );
                
                commandSymbol.children.push(jsonBodySymbol);
                
                // Skip ahead to avoid processing the JSON lines again
                i = jsonEndLine;
            }
        }
    }
    
    /**
     * Adds a parameter symbol as a child of a command symbol
     */
    private addParameterSymbol(
        commandSymbol: vscode.DocumentSymbol,
        name: string,
        detail: string,
        document: vscode.TextDocument,
        line: number,
        kind: vscode.SymbolKind
    ): void {
        const lineText = document.lineAt(line).text;
        const paramSymbol = new vscode.DocumentSymbol(
            name,
            detail,
            kind,
            new vscode.Range(
                new vscode.Position(line, 0),
                new vscode.Position(line, lineText.length)
            ),
            new vscode.Range(
                new vscode.Position(line, 0),
                new vscode.Position(line, name.length)
            )
        );
        
        commandSymbol.children.push(paramSymbol);
    }
}