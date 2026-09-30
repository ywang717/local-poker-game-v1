import { useState } from 'react';
import type { CareerState } from '../../career/careerState';

export function HomePage({ career, onContinue, onNewCareer, onNavigate, loadError }: { career: CareerState | null; onContinue: () => void; onNewCareer: (nickname: string) => void; onNavigate: (view: 'STATISTICS' | 'HISTORY' | 'SETTINGS') => void; loadError?: string | null }) {
  const [showCreate, setShowCreate] = useState(false);
  const [nickname, setNickname] = useState('');
  const submit = () => { onNewCareer(nickname.trim() || '玩家'); setShowCreate(false); };
  return <section className="page home-page">
    <div className="brand-mark">牌</div>
    <p className="eyebrow">离线 · 单人 · 中文</p>
    <h1>本地德州扑克生涯</h1>
    <p className="lede">用每一手牌积累你的生涯资金，逐级挑战更强 AI。</p>
    {loadError && <p className="load-error" role="alert">{loadError}</p>}
    {career ? <button className="button button--primary button--large" onClick={onContinue}>继续生涯</button> : <button className="button button--primary button--large" onClick={() => setShowCreate(true)}>创建生涯</button>}
    <div className="home-links"><button className="link-button" onClick={() => setShowCreate(true)}>新建生涯</button><button className="link-button" onClick={() => onNavigate('STATISTICS')}>生涯数据</button><button className="link-button" onClick={() => onNavigate('HISTORY')}>手牌记录</button><button className="link-button" onClick={() => onNavigate('SETTINGS')}>设置</button></div>
    {showCreate && <div className="modal-backdrop"><div className="modal" role="dialog" aria-label="创建生涯"><p className="eyebrow">新的生涯</p><h3>输入昵称</h3><input autoFocus value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="玩家" aria-label="昵称" onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} /><div className="page-links"><button className="button button--muted" onClick={() => setShowCreate(false)}>取消</button><button className="button button--primary" onClick={submit}>创建</button></div></div></div>}
  </section>;
}
