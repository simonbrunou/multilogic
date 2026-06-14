import type { Difficulty, PuzzleType } from '../engine/core/types';

export interface GenerateRequest {
  kind: 'generate';
  id: number;
  puzzle: PuzzleType;
  difficulty: Difficulty;
  seed: string;
}
export interface CancelRequest {
  kind: 'cancel';
  id: number;
}
export type WorkerRequest = GenerateRequest | CancelRequest;

export interface ResultResponse {
  kind: 'result';
  id: number;
  givens: string;
  solution: string;
  achievedDifficulty: Difficulty;
}
export interface ErrorResponse {
  kind: 'error';
  id: number;
  message: string;
}
export interface ProgressResponse {
  kind: 'progress';
  id: number;
  percent: number;
}
export type WorkerResponse = ResultResponse | ErrorResponse | ProgressResponse;
