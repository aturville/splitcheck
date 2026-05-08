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

    if (override) {
      payload = { ...payload, ...override };
    } else if (showContribute) {
      if (contributeMode === 'amount') {
        payload.amount = parseFloat(contributeAmount);
      } else {
        const people = parseInt(contributePeople);
        payload.amount = item.totalPrice / people;
      }
    } else {
      if (item.quantity > 1) {
        payload.quantity = claimQty;
      } else {
        payload.quantity = 1;
      }
    }

    await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    resetExpanded();
  };

  const unclaim = async (itemIndex: number) => {
    await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, itemIndex, name: myName, unclaim: true }),
    });
    resetExpanded();
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

  if (!nameSet) {
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">SplitCheck</h1>
        <p className="mb-4 text-gray-600">Enter your name to claim your items.</p>
        <input
          className="border rounded px-3 py-2 w-full mb-3"
          placeholder="Your name"
          value={myName}
          onChange={e => setMyName(e.target.value)}
        />
        <button
          onClick={() => setNameSet(true)}
          disabled={!myName}
          className="bg-black text-white px-4 py-2 rounded w-full disabled:opacity-50">
          Continue
        </button>
      </main>
    );
  }

  const myTotal = getMyTotal();

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">SplitCheck</h1>
      <p className="text-gray-500 mb-4">Hi {myName} — tap items you ordered.</p>

      <ul className="space-y-1">
        {session.receipt.items.map((item, i) => {
          const itemClaims = session.claims[i] || [];
          const claimedQty = getClaimedQty(i);
          const myClaim = itemClaims.find(c => c.name === myName);
          const fullyClaimedByQty = item.quantity > 1 && claimedQty >= item.quantity;
          const isMine = !!myClaim;
          const isExpanded = expandedIndex === i;
          const isMultiple = item.quantity > 1;

          return (
            <li key={i} className={`border rounded-lg overflow-hidden ${isMine ? 'border-green-300' : 'border-gray-200'}`}>
              <div
                onClick={() => {
                  if (fullyClaimedByQty && !isMine) return;
                  if (isExpanded) { resetExpanded(); return; }
                  setExpandedIndex(i);
                  setShowContribute(false);
                  setClaimQty(1);
                }}
                className={`flex justify-between items-center px-3 py-2 cursor-pointer ${isMine ? 'bg-green-50' : fullyClaimedByQty ? 'bg-gray-50 opacity-50' : 'hover:bg-gray-50'}`}>
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
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <div className="flex justify-between font-bold text-lg">
            <span>Your total (with tax & fees)</span>
            <span>${myTotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </main>
  );
}