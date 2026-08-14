'use client';

import { useEffect, useState, use } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function JourneyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken } = useAuth();
  const [journey, setJourney] = useState<any>(null);
  const [title, setTitle] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (accessToken) {
      fetch(`http://localhost:3001/api/v1/journeys/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then(res => res.json())
      .then(data => setJourney(data));
    }
  }, [accessToken, id]);

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`http://localhost:3001/api/v1/journeys/${id}/milestones`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const newMilestone = await res.json();
      setJourney({
        ...journey,
        milestones: [...(journey.milestones || []), newMilestone]
      });
      setTitle('');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure?')) return;
    const res = await fetch(`http://localhost:3001/api/v1/journeys/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      router.push('/journeys');
    }
  };

  if (!journey) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <Link href="/journeys">← Back</Link>
      <h1>{journey.title}</h1>
      <p>Progress: {journey.progress}% ({journey.completedTasks}/{journey.totalTasks} Tasks, {journey.completedMilestones}/{journey.totalMilestones} Milestones)</p>
      <button onClick={handleDelete}>Delete Journey</button>
      
      <h2>Milestones</h2>
      <ul>
        {journey.milestones?.map((m: any) => (
          <li key={m.id}>
            <Link href={`/milestones/${m.id}`}>{m.title}</Link>
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreateMilestone}>
        <input placeholder="New Milestone Title" value={title} onChange={e => setTitle(e.target.value)} required />
        <button type="submit">Add Milestone</button>
      </form>
    </div>
  );
}
