import { useCallback, useEffect, useState } from "react";
import { Client } from "boardgame.io/client";
import { Local } from "boardgame.io/multiplayer";
import { LiarsDiceGame } from "./game/game";
import { pickDumbAction } from "./game/bot";
import { AI, HUMAN, type LiarsDiceG } from "./rules/types";
import "./styles.css";

type BgioClient = ReturnType<typeof Client<LiarsDiceG>>;

export function App() {
  const [seedInput, setSeedInput] = useState("demo-seed-1");
  const [qty, setQty] = useState(1);
  const [face, setFace] = useState(3);
  const [human, setHuman] = useState<BgioClient | null>(null);
  const [bot, setBot] = useState<BgioClient | null>(null);
  const [G, setG] = useState<LiarsDiceG | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<string>(HUMAN);
  const [gameover, setGameover] = useState(false);

  const boot = useCallback((s: string) => {
    const matchID = `liars-${s}`;
    const multiplayer = Local();
    const h = Client({
      game: LiarsDiceGame,
      numPlayers: 2,
      playerID: HUMAN,
      matchID,
      multiplayer,
      setupData: { seed: s },
    });
    const b = Client({
      game: LiarsDiceGame,
      numPlayers: 2,
      playerID: AI,
      matchID,
      multiplayer,
      setupData: { seed: s },
    });
    h.start();
    b.start();

    const sync = () => {
      const st = h.getState();
      if (!st) return;
      setG(st.G);
      setCurrentPlayer(st.ctx.currentPlayer);
      setGameover(Boolean(st.ctx.gameover) || st.G.phaseTag === "ended");
    };
    h.subscribe(sync);
    b.subscribe(sync);
    setHuman(h);
    setBot(b);
    sync();
  }, []);

  useEffect(() => {
    boot(seedInput);
    // initial match only; later starts via buttons
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI acts on its turn
  useEffect(() => {
    if (!bot || !G || gameover) return;
    if (currentPlayer !== AI) return;
    if (G.phaseTag === "ended") return;

    const t = window.setTimeout(() => {
      const st = bot.getState();
      if (!st?.G || st.ctx.currentPlayer !== AI || st.G.phaseTag === "ended") {
        return;
      }
      const action = pickDumbAction(st.G);
      try {
        if (action.type === "bid") {
          bot.moves.bid(action.qty, action.face);
        } else {
          bot.moves.challenge();
        }
      } catch {
        // ignore race if turn already ended
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [bot, G, currentPlayer, gameover]);

  const isHumanTurn = currentPlayer === HUMAN && !gameover;
  const ownDice = G?.secretDice?.[HUMAN] ?? [];

  const terminal = (() => {
    if (!G || !gameover) return null;
    if (G.outcome === "score") return "You win — score target reached!";
    if (G.outcome === "elim") return "You win — AI eliminated!";
    if (G.outcome === "player_elim") return "You lose — out of dice.";
    return "Match over.";
  })();

  return (
    <div className="app">
      <h1>Liar&apos;s Dice — Mechanics Prototype</h1>
      <p className="help">
        Wild 1s: face 1 counts only ones; other faces count that face or ones.
        Overbids allowed. Only your bids score. AI: raise else challenge.
      </p>

      <section className="panel">
        <label>
          Seed{" "}
          <input
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
          />
        </label>
        <button type="button" onClick={() => boot(seedInput || `seed-${Date.now()}`)}>
          New blind
        </button>
        <button
          type="button"
          onClick={() => {
            const s = `seed-${Math.floor(Math.random() * 1e9)}`;
            setSeedInput(s);
            boot(s);
          }}
        >
          Randomize seed
        </button>
      </section>

      {G && (
        <>
          <section className="panel stats">
            <div>
              Target: <strong>{G.targetScore}</strong>
            </div>
            <div>
              Score: <strong>{G.score}</strong>
            </div>
            <div>
              Status:{" "}
              <strong>
                {gameover ? "ended" : isHumanTurn ? "your turn" : "AI turn"}
              </strong>
            </div>
            <div>
              You: {G.players[HUMAN].diceCount} dice | AI:{" "}
              {G.players[AI].diceCount} dice
            </div>
            <div>
              Your dice:{" "}
              <strong>{ownDice.length ? ownDice.join(" ") : "(none)"}</strong>
            </div>
            <div>
              Current bid:{" "}
              {G.currentBid
                ? `${G.currentBid.qty} of ${G.currentBid.face}s (by ${
                    G.bidderId === HUMAN ? "You" : "AI"
                  })`
                : "none"}
            </div>
          </section>

          {G.lastReveal && (
            <section className="panel reveal">
              <h3>Last reveal</h3>
              <div>
                You: {G.lastReveal.dice[HUMAN]?.join(" ")} | AI:{" "}
                {G.lastReveal.dice[AI]?.join(" ")}
              </div>
              <div>
                Actual for {G.lastReveal.bid.qty}×{G.lastReveal.bid.face}:{" "}
                {G.lastReveal.actualCount} (loser:{" "}
                {G.lastReveal.loserId === HUMAN ? "You" : "AI"})
              </div>
            </section>
          )}

          {terminal && <div className="terminal">{terminal}</div>}

          <section className="panel actions">
            <label>
              Qty{" "}
              <input
                type="number"
                min={1}
                value={qty}
                disabled={!isHumanTurn}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </label>
            <label>
              Face{" "}
              <select
                value={face}
                disabled={!isHumanTurn}
                onChange={(e) => setFace(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!isHumanTurn || !human}
              onClick={() => human?.moves.bid(qty, face)}
            >
              Bid
            </button>
            <button
              type="button"
              disabled={!isHumanTurn || !G.currentBid || !human}
              onClick={() => human?.moves.challenge()}
            >
              Challenge Liar!
            </button>
          </section>

          <section className="panel log">
            <h3>Event log</h3>
            <ol>
              {G.log.map((e) => (
                <li key={e.t}>{e.text}</li>
              ))}
            </ol>
          </section>
        </>
      )}

      <p className="footer">boardgame.io prototype · form UI · ready for playtest</p>
    </div>
  );
}
