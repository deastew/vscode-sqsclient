import * as vscode from 'vscode';
import { SQSCommand } from '../models/sqsTypes';
import { parseSQSCommands } from '../utils/commandParser';

/**
 * CodeLens provider for SQS commands
 */
export class SQSCommandCodeLensProvider implements vscode.CodeLensProvider {
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
        const commands = parseSQSCommands(document);

        for (const command of commands) {
            // Get the first line of the command
            const firstLine = command.range.start.line;
            const commandRange = new vscode.Range(
                new vscode.Position(firstLine, 0),
                new vscode.Position(firstLine, 0)
            );

            const title = `Send Request`;
            let commandId = '';
            
            switch (command.type) {
                case 'SEND':
                    commandId = 'sqs-client.sendSQSCommand';
                    break;
                case 'RECEIVE':
                    commandId = 'sqs-client.receiveSQSMessages';
                    break;
                case 'PURGE':
                    commandId = 'sqs-client.purgeSQSQueue';
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