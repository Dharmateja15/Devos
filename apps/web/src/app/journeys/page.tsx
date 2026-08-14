'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import Link from 'next/link';

export default function JourneysPage() {
  const { accessToken } = useAuth();
  const [journeys, setJourneys] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (accessToken) {
      apiFetch('/api/v1/journeys', { accessToken })
        .then(data => setJourneys(data))
        .catch(err => console.error('Failed to load journeys', err));
    }
  }, [accessToken]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiFetch('/api/v1/journeys', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ title, category }),
      });
      setJourneys([data, ...journeys] as any);
      setTitle('');
      setCategory('');
    } catch (err) {
      console.error('Failed to create journey', err);
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
