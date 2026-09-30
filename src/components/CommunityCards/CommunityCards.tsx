import type { Card } from '../../game/cards';
import { PlayingCard } from '../PlayingCard/PlayingCard';

export function CommunityCards({ cards }: { cards: readonly Card[] }) {
  return <div className="community-cards" aria-label="公共牌">
    {cards.map((card) => <PlayingCard card={card} key={card.id} />)}
    {Array.from({ length: Math.max(0, 5 - cards.length) }, (_, index) => <PlayingCard hidden key={`empty-${index}`} />)}
  </div>;
}
