import { AzureChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class LLMService {
  private model: BaseChatModel;

  constructor() {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;

    if (!apiKey) {
      throw new Error("AZURE_OPENAI_API_KEY is not defined in environment variables.");
    }
    if (!endpoint) {
      throw new Error("AZURE_OPENAI_ENDPOINT is not defined in environment variables.");
    }

    const url = new URL(endpoint);
    const basePath = `${url.protocol}//${url.hostname}/openai/deployments`;
    
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5.4-mini";

    // Initializing with Azure OpenAI by default. 
    // This can be easily extended to Gemini by changing the model instance.
    this.model = new AzureChatOpenAI({
      azureOpenAIApiKey: apiKey,
      azureOpenAIBasePath: basePath,
      azureOpenAIApiDeploymentName: deploymentName,
      azureOpenAIApiVersion: "2024-02-15-preview", // Match what works in cURL
      streaming: true,
      temperature: 0,
    });
  }

  async generateResponse(messages: ChatMessage[], onToken?: (token: string) => void) {
    const langchainMessages = messages.map(m => {
      if (m.role === 'system') return new SystemMessage(m.content);
      if (m.role === 'assistant') return new HumanMessage(m.content); // LangChain uses Human/AI
      return new HumanMessage(m.content);
    });

    // Handle streaming
    if (onToken) {
      const stream = await this.model.stream(langchainMessages);
      for await (const chunk of stream) {
        if (chunk.content) {
          onToken(chunk.content.toString());
        }
      }
      return;
    }

    // Handle non-streaming
    const response = await this.model.invoke(langchainMessages);
    return response.content.toString();
  }
}

export const llmService = new LLMService();
