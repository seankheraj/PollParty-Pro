export interface PollQuestion {
  id: number;
  script: string;
  form: string;
  edit: string;
}

export type VisualType = 'bar' | 'pie' | 'radar' | 'bubble' | 'word' | 'grid';

export interface PollResult {
  title: string;
  results: Record<string, number>;
}
