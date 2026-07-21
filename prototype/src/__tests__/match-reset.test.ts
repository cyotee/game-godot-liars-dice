import { describe, expect, it } from "vitest";
import { Client } from "boardgame.io/client";
import { Local } from "boardgame.io/multiplayer";
import { LiarsDiceGame } from "../game/game";
import { makeMatchId } from "../matchId";
import { AI, HUMAN } from "../rules/types";

describe("new blind / match reset", () => {
  it("makeMatchId is unique across boots with same seed", () => {
    const a = makeMatchId("same", 1, 1000);
    const b = makeMatchId("same", 2, 1000);
    const c = makeMatchId("same", 2, 1001);
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
  });

  it("fresh Local match with unique matchID resets score after mid-match", () => {
    const seed = "reset-seed";
    const multiplayer = Local();

    const match1 = makeMatchId(seed, 1, 1);
    const h1 = Client({
      game: LiarsDiceGame,
      numPlayers: 2,
      playerID: HUMAN,
      matchID: match1,
      multiplayer,
      setupData: { seed },
    });
    const a1 = Client({
      game: LiarsDiceGame,
      numPlayers: 2,
      playerID: AI,
      matchID: match1,
      multiplayer,
      setupData: { seed },
    });
    h1.start();
    a1.start();
    h1.moves.bid(2, 6);
    const midScore = h1.getState()!.G.score;
    expect(midScore).toBeGreaterThan(0);
    expect(h1.getState()!.G.currentBid).not.toBeNull();

    // Simulate App.boot: stop and start with NEW match id (same seed)
    h1.stop();
    a1.stop();

    const match2 = makeMatchId(seed, 2, 2);
    expect(match2).not.toBe(match1);
    const multiplayer2 = Local();
    const h2 = Client({
      game: LiarsDiceGame,
      numPlayers: 2,
      playerID: HUMAN,
      matchID: match2,
      multiplayer: multiplayer2,
      setupData: { seed },
    });
    const a2 = Client({
      game: LiarsDiceGame,
      numPlayers: 2,
      playerID: AI,
      matchID: match2,
      multiplayer: multiplayer2,
      setupData: { seed },
    });
    h2.start();
    a2.start();

    const G = h2.getState()!.G;
    expect(G.score).toBe(0);
    expect(G.currentBid).toBeNull();
    expect(G.players[HUMAN].diceCount).toBe(5);
    expect(G.players[AI].diceCount).toBe(5);
    // Same seed → same opening dice as a fresh match would have
    const fresh = Client({
      game: LiarsDiceGame,
      numPlayers: 2,
      playerID: HUMAN,
      setupData: { seed },
    });
    fresh.start();
    expect(G.secretDice[HUMAN]).toEqual(fresh.getState()!.G.secretDice[HUMAN]);
  });

  it("reusing same matchID does NOT reset (documents Local bug we avoid)", () => {
    const seed = "reuse-seed";
    const multiplayer = Local();
    const matchID = `liars-${seed}`; // BAD pattern App used before fix
    const h1 = Client({
      game: LiarsDiceGame,
      numPlayers: 2,
      playerID: HUMAN,
      matchID,
      multiplayer,
      setupData: { seed },
    });
    const a1 = Client({
      game: LiarsDiceGame,
      numPlayers: 2,
      playerID: AI,
      matchID,
      multiplayer,
      setupData: { seed },
    });
    h1.start();
    a1.start();
    h1.moves.bid(2, 6);
    const mid = h1.getState()!.G.score;

    // New clients, SAME matchID + Local transport → state persists
    const h2 = Client({
      game: LiarsDiceGame,
      numPlayers: 2,
      playerID: HUMAN,
      matchID,
      multiplayer,
      setupData: { seed },
    });
    h2.start();
    expect(h2.getState()!.G.score).toBe(mid);
    expect(h2.getState()!.G.currentBid).not.toBeNull();
  });
});
