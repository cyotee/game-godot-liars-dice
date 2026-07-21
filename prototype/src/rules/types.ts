export type PlayerID = "0" | "1";

export type Bid = {
  qty: number;
  face: number; // 1..6
};

export type LogEntry = {
  t: number;
  text: string;
};

export type LastReveal = {
  dice: Record<string, number[]>;
  actualCount: number;
  bid: Bid;
  challengerId: string;
  bidderId: string;
  loserId: string;
};

export type PlayerPublic = {
  diceCount: number;
  eliminated: boolean;
};

export type BlindOutcome = "score" | "elim" | "player_elim" | null;

export type LiarsDiceG = {
  seed: string;
  targetScore: number;
  score: number;
  planetHighFaceLevel: number;
  players: Record<string, PlayerPublic>;
  secretDice: Record<string, number[]>;
  currentBid: Bid | null;
  bidderId: string | null;
  nextPlayerId: string;
  rngCounter: number;
  phaseTag: "playing" | "ended";
  winner: string | null;
  outcome: BlindOutcome;
  log: LogEntry[];
  lastReveal: LastReveal | null;
  playerBidsMade: number;
  subRoundsCompleted: number;
};

export const HUMAN = "0";
export const AI = "1";
export const DEFAULT_TARGET = 300;
export const RESOLUTION_BONUS = 30;
export const START_DICE = 5;
