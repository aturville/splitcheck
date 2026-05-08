'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Item {
  quantity: number;
  name: string;
  totalPrice: number;
  unitPrice: number;
}

interface Claim {
  name: string;
  quantity?: number;
  amount?: number;
}

interface Payer {
  name: string;
  venmo?: string;
  cashapp?: string;
}

interface Session {
  id: string;
  receipt: {
    items: Item[];
    subtotal: number;
    tax: number;
    serviceCharge: number;
    tip: number;
    total: number;
  };
  claims: Record<string, Claim[]>;
  payer?: Payer | null;
}

export default function SplitPage() {
  const { id } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [myName, setMyName] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showContribute, setShowContribute] = useState(false);
  const [contributeMode, setContributeMode] = useState<'amount' | 'people'>('amount');
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributePeople, setContributePeople] = useState('');
  const [claimQty, setClaimQty] = useState(1);
  const [showPayerForm, setShowPayerForm] = useState(false);
  const [payerFormName, setPayerFormName] = useState('');

  useEffect(() => {
    const fetchSession = () => {
      fetch(`/api/session?id=${id}`)
        .then(r => r.json())
        .then(setSession);
    };
    fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const resetExpanded = () => {
    setExpandedIndex(null);
    setShowContribute(false);
    setContributeAmount('');
    setContributePeople('');
    setClaimQty(1);
  };

  const submitClaim = async (itemIndex: number, override?: Partial<Claim>) => {
    const item = session!.receipt.items[itemIndex];
    let payload: { id: unknown; itemIndex: number; name: string; quantity?: number; amount?: number } = {
      id,
      itemIndex,
      name: myName,
    };

    const newClaim: Claim = { name: myName };

    if (override) {
      payload = { ...payload, ...override };
      if (override.amount !== undefined) newClaim.amount = override.amount;
      if (override.quantity !== undefined) newClaim.quantity = override.quantity;
    } else if (showContribute) {
      if (contributeMode === 'amount') {
        payload.amount = parseFloat(contributeAmount);
        newClaim.amount = parseFloat(contributeAmount);
      } else {
        const people = parseInt(contributePeople);
        const amount = item.totalPrice / people;
        payload.amount = amount;
        newClaim.amount = amount;
      }
    } else {
      const qty = item.quantity > 1 ? claimQty : 1;
      payload.quantity = qty;
      newClaim.quantity = qty;
    }

    setSession(prev => {
      if (!prev) return prev;
      const updatedClaims = { ...prev.claims };
      updatedClaims[itemIndex] = [...(updatedClaims[itemIndex] || []).filter(c => c.name !== myName), newClaim];
      return { ...prev, claims: updatedClaims };
    });
    resetExpanded();

    fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const unclaim = async (itemIndex: number) => {
    setSession(prev => {
      if (!prev) return prev;
      const updatedClaims = { ...prev.claims };
      updatedClaims[itemIndex] = (updatedClaims[itemIndex] || []).filter(c => c.name !== myName);
      return { ...prev, claims: updatedClaims };
    });
    resetExpanded();

    fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, itemIndex, name: myName, unclaim: true }),
    });
  };

  const submitPayer = () => {
    if (!payerFormName.trim()) return;
    const payer: Payer = { name: payerFormName.trim() };
    setSession(prev => prev ? { ...prev, payer } : prev);
    setShowPayerForm(false);
    fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, payer }),
    });
  };

  const shareLink = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: 'SplitCheck', text: 'Tap to claim your items!', url });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied!');
    }
  };

  if (!session) return <div className="p-6">Loading...</div>;

  const totalMultiplier = session.receipt.subtotal > 0 ? session.receipt.total / session.receipt.subtotal : 1;

  const getMyTotal = () => {
    let total = 0;
    session.receipt.items.forEach((item, i) => {
      const itemClaims = session.claims[i] || [];
      const myClaim = itemClaims.find(c => c.name === myName);
      if (!myClaim) return;
      if (myClaim.amount) {
        total += myClaim.amount * totalMultiplier;
      } else if (myClaim.quantity) {
        total += item.unitPrice * myClaim.quantity * totalMultiplier;
      }
    });
    return total;
  };

  const getClaimedQty = (itemIndex: number) => {
    return (session.claims[itemIndex] || []).reduce((sum, c) => sum + (c.quantity || 0), 0);
  };

  const getClaimedAmount = (itemIndex: number) => {
    return (session.claims[itemIndex] || []).reduce((sum, c) => sum + (c.amount || 0), 0);
  };

  const myTotal = nameSet ? getMyTotal() : 0;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-md mx-auto p-6 pt-8">
        <h1 className="text-2xl font-bold mb-3">SplitCheck</h1>
        {!nameSet ? (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600 mb-2">Enter your name to claim items</p>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                placeholder="Your name"
                value={myName}
                onChange={e => setMyName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && myName.trim()) setNameSet(true); }}
                autoFocus
              />
              <button
                onClick={() => setNameSet(true)}
                disabled={!myName.trim()}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                Go
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 mb-4">Hi {myName} — tap items you ordered.</p>
        )}

        <div className="mb-4">
          {session.payer ? (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-sm font-medium text-gray-800">Paid by {session.payer.name}</p>
              {(session.payer.venmo || session.payer.cashapp) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {session.payer.venmo && `Venmo: @${session.payer.venmo}`}
                  {session.payer.venmo && session.payer.cashapp && ' · '}
                  {session.payer.cashapp && `Cash App: $${session.payer.cashapp}`}
                </p>
              )}
            </div>
          ) : showPayerForm ? (
            <div className="p-3 border border-gray-200 rounded-xl space-y-2">
              <p className="text-sm font-medium text-gray-700">I paid the bill</p>
              <input
                placeholder="Your name"
                value={payerFormName}
                onChange={e => setPayerFormName(e.target.value)}
                className="border rounded-lg px-3 py-1.5 w-full text-sm"
              />
              <div className="flex gap-2">
                <button onClick={submitPayer} disabled={!payerFormName.trim()} className="flex-1 bg-black text-white py-1.5 rounded-lg text-sm disabled:opacity-50">Confirm</button>
                <button onClick={() => setShowPayerForm(false)} className="flex-1 border py-1.5 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowPayerForm(true); setPayerFormName(myName); }}
              className="w-full py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              I paid the bill
            </button>
          )}
        </div>

        <ul className="space-y-1">
          {session.receipt.items.map((item, i) => {
            const itemClaims = session.claims[i] || [];
            const claimedQty = getClaimedQty(i);
            const claimedAmount = getClaimedAmount(i);
            const myClaim = itemClaims.find(c => c.name === myName);
            const isMine = !!myClaim;
            const isMultiple = item.quantity > 1;
            const otherClaims = itemClaims.filter(c => c.name !== myName);

            const isFull = isMultiple
              ? claimedQty >= item.quantity || claimedAmount >= item.totalPrice
              : itemClaims.length > 0;
            const isDisabled = isFull && !isMine;

            const myClaimedQty = myClaim?.quantity || 0;
            const iFullyOwn = isMine && otherClaims.length === 0 && (
              isMultiple ? myClaimedQty >= item.quantity : !!myClaim?.quantity
            );

            let progressText: string | null = null;
            let progressPct = 0;
            if (!iFullyOwn) {
              if (isMultiple && claimedQty > 0) {
                progressText = `${claimedQty} of ${item.quantity} claimed`;
                progressPct = claimedQty / item.quantity;
              } else if (claimedAmount > 0) {
                progressText = `Claimed: $${claimedAmount.toFixed(2)} of $${item.totalPrice.toFixed(2)}`;
                progressPct = item.totalPrice > 0 ? claimedAmount / item.totalPrice : 0;
              }
            }

            const isExpanded = expandedIndex === i;

            return (
              <li key={i} className={`border rounded-lg overflow-hidden ${isMine ? 'border-green-300' : 'border-gray-200'}`}>
                <div
                  onClick={() => {
                    if (!nameSet || isDisabled) return;
                    if (isExpanded) { resetExpanded(); return; }
                    setExpandedIndex(i);
                    setShowContribute(false);
                    setClaimQty(1);
                  }}
                  className={`flex justify-between items-center px-3 py-2 ${!nameSet ? 'cursor-default' : 'cursor-pointer'} ${isMine ? 'bg-green-50' : isDisabled ? 'bg-gray-50 opacity-50 cursor-not-allowed' : !nameSet ? '' : 'hover:bg-gray-50'}`}>
                  <div>
                    <span className="font-medium">{item.quantity}x {item.name}</span>
                    {itemClaims.length > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {itemClaims.map((c, j) => (
                          <span key={j} className="mr-2">
                            {c.name}: {c.quantity ? `${c.quantity}x` : `$${c.amount?.toFixed(2)}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-sm">${item.totalPrice.toFixed(2)}</span>
                </div>

                {progressText && (
                  <div className={`px-3 pb-2 pt-1 ${isDisabled ? 'opacity-50' : ''}`}>
                    <p className="text-xs text-gray-400">{progressText}</p>
                    <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${Math.min(100, progressPct * 100)}%` }} />
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="px-3 py-3 bg-white border-t border-gray-100 space-y-3">
                    <div className="flex gap-2">
                      {isMine ? (
                        <button onClick={() => unclaim(i)} className="flex-1 border border-red-300 text-red-500 py-1.5 rounded text-sm">Unclaim</button>
                      ) : isMultiple ? (
                        <button onClick={() => submitClaim(i)} className="flex-1 bg-black text-white py-1.5 rounded text-sm">Claim All</button>
                      ) : (
                        <button onClick={() => submitClaim(i)} className="flex-1 bg-black text-white py-1.5 rounded text-sm">Claim</button>
                      )}
                      <button
                        onClick={() => setShowContribute(!showContribute)}
                        className={`flex-1 py-1.5 rounded text-sm border ${showContribute ? 'bg-black text-white' : ''}`}>
                        Contribute
                      </button>
                      <button onClick={resetExpanded} className="flex-1 border py-1.5 rounded text-sm">Cancel</button>
                    </div>

                    {isMultiple && !showContribute && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">Qty:</span>
                        <button onClick={() => setClaimQty(Math.max(1, claimQty - 1))} className="w-7 h-7 border rounded text-lg">−</button>
                        <span className="font-bold">{claimQty}</span>
                        <button onClick={() => setClaimQty(Math.min(item.quantity - claimedQty + (myClaim?.quantity || 0), claimQty + 1))} className="w-7 h-7 border rounded text-lg">+</button>
                        <span className="text-gray-400 text-sm">of {item.quantity}</span>
                        <button onClick={() => submitClaim(i, { quantity: claimQty })} className="ml-auto bg-black text-white px-3 py-1 rounded text-sm">Claim {claimQty}</button>
                      </div>
                    )}

                    {showContribute && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setContributeMode('amount')}
                            className={`flex-1 py-1 text-sm rounded border ${contributeMode === 'amount' ? 'bg-black text-white' : ''}`}>
                            Your Share ($)
                          </button>
                          <button
                            onClick={() => setContributeMode('people')}
                            className={`flex-1 py-1 text-sm rounded border ${contributeMode === 'people' ? 'bg-black text-white' : ''}`}>
                            # of People
                          </button>
                        </div>
                        {contributeMode === 'amount' ? (
                          <input
                            type="number"
                            placeholder="e.g. 12.00"
                            value={contributeAmount}
                            onChange={e => setContributeAmount(e.target.value)}
                            className="border rounded px-3 py-1.5 w-full text-sm"
                          />
                        ) : (
                          <input
                            type="number"
                            placeholder="e.g. 3 (splits evenly)"
                            value={contributePeople}
                            onChange={e => setContributePeople(e.target.value)}
                            className="border rounded px-3 py-1.5 w-full text-sm"
                          />
                        )}
                        <button onClick={() => submitClaim(i)} className="w-full bg-black text-white py-1.5 rounded text-sm">Confirm Contribution</button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {myTotal > 0 && (
          <div className="mt-6 p-5 bg-gray-50 rounded-2xl">
            <div className="flex justify-between items-baseline">
              <span className="font-bold text-xl">Your total</span>
              <span className="font-bold text-2xl">${myTotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">includes tax &amp; fees</p>
            {session.payer && session.payer.name !== myName && (
              <div className="mt-4 space-y-2">
                <a
                  href={session.payer.venmo
                    ? `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(session.payer.venmo)}&amount=${myTotal.toFixed(2)}&note=SplitCheck`
                    : `venmo://paycharge?txn=pay&amount=${myTotal.toFixed(2)}&note=SplitCheck`}
                  className="flex items-center justify-center w-full bg-[#3D95CE] hover:bg-[#3080b0] text-white font-medium py-3 rounded-xl transition-colors">
                  Pay {session.payer.name} via Venmo
                </a>
                <a
                  href={session.payer.cashapp
                    ? `https://cash.app/$${session.payer.cashapp}/${myTotal.toFixed(2)}`
                    : `https://cash.app/`}
                  className="flex items-center justify-center w-full bg-[#00C244] hover:bg-[#00a83a] text-white font-medium py-3 rounded-xl transition-colors">
                  Pay {session.payer.name} via Cash App
                </a>
              </div>
            )}
          </div>
        )}

        <button
          onClick={shareLink}
          className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl transition-colors">
          Share Split Link
        </button>
      </div>
    </main>
  );
}