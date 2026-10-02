# V2.2 AI Response and Persistence Design

## Constraints

- Keep Poker Engine, betting, side pots, settlement, hand evaluator, and tournament settlement unchanged unless a public interface needs a compatible field.
- AI receives only `PublicTableContext` and public tournament information.
- Personality changes decision margins and mixed frequencies only; it never changes equity, pot odds, SPR, or hidden-card data.
- Cash buy-in transitions must be serialized with existing IndexedDB writes and must be idempotent by transaction ID.
- Default CI runs targeted tests and the existing 800/600/20 smoke once; full 14K simulation remains opt-in.

## Design

1. **One position source**: extend canonical `positionForDetailed` output with heads-up role flags (`isButton`, `isSmallBlind`, `isBigBlind`, `inPosition`) and expose fixed positions in public context. AI no longer maintains a second seat mapping.
2. **Preflop classification**: derive the current aggressor and current price from full raises, distinguish open/3-bet/4-bet/jam types, count callers, and calculate effective stack against the relevant opener or last aggressor instead of the table minimum. A short all-in that is not a full raise does not replace the current full-raise situation.
3. **Response tree**: facing an open and facing a 3-bet each choose Fold/Call/Raise (or Squeeze in an open-plus-call spot) from hand class, position matchup, open/raise size, caller count, stack bucket, difficulty, and personality. Fixed pot-ratio gates are removed. Premium hands are protected; medium hands receive a call/3-bet mix; trash remains folded against early opens.
4. **Jam response**: classify open/3-bet/4-bet/postflop jams and use jammer position, hero role, previous aggression, and effective-stack bucket. Deep-stack jam calls are tightened while short-stack responses remain wider. Strategy intent is mapped through legal actions explicitly.
5. **Postflop personality**: pass the actor personality into postflop strategy. Adjust only call/bet/raise/check-raise/bluff margins; preserve computed equity, pot odds, SPR, opponent count, and public-information boundaries.
6. **Cash transition coordinator**: expose a serial persistence coordinator that flushes pending game writes before atomic career + next-hand persistence, then updates in-memory stores without scheduling a second snapshot. Failed writes keep the settled hand and pending transaction for retry. Apply/cancel are transaction-ID idempotent.
7. **Test partition**: exclude `tests/simulation/continuousSimulation.test.ts` and `tests/release/**` from `npm test`; retain `test:simulation:full` for the full matrix and run release smoke only through `test:simulation:smoke`.
