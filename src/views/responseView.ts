import * as vscode from 'vscode';

/**
 * Create and show a response output panel
 */
export function createOutputPanel(): vscode.WebviewPanel {
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
 * Generate HTML to display SQS response
 */
export function getHtmlForResponse(type: string, response: any): string {
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
export function formatMessageBody(body: string): string {
    try {
        const parsed = JSON.parse(body);
        return JSON.stringify(parsed, null, 2);
    } catch (e) {
        // If it's not valid JSON, return as is
        return body;
    }
}