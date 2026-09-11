import { createInterface } from 'readline';
import { cancel, isCancel, select } from '@clack/prompts';

export interface SelectOption {
  label: string;
  value: string;
}

export function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function selectPrompt(question: string, options: SelectOption[]): Promise<string> {
  return select({
    message: question,
    options,
  }).then((value) => {
    if (isCancel(value)) {
      cancel('Operation cancelled.');
      return '';
    }
    return String(value);
  });
}
