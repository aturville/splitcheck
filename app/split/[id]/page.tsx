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
  const [claimQty, setClaimQty] = useState(1);
  const [claimAmount, setClaimAmount] = useState('');
  const [claimMode, setClaimMode] = useState<'quantity' | 'amount'>('quantity');

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

  const submitClaim = async () => {
    if (expandedIndex === null) return;
    const payload: { id: unknown; itemIndex: number; name: string; quantity?: number; amount?: number } = {
      id,
      itemIndex: expandedIndex,
      name: myName,
    };
    if (claimMode === 'amount') {
      payload.amount = parseFloat(claimAmount);
    } else {
      payload.quantity = claimQty;
    }
    await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setExpandedIndex(null);
    setClaimQty(1);
    setClaimAmount('');
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
          const fullyClaimedByQty = claimedQty >= item.quantity;
          const isMine = !!myClaim;
          const isExpanded = expandedIndex === i;

          return (
            <li key={i} className={`border rounded-lg overflow-hidden ${isMine ? 'border-green-300' : 'border-gray-200'}`}>
              <div
                onClick={() => {
                  if (fullyClaimedByQty && !isMine) return;
                  setExpandedIndex(isExpanded ? null : i);
                  setClaimQty(1);
                  setClaimAmount('');
                  setClaimMode('quantity');
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
                <div className="px-3 py-3 bg-white border-t border-gray-100">
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setClaimMode('quantity')}
                      className={`flex-1 py-1.5 text-sm rounded ${claimMode === 'quantity' ? 'bg-black text-white' : 'border'}`}>
                      Qty
                    </button>
                    <button
                      onClick={() => setClaimMode('amount')}
                      className={`flex-1 py-1.5 text-sm rounded ${claimMode === 'amount' ? 'bg-black text-white' : 'border'}`}>
                      $ Amount
                    </button>
                  </div>
                  {claimMode === 'quantity' ? (
                    <div className="flex items-center gap-3 mb-3">
                      <button onClick={() => setClaimQty(Math.max(1, claimQty - 1))} className="text-xl w-8 h-8 border rounded">−</button>
                      <span className="font-bold">{claimQty}</span>
                      <button onClick={() => setClaimQty(Math.min(item.quantity - claimedQty + (myClaim?.quantity || 0), claimQty + 1))} className="text-xl w-8 h-8 border rounded">+</button>
                      <span className="text-gray-500 text-sm">of {item.quantity}</span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      placeholder="Your share ($)"
                      value={claimAmount}
                      onChange={e => setClaimAmount(e.target.value)}
                      className="border rounded px-3 py-1.5 w-full mb-3 text-sm"
                    />
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setExpandedIndex(null)} className="flex-1 border py-1.5 rounded text-sm">Cancel</button>
                    <button onClick={submitClaim} className="flex-1 bg-black text-white py-1.5 rounded text-sm">Claim</button>
                  </div>
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