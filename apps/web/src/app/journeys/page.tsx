'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';

export default function JourneysPage() {
  const { accessToken } = useAuth();
  const [journeys, setJourneys] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (accessToken) {
      fetch('http://localhost:3001/api/v1/journeys', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then(res => res.json())
      .then(data => setJourneys(data));
    }
  }, [accessToken]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('http://localhost:3001/api/v1/journeys', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ title, category }),
    });
    if (res.ok) {
      const data = await res.json();
      setJourneys([data, ...journeys] as any);
      setTitle('');
      setCategory('');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>My Journeys</h1>
      <form onSubmit={handleCreate} style={{ marginBottom: 20 }}>
        <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required />
        <input placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} required />
        <button type="submit">Create Journey</button>
      </form>
      <ul>
        {journeys.map((j: any) => (
          <li key={j.id}>
            <Link href={`/journeys/${j.id}`}>{j.title}</Link> ({j.category})
          </li>
        ))}
      </ul>
    </div>
  );
}
