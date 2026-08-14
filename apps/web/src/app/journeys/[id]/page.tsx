'use client';

import { useEffect, useState, use } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';
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
      apiFetch(`/api/v1/journeys/${id}`, { accessToken })
        .then(data => setJourney(data))
        .catch(err => console.error('Failed to load journey detail', err));
    }
  }, [accessToken, id]);

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newMilestone = await apiFetch(`/api/v1/journeys/${id}/milestones`, {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ title }),
      });
      setJourney({
        ...journey,
        milestones: [...(journey.milestones || []), newMilestone]
      });
      setTitle('');
    } catch (err) {
      console.error('Failed to create milestone', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure?')) return;
    try {
      await apiFetch(`/api/v1/journeys/${id}`, {
        method: 'DELETE',
        accessToken,
      });
      router.push('/journeys');
    } catch (err) {
      console.error('Failed to delete journey', err);
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
