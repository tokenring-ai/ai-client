export const name: string;
export const description: string;
export const version: string;

export const chatCommands: any;

export class ChatMessageStorage {
  constructor(...args: any[]);
}
export class EphemeralChatMessageStorage extends ChatMessageStorage {}
export class ModelRegistry {
  constructor(...args: any[]);
}
export function createChatRequest(...args: any[]): any;
