# AWS SQS Client for VS Code

This extension allows you to send, receive, and purge messages from Amazon SQS queues directly within VS Code, similar to the popular REST Client extension.

## Features

- Send messages to SQS queues
- Receive messages from SQS queues with configurable options
- Purge all messages from a queue
- CodeLens support for easy execution of commands
- Configure AWS profiles and regions for different commands
- View responses in a dedicated panel with syntax highlighting

## Usage

Create `.sqs` files in your workspace and define SQS commands as follows:

### Format

```
COMMAND QUEUE_URL
profile: PROFILE_NAME
region: REGION_NAME
[command-specific parameters]

[message body for SEND commands]
###
```

The `###` delimiter is used to separate multiple commands in a single file.

### Commands

#### SEND

Sends a JSON message to an SQS queue.

```
SEND https://sqs.region.amazonaws.com/account-id/queue-name
profile: my-profile
region: us-east-1

{
  "message": "Hello, SQS!",
  "timestamp": "2025-05-10T12:00:00Z"
}
###
```

#### RECEIVE

Receives messages from an SQS queue with optional parameters.

```
RECEIVE https://sqs.region.amazonaws.com/account-id/queue-name
profile: my-profile
region: us-east-1
max-messages: 5
visibility-timeout: 60
wait-time: 10
###
```

Available options:
- `max-messages`: Maximum number of messages to retrieve (default: 10)
- `visibility-timeout`: Visibility timeout in seconds (default: 30)
- `wait-time`: Long polling wait time in seconds (default: 0)

#### PURGE

Purges all messages from an SQS queue. A confirmation dialog will be shown before purging.

```
PURGE https://sqs.region.amazonaws.com/account-id/queue-name
profile: my-profile
region: us-east-1
###
```

### Default Settings

You can configure default AWS profile and region in your VS Code settings:

```json
{
  "awsSQSClient.defaultProfile": "default",
  "awsSQSClient.defaultRegion": "us-east-1"
}
```

If you don't specify a profile or region in your .sqs file, these default values will be used.

## Requirements

- AWS credentials configured in your `~/.aws/credentials` file
- AWS SQS queue(s) to interact with

## Extension Settings

This extension contributes the following settings:

* `awsSQSClient.defaultProfile`: Default AWS profile to use
* `awsSQSClient.defaultRegion`: Default AWS region to use

## Known Issues

- Currently no support for SQS FIFO queues specific features (like message groups)
- Currently no support for message attributes
- No ability to delete individual messages after receiving them

## Release Notes

### 0.0.1

- Initial release
- Support for SEND, RECEIVE, and PURGE commands
- CodeLens integration for sending commands
- AWS profile and region support
