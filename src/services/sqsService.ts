import * as AWS from 'aws-sdk';

/**
 * Service class for AWS SQS operations
 */
export class SQSService {
    private sqs: AWS.SQS;
    
    /**
     * Initialize AWS SDK with the specified profile and region
     */
    constructor(profile: string, region: string) {
        const credentials = new AWS.SharedIniFileCredentials({ profile });
        AWS.config.credentials = credentials;
        AWS.config.update({ region });
        this.sqs = new AWS.SQS();
    }
    
    /**
     * Send a message to an SQS queue
     */
    async sendMessage(queueUrl: string, messageBody: any, messageAttributes?: any): Promise<AWS.SQS.SendMessageResult> {
        const params = {
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(messageBody),
            MessageAttributes: messageAttributes || {}
        };

        return await this.sqs.sendMessage(params).promise();
    }
    
    /**
     * Receive messages from an SQS queue
     */
    async receiveMessages(
        queueUrl: string, 
        maxMessages: number = 10, 
        visibilityTimeout: number = 30, 
        waitTimeSeconds: number = 0
    ): Promise<AWS.SQS.ReceiveMessageResult> {
        const params = {
            QueueUrl: queueUrl,
            MaxNumberOfMessages: maxMessages,
            VisibilityTimeout: visibilityTimeout,
            WaitTimeSeconds: waitTimeSeconds
        };

        return await this.sqs.receiveMessage(params).promise();
    }
    
    /**
     * Purge all messages from an SQS queue
     */
    async purgeQueue(queueUrl: string): Promise<{}> {
        const params = {
            QueueUrl: queueUrl
        };

        return await this.sqs.purgeQueue(params).promise();
    }
}