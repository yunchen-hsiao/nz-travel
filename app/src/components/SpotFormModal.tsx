'use client';

import React, { useState } from 'react';
import { uploadPhotosToCloudinary } from '../lib/cloudinary';
import { createClient } from '../lib/supabase/client';
import type { SpotType } from '../lib/types';

interface SpotFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  cityId: string;
  onSuccess: () => void;
}

export function SpotFormModal({ isOpen, onClose, lat, lng, cityId, onSuccess }: SpotFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const type = formData.get('type') as SpotType;
    const date = formData.get('date') as string;
    const desc = formData.get('description') as string;

    try {
      // 1. Upload photos to Cloudinary
      const uploadedPhotos = await uploadPhotosToCloudinary(files);

      // 2. Save spot to Supabase
      const supabase = createClient();
      const { data: spotData, error: spotError } = await supabase
        .from('spots')
        .insert({
          name,
          type,
          lat,
          lng,
          city_id: cityId,
          visited_date: date,
          description: desc,
        })
        .select()
        .single();

      if (spotError) throw spotError;

      // 3. Save photo records to Supabase
      if (uploadedPhotos.length > 0) {
        const photoInserts = uploadedPhotos.map(p => ({
          spot_id: spotData.id,
          cloudinary_url: p.url,
          original_url: p.url, // For unsigned, usually we just keep the same URL or process it
          cloudinary_public_id: p.public_id,
        }));
        
        const { error: photoError } = await supabase
          .from('photos')
          .insert(photoInserts);
          
        if (photoError) throw photoError;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '發生未知錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">新增地點標記</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">地點名稱</label>
              <input name="name" className="form-input" required placeholder="例如：Haka House" />
            </div>

            <div className="form-group">
              <label className="form-label">類型</label>
              <select name="type" className="form-select" required>
                <option value="accommodation">🏠 住宿</option>
                <option value="attraction">📍 景點</option>
                <option value="restaurant">🍽️ 餐廳</option>
                <option value="other">📌 其他</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">到訪日期</label>
              <input type="date" name="date" className="form-input" required />
            </div>

            <div className="form-group">
              <label className="form-label">心得說明</label>
              <textarea name="description" className="form-textarea" placeholder="寫點什麼..." />
            </div>

            <div className="form-group">
              <label className="form-label">上傳照片</label>
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="form-input" 
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '儲存中...' : '確認新增'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
