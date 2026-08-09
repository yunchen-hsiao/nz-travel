import Link from 'next/link';
import { createClient } from '../lib/supabase/server';
import { buildRateMap, formatTWD, sumAsTwd } from '../lib/money';

// ── SVG Icon Components ──────────────────────────
function IconCalendar() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconCity() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18M9 21V7l6-4v18M3 21V11l6-4M15 21V3" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s-8-5.6-8-12a8 8 0 1 1 16 0c0 6.4-8 12-8 12z" />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z" />
      <circle cx="17" cy="13" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// ─────────────────────────────────────────────────

export default async function Home() {
  const supabase = await createClient();

  // 1. Trip info
  const { data: trip } = await supabase.from('trips').select('*').limit(1).single();

  let days = 33;
  let tripRange = '2026/06/26 — 2026/07/28';
  if (trip && trip.start_date && trip.end_date) {
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    days = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
    tripRange = `${trip.start_date.replace(/-/g, '/')} — ${trip.end_date.replace(/-/g, '/')}`;
  }

  // 2. Cities count
  const { count: citiesCount } = await supabase
    .from('cities')
    .select('*', { count: 'exact', head: true });

  // 3. Spots count
  const { count: spotsCount } = await supabase
    .from('spots')
    .select('*', { count: 'exact', head: true });

  // 4. Total expenses — 全部換算成台幣加總：已有台幣紀錄的直接採用真實金額，
  //    只有紐幣紀錄的用當天（或最接近日期）的歷史匯率概算，跟 /ledger 頁面
  //    「顯示為台幣」模式的計算規則一致。
  const [{ data: expenses }, { data: rates }] = await Promise.all([
    supabase.from('expenses').select('date, amount_nzd, amount_twd'),
    supabase.from('exchange_rates').select('*'),
  ]);
  const rateMap = buildRateMap(rates ?? []);
  const totalIsEstimated = (expenses ?? []).some((e) => e.amount_twd === null && e.amount_nzd !== null);
  const formattedExpense = expenses ? formatTWD(sumAsTwd(expenses, rateMap), totalIsEstimated) : formatTWD(0);

  const stats = [
    { value: days,             label: '旅行天數', sub: 'Days',    icon: <IconCalendar /> },
    { value: citiesCount || 0, label: '走訪城市', sub: 'Cities',  icon: <IconCity /> },
    { value: spotsCount || 0,  label: '打卡景點', sub: 'Spots',   icon: <IconMapPin /> },
    { value: formattedExpense, label: '總花費',   sub: 'TWD',     icon: <IconWallet /> },
  ];

  const navCards = [
    {
      href: '/map',
      icon: <IconMap />,
      title: '足跡地圖',
      desc: '探索我們走過的路線、住宿地點與必吃美食。點擊標記還能查看當天日記與照片。',
      cta: '打開地圖',
      color: 'var(--color-primary)',
    },
    {
      href: '/ledger',
      icon: <IconChart />,
      title: '記帳分析',
      desc: '詳細的開銷明細與圖表分析，支援 AI 掃描收據直接記帳，看看錢都花去哪了。',
      cta: '查看帳本',
      color: 'var(--color-accent)',
    },
    {
      href: '/gallery',
      icon: <IconCamera />,
      title: '回憶相冊',
      desc: '以無縫瀑布流展示高畫質照片，記錄每一刻壯麗的紐西蘭風景，支援原圖下載。',
      cta: '瀏覽照片',
      color: 'var(--color-highlight)',
    },
  ];

  return (
    <main
      className="page-wrapper"
      style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh' }}
    >
      {/* Aurora Background */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
        <div className="aurora-blob aurora-blob-4" />
      </div>

      {/* Main Content */}
      <div
        className="container"
        style={{ position: 'relative', zIndex: 1, paddingTop: '80px', paddingBottom: '0px' }}
      >
        {/* ── Hero ── */}
        <div style={{ textAlign: 'center', marginBottom: '80px', animation: 'fadeIn 0.8s ease-out' }}>


          <h1 className="home-hero-title">{trip?.name || '紐西蘭自助旅行'}</h1>

          <p className="home-hero-subtitle" style={{ marginBottom: '12px' }}>
            {tripRange}
          </p>

        </div>

        {/* ── Stats Grid ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '80px',
            animation: 'slideUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s both',
          }}
        >
          {stats.map((stat, i) => (
            <div
              key={i}
              className="aurora-glass stat-card"
              style={{ animationDelay: `${0.1 * i}s` }}
            >
              {/* SVG Icon */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '52px',
                  height: '52px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--glass-border)',
                  margin: '0 auto 16px',
                  color: 'var(--color-primary-light)',
                }}
              >
                {stat.icon}
              </div>
              <div className="stat-number">{stat.value}</div>
              <div className="stat-label">
                {stat.label}
                <span style={{ display: 'block', marginTop: '2px', opacity: 0.55 }}>
                  ({stat.sub})
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Navigation Cards ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            animation: 'slideUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s both',
          }}
        >
          {navCards.map((card) => (
            <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
              <div
                className="aurora-glass card"
                style={{
                  padding: '36px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  height: '100%',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top glow line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '2px',
                    background: `linear-gradient(90deg, transparent, ${card.color}, transparent)`,
                    opacity: 0.6,
                  }}
                />

                {/* SVG Icon */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '60px',
                    height: '60px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--glass-border)',
                    color: card.color,
                  }}
                >
                  {card.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '22px', marginBottom: '10px', color: 'var(--text-primary)' }}>
                    {card.title}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>
                    {card.desc}
                  </p>
                </div>

                {/* CTA */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: card.color,
                    fontWeight: 600,
                    fontSize: '14px',
                  }}
                >
                  {card.cta}
                  <IconArrow />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
