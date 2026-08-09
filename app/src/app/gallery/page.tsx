'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '../../lib/supabase/client';
import UploadPhotoModal from '../../components/UploadPhotoModal';
import type { Photo } from '../../lib/types';
import { getCloudinaryDisplayUrl, getCloudinaryPhotoUrl, getPhotoUrls } from '../../lib/photo-url';

export default function GalleryPage() {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // Filter state
  const [filterSpotId, setFilterSpotId] = useState<string>('all');

  const fetchPhotos = useCallback(() => {
    setLoading(true);
    const supabase = createClient();
    return supabase
      .from('photos')
      .select('*, spots(id, name, visited_date)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (data) setPhotos(data);
        if (error) console.error('Error fetching photos:', error);
        setLoading(false);
      });
  }, []);

  // Check admin session so the upload button only shows to logged-in users.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Data fetching on mount is an explicitly documented valid use of effects
  // (see https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPhotos();
  }, [fetchPhotos]);

  const handleUploadSuccess = () => {
    setIsUploadModalOpen(false);
    fetchPhotos();
  };

  // Get unique spots from photos for the filter dropdown
  const uniqueSpots = Array.from(new Set(photos.map(p => p.spots?.id)))
    .filter((id): id is string => Boolean(id))
    .map(id => {
      const photo = photos.find(p => p.spots?.id === id);
      return photo?.spots;
    })
    .filter((spot): spot is NonNullable<typeof spot> => Boolean(spot));

  const filteredPhotos = filterSpotId === 'all'
    ? photos
    : photos.filter(p => p.spots?.id === filterSpotId);
  const selectedPhotoUrl = selectedPhoto
    ? getPhotoUrls(
      getCloudinaryDisplayUrl(selectedPhoto.cloudinary_url),
      getCloudinaryDisplayUrl(selectedPhoto.original_url),
      getCloudinaryPhotoUrl(selectedPhoto.cloudinary_public_id),
    )[0] ?? null
    : null;
  const selectedPhotoDownloadUrl = selectedPhoto
    ? getPhotoUrls(selectedPhoto.original_url, selectedPhoto.cloudinary_url)[0] ?? null
    : null;

  return (
    <div
      className="container"
      style={{ padding: '96px 24px 48px', animation: 'fadeIn 0.5s ease' }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '52px',
          position: 'relative',
          textAlign: 'center',
        }}
      >

        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            marginBottom: '12px',
            background: 'linear-gradient(135deg, var(--text-primary), var(--color-highlight))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'inline-block',
          }}
        >
          回憶相冊
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '480px' }}>
          北島的地熱與豔陽，南島的冰雪與星空，將每一幀風景收藏於此
        </p>

        {session && (
          <button
            className="btn btn-primary"
            style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}
            onClick={() => setIsUploadModalOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            上傳照片
          </button>
        )}
      </div>

      {/* ── Filter Bar ── */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '36px' }}>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {/* All filter pill */}
            <button
              onClick={() => setFilterSpotId('all')}
              style={{
                padding: '7px 18px',
                borderRadius: '9999px',
                border: `1px solid ${filterSpotId === 'all' ? 'var(--border-strong)' : 'var(--glass-border)'}`,
                background: filterSpotId === 'all' ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface)',
                color: filterSpotId === 'all' ? 'var(--color-primary-light)' : 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                backdropFilter: 'blur(8px)',
              }}
            >
              全部景點
            </button>

            {uniqueSpots.map(s => (
              <button
                key={s.id}
                onClick={() => setFilterSpotId(s.id)}
                style={{
                  padding: '7px 18px',
                  borderRadius: '9999px',
                  border: `1px solid ${filterSpotId === s.id ? 'var(--border-strong)' : 'var(--glass-border)'}`,
                  background: filterSpotId === s.id ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface)',
                  color: filterSpotId === s.id ? 'var(--color-primary-light)' : 'var(--text-muted)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Masonry Grid ── */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '60px' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p>載入相片中...</p>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div
          className="aurora-glass"
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            padding: '80px 20px',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', opacity: 0.35 }}>
            {/* Camera SVG */}
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <p style={{ fontSize: '16px', fontWeight: 500 }}>
            暫無相片
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
            點擊右上方上傳照片來豐富你的相冊吧！
          </p>
        </div>
      ) : (
        <div className="photo-grid">
          {filteredPhotos.map((photo) => (
            <div
              key={photo.id}
              className="photo-card"
              onClick={() => setSelectedPhoto(photo)}
            >
              {(() => {
                const imageUrls = getPhotoUrls(
                  getCloudinaryDisplayUrl(photo.cloudinary_url),
                  getCloudinaryDisplayUrl(photo.original_url),
                  getCloudinaryPhotoUrl(photo.cloudinary_public_id),
                );
                const imageUrl = imageUrls[0];

                return imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={photo.caption || '旅行照片'}
                    loading="lazy"
                    data-photo-url-index="0"
                    onError={(event) => {
                      const currentIndex = Number(event.currentTarget.dataset.photoUrlIndex ?? 0);
                      const nextUrl = imageUrls[currentIndex + 1];
                      if (nextUrl) {
                        event.currentTarget.dataset.photoUrlIndex = String(currentIndex + 1);
                        event.currentTarget.src = nextUrl;
                      } else {
                        event.currentTarget.alt = `${photo.caption || '旅行照片'}（圖片無法載入）`;
                      }
                    }}
                  />
                ) : (
                  <div style={{ padding: '24px 12px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px' }}>
                    圖片網址無效
                  </div>
                );
              })()}
              <div className="photo-card-overlay">
                <div className="photo-card-info">
                  <h4>{photo.spots?.name || '未知景點'}</h4>
                  <p>{photo.caption || photo.spots?.visited_date}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Lightbox Modal ── */}
      {selectedPhoto && (
        <div className="lightbox-overlay" onClick={() => setSelectedPhoto(null)}>
          <button
            className="lightbox-close"
            onClick={() => setSelectedPhoto(null)}
            aria-label="關閉"
          >
            ✕
          </button>

          {selectedPhotoUrl ? (
            <Image
              src={selectedPhotoUrl}
              alt={selectedPhoto?.caption || '旅行照片'}
              className="lightbox-img"
              width={1600}
              height={1200}
              sizes="90vw"
              style={{ width: 'auto', height: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p style={{ color: 'white' }}>圖片網址無效</p>
          )}

          <div className="lightbox-controls" onClick={(e) => e.stopPropagation()}>
            {selectedPhotoDownloadUrl && (
              <a
                href={selectedPhotoDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{
                  boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                下載原圖
              </a>
            )}
          </div>
        </div>
      )}

      {isUploadModalOpen && (
        <UploadPhotoModal
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
