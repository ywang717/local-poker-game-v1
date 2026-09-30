import type { Card } from '../../game/cards';

const suitSymbol: Record<Card['suit'], string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const rankLabel: Record<number, string> = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10' };

export function PlayingCard({ card, hidden = false }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) return <span className="playing-card playing-card--hidden">?</span>;
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  return <span className={`playing-card${red ? ' playing-card--red' : ''}`} aria-label={`${rankLabel[card.rank] ?? card.rank}${suitSymbol[card.suit]}`}>
    <span>{rankLabel[card.rank] ?? card.rank}</span><span>{suitSymbol[card.suit]}</span>
  </span>;
}
