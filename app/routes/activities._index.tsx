import { useRef, useState } from 'react';
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation
} from 'react-router';
import { db } from '~/lib/db.server';
import { getIsOwner, requireOwner } from '~/lib/session.server';
import {
  ACTIVITY_SOURCE_FITOTRACK_GPX,
  GpxParseError,
  parseGpxFromBuffer
} from '~/services/gpx.server';
import type { Route } from './+types/activities._index';

type ActionData =
  | { error: string }
  | { duplicate: true; existingActivityId: string; name: string };

export async function loader({ request }: Route.LoaderArgs) {
  const isOwner = await getIsOwner(request);

  const imported = await db.activity.findMany({
    select: {
      id: true,
      name: true,
      distance: true,
      movingTime: true,
      totalElevGain: true,
      startDate: true
    },
    orderBy: { startDate: 'desc' }
  });

  return { imported, isOwner };
}

export async function action({ request }: Route.ActionArgs) {
  await requireOwner(request);

  const formData = await request.formData();
  const file = formData.get('gpx');

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a GPX file to import.' } satisfies ActionData;
  }

  const filename = file.name || 'upload.gpx';
  if (!filename.toLowerCase().endsWith('.gpx')) {
    return {
      error: 'Only .gpx files exported from FitoTrack are supported.'
    } satisfies ActionData;
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseGpxFromBuffer(buffer, filename);
  } catch (err) {
    const message =
      err instanceof GpxParseError
        ? err.message
        : 'Could not import this GPX file.';
    return { error: message } satisfies ActionData;
  }

  const existing = await db.activity.findUnique({
    where: {
      source_sourceId: {
        source: ACTIVITY_SOURCE_FITOTRACK_GPX,
        sourceId: parsed.sourceId
      }
    },
    select: { id: true, name: true }
  });

  if (existing) {
    return {
      duplicate: true,
      existingActivityId: existing.id,
      name: existing.name
    } satisfies ActionData;
  }

  const activity = await db.activity.create({
    data: {
      source: ACTIVITY_SOURCE_FITOTRACK_GPX,
      sourceId: parsed.sourceId,
      name: parsed.name,
      distance: parsed.distance,
      movingTime: parsed.movingTime,
      elapsedTime: parsed.elapsedTime,
      totalElevGain: parsed.totalElevGain,
      startDate: parsed.startDate,
      type: parsed.type,
      gpsData: parsed.gpsData
    }
  });

  return new Response(null, {
    status: 303,
    headers: { Location: `/activities/${activity.id}` }
  });
}

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type SortKey = 'date-desc' | 'date-asc' | 'distance-desc' | 'elevation-desc';

export default function ActivitiesIndex() {
  const { imported, isOwner } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const isImporting =
    navigation.state === 'submitting' &&
    navigation.formData?.has('gpx') === true;

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('date-desc');

  const filtered = imported
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'date-asc')
        return (
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
      if (sort === 'distance-desc') return b.distance - a.distance;
      if (sort === 'elevation-desc') return b.totalElevGain - a.totalElevGain;
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

  const handleFileChange = () => {
    const name = fileInputRef.current?.files?.[0]?.name ?? null;
    setSelectedFileName(name);
  };

  return (
    <div className='min-h-screen bg-[#f5f1eb] dark:bg-[#1c1916]'>
      <header className='max-w-6xl mx-auto px-6 py-4 flex items-center justify-between'>
        <Link
          to='/'
          className='font-[Oswald] text-lg font-semibold tracking-tight text-[#1a1816] dark:text-[#f5f1eb]'
        >
          Hawi's Hikes
        </Link>
        {isOwner ? (
          <Form method='post' action='/logout'>
            <button
              type='submit'
              className='text-sm text-[#5c554d] hover:text-[#1a1816] dark:text-[#b8ae9f] dark:hover:text-[#f5f1eb] transition-colors'
            >
              Sign out
            </button>
          </Form>
        ) : (
          <Link
            to='/login'
            className='text-sm text-[#5c554d] hover:text-[#1a1816] dark:text-[#b8ae9f] dark:hover:text-[#f5f1eb] transition-colors'
          >
            Owner login
          </Link>
        )}
      </header>

      <section className='relative w-full h-[50vh] min-h-[320px] max-h-[560px] overflow-hidden'>
        <img
          src='/hero-2400.webp'
          srcSet='/hero-1536.webp 1536w, /hero-2400.webp 2400w, /hero-3072.webp 3072w'
          sizes='100vw'
          alt=''
          loading='eager'
          decoding='async'
          className='absolute inset-0 w-full h-full object-cover motion-safe:animate-[hero-zoom_20s_ease-in-out_infinite_alternate]'
        />
        <div className='absolute inset-0 bg-gradient-to-t from-[#1a1816]/80 via-[#1a1816]/30 to-[#1a1816]/10' />
        <div className='absolute inset-0 flex items-end'>
          <div className='max-w-6xl mx-auto px-6 pb-10 md:pb-14 w-full'>
            <p className='text-[#c4a13e] text-xs font-semibold uppercase tracking-[0.2em] mb-3'>
              Personal Trail Archive
            </p>
            <h1 className='font-[Oswald] text-5xl md:text-7xl font-bold text-[#f5f1eb] tracking-tight leading-[0.95]'>
              Hawi's Hikes
            </h1>
            <p className='mt-4 text-[#f5f1eb]/90 text-base md:text-lg max-w-xl leading-relaxed'>
              A curated collection of recorded trails and the details that make
              each hike worth remembering.
            </p>
          </div>
        </div>
      </section>

      {isOwner && (
        <section className='max-w-6xl mx-auto px-6 py-8'>
          <div className='border border-[#ddd5c9] dark:border-[#4a443e] bg-[#f0ebe3] dark:bg-[#2a2622] p-5 md:p-6'>
            <h2 className='font-[Oswald] text-xl font-semibold text-[#1a1816] dark:text-[#f5f1eb] mb-1'>
              Editor's Desk
            </h2>
            <p className='text-sm text-[#5c554d] dark:text-[#b8ae9f] mb-5'>
              Upload a FitoTrack GPX export to add a new hike to the archive.
              The original file is not stored—only the parsed route and stats.
            </p>

            {actionData && 'error' in actionData && (
              <div
                role='alert'
                className='mb-4 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 text-sm px-4 py-3'
              >
                {actionData.error}
              </div>
            )}

            {actionData && 'duplicate' in actionData && actionData.duplicate && (
              <div
                role='status'
                className='mb-4 border border-[#c4a13e]/40 bg-[#c4a13e]/10 text-[#1a1816] dark:text-[#f5f1eb] text-sm px-4 py-3'
              >
                <span className='font-medium'>{actionData.name}</span> is
                already in the archive.{' '}
                <Link
                  to={`/activities/${actionData.existingActivityId}`}
                  className='font-semibold text-[#2d4a3e] dark:text-[#a3c4b3] underline underline-offset-2'
                >
                  View this hike
                </Link>
              </div>
            )}

            <Form
              method='post'
              encType='multipart/form-data'
              className='border-t border-[#ddd5c9] dark:border-[#4a443e] pt-5 space-y-4'
            >
              <div>
                <label
                  htmlFor='gpx-upload'
                  className='block text-sm font-medium text-[#1a1816] dark:text-[#f5f1eb] mb-2'
                >
                  GPX file
                </label>
                <input
                  ref={fileInputRef}
                  id='gpx-upload'
                  name='gpx'
                  type='file'
                  accept='.gpx,application/gpx+xml,application/octet-stream'
                  required
                  onChange={handleFileChange}
                  className='block w-full text-sm text-[#1a1816] dark:text-[#f5f1eb] file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-semibold file:uppercase file:tracking-wider file:bg-[#2d4a3e] file:text-[#f5f1eb] hover:file:bg-[#1f352b] file:cursor-pointer'
                />
                <p className='mt-2 text-xs text-[#5c554d] dark:text-[#b8ae9f]'>
                  Accepts `.gpx` exports from FitoTrack. Duplicate routes are
                  detected automatically and will not be imported twice.
                </p>
                {selectedFileName && (
                  <p className='mt-1 text-xs text-[#5c554d] dark:text-[#b8ae9f]'>
                    Selected: {selectedFileName}
                  </p>
                )}
              </div>
              <button
                type='submit'
                disabled={isImporting}
                className='inline-flex items-center justify-center text-sm font-semibold uppercase tracking-wider bg-[#2d4a3e] hover:bg-[#1f352b] disabled:opacity-50 text-[#f5f1eb] px-5 py-2.5 transition-colors'
              >
                {isImporting ? 'Importing…' : 'Import GPX'}
              </button>
            </Form>
          </div>
        </section>
      )}

      <main className='max-w-6xl mx-auto px-6 pt-12 md:pt-16 pb-16 md:pb-24'>
        <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8 pb-6 border-b border-[#ddd5c9] dark:border-[#4a443e]'>
          <div>
            <h2 className='font-[Oswald] text-2xl md:text-3xl font-semibold text-[#1a1816] dark:text-[#f5f1eb]'>
              {isOwner ? 'Imported Hikes' : 'Hikes'}
            </h2>
            {filtered.length > 0 && (
              <p className='text-[#5c554d] dark:text-[#b8ae9f] text-sm mt-1'>
                {filtered.length} {filtered.length === 1 ? 'story' : 'stories'}
              </p>
            )}
          </div>

          <div className='flex flex-col sm:flex-row gap-3 w-full sm:w-auto'>
            <label htmlFor='hike-search' className='sr-only'>
              Search hikes
            </label>
            <input
              id='hike-search'
              type='text'
              placeholder='Search hikes...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='w-full sm:w-56 border border-[#ddd5c9] dark:border-[#4a443e] bg-white dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb] placeholder-[#8c8379] dark:placeholder-[#8c8379] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]'
            />
            <label htmlFor='hike-sort' className='sr-only'>
              Sort hikes
            </label>
            <select
              id='hike-sort'
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className='w-full sm:w-auto border border-[#ddd5c9] dark:border-[#4a443e] bg-white dark:bg-[#3d3832] text-[#1a1816] dark:text-[#f5f1eb] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]'
            >
              <option value='date-desc'>Newest first</option>
              <option value='date-asc'>Oldest first</option>
              <option value='distance-desc'>Longest first</option>
              <option value='elevation-desc'>Most elevation</option>
            </select>
          </div>
        </div>

        {imported.length === 0 ? (
          <div className='border border-[#ddd5c9] dark:border-[#4a443e] bg-white dark:bg-[#2a2622] p-8 md:p-12 text-center'>
            <p className='font-[Oswald] text-xl text-[#1a1816] dark:text-[#f5f1eb] mb-2'>
              No hikes yet
            </p>
            <p className='text-sm text-[#5c554d] dark:text-[#b8ae9f]'>
              {isOwner
                ? 'Upload your first FitoTrack GPX file to begin the archive.'
                : 'The archive is empty. Check back soon.'}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className='border border-[#ddd5c9] dark:border-[#4a443e] bg-white dark:bg-[#2a2622] p-8 md:p-12 text-center'>
            <p className='font-[Oswald] text-xl text-[#1a1816] dark:text-[#f5f1eb] mb-2'>
              No matches
            </p>
            <p className='text-sm text-[#5c554d] dark:text-[#b8ae9f]'>
              No hikes match your search. Try a different term.
            </p>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {filtered.map((activity) => (
              <Link
                key={activity.id}
                to={`/activities/${activity.id}`}
                className='group focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] dark:focus:ring-[#a3c4b3]'
              >
                <article className='h-full border border-[#ddd5c9] dark:border-[#4a443e] overflow-hidden transition-shadow duration-200 ease-out group-hover:shadow-sm'>
                  <div className='h-full bg-white dark:bg-[#2a2622] p-5 transition-transform duration-200 ease-out group-hover:-translate-y-0.5'>
                    <p className='text-[#5c554d] dark:text-[#b8ae9f] text-xs uppercase tracking-[0.15em] mb-3'>
                      {new Date(activity.startDate).toLocaleDateString(
                        'en-GB',
                        {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        }
                      )}
                    </p>
                    <h3 className='font-[Oswald] text-xl font-semibold text-[#1a1816] dark:text-[#f5f1eb] group-hover:text-[#2d4a3e] dark:group-hover:text-[#a3c4b3] transition-colors leading-tight'>
                      {activity.name}
                    </h3>
                    <div className='mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5c554d] dark:text-[#b8ae9f] uppercase tracking-wider'>
                      <span>{formatDistance(activity.distance)}</span>
                      <span>{formatDuration(activity.movingTime)}</span>
                      <span>{activity.totalElevGain}m gain</span>
                    </div>
                    <div className='mt-5 pt-4 border-t border-[#ddd5c9] dark:border-[#4a443e] flex items-center justify-between'>
                      <span className='text-sm font-semibold text-[#2d4a3e] dark:text-[#a3c4b3]'>
                        Read the route
                      </span>
                      <span
                        aria-hidden='true'
                        className='text-lg text-[#2d4a3e] dark:text-[#a3c4b3] transition-transform duration-200 group-hover:translate-x-1'
                      >
                        →
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
