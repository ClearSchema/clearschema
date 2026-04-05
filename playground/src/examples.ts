import userExample from '../../examples/user.clear?raw';
import ecommerceExample from '../../examples/ecommerce.clear?raw';
import llmToolExample from '../../examples/llm-tool-definition.clear?raw';
import llmResponseExample from '../../examples/llm-structured-response.clear?raw';
import llmAgentExample from '../../examples/llm-agent-output.clear?raw';

export interface Example {
  name: string;
  content: string;
}

export const examples: Example[] = [
  { name: 'User Profile', content: userExample },
  { name: 'E-Commerce', content: ecommerceExample },
  { name: 'LLM Tool Definition', content: llmToolExample },
  { name: 'LLM Structured Response', content: llmResponseExample },
  { name: 'LLM Agent Output', content: llmAgentExample },
];

export const defaultExample = examples[0]!;
