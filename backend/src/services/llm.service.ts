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

  /**
   * Rewrites a conversational query into a standalone query for retrieval.
   * Uses heuristics to skip rewriting if the query is already standalone.
   */
  async rewriteQuery(currentQuery: string, memory: { role: string; content: string }[]): Promise<string> {
    if (memory.length === 0) {
      return currentQuery;
    }

    // Heuristic Fast-Path: Only rewrite if necessary
    const lowerQuery = currentQuery.toLowerCase();
    const needsRewrite = 
      lowerQuery.length < 30 ||
      /\b(it|this|that|he|she|they|them|his|hers|its|these|those|the previous|the first|the second)\b/i.test(lowerQuery);

    if (!needsRewrite) {
      return currentQuery; // Skip LLM call
    }

    const systemPrompt = `You are a search query rewriter. 
Your goal is to rewrite the user's latest query into a standalone, context-independent sentence that can be used for semantic search.
Use the conversation memory to resolve pronouns and references.
Strict Rules:
- Output ONLY the rewritten query, nothing else.
- Do NOT answer the question.
- Do NOT add external assumptions.
- If the query is already standalone, return it exactly as is.`;

    const formattedMemory = memory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const fullPrompt = `${systemPrompt}\n\nConversation Memory:\n${formattedMemory}\n\nUser Query: ${currentQuery}\n\nRewritten Query:`;

    try {
      const response = await this.model.invoke([new HumanMessage(fullPrompt)]);
      return response.content.toString().trim();
    } catch (error) {
      console.error("Query rewrite failed, falling back to original query", error);
      return currentQuery;
    }
  }
}

export const llmService = new LLMService();
